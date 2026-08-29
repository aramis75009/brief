/**
 * Calculs de vue pour la version desktop de Brief.
 *
 * Purs, testés, et alignés sur les mêmes définitions que `/api/overview`
 * (`src/lib/buckets.ts`) — jamais une seconde notion d'« en retard » ou
 * « cette semaine » qui pourrait diverger de la Vision déjà servie par le
 * serveur. Aucune méthode locale de `Date` : tout passe par `src/lib/zoned.ts`.
 */

import { makeBucketOf } from "./buckets";
import { shiftDays, zonedParts, zonedTime, type CalendarDate } from "./zoned";
import { occurrencesInRange } from "./rrule";
import { applyOverride } from "./overrides";
import type { Item, Priority, Project } from "./types";

function isActive(it: Item): boolean {
  return it.status !== "idea" && it.status !== "archived";
}

/** Lundi de la semaine calendaire contenant `now`, dans Europe/Paris. */
export function mondayOf(now: Date): CalendarDate {
  const parts = zonedParts(now);
  const offset = (parts.weekday + 6) % 7; // lundi=0 … dimanche=6
  return shiftDays(parts, -offset);
}

/**
 * Occurrences manquées d'une série récurrente : celles dont l'heure
 * effective est passée (jour < aujourd'hui) et qui ne sont pas couvertes
 * par la dernière coche (« fait jusqu'à maintenant »).
 *
 * Constat Aramis 29/08 : « parfois je fais la tâche mais j'oublie de la
 * cocher — elle doit atterrir dans "En retard" pour que je puisse la
 * cocher et faire avancer la semaine ». Une récurrente dont le `due` pointe
 * la prochaine occurrence n'est JAMAIS « en retard » avec l'ancien calcul
 * (bucket sur `due`) : ses occurrences passées non cochées n'existaient
 * dans aucune vue. On les expose ici, une par ligne cochable.
 */
export function missedOccurrences(
  it: Item,
  now: Date,
  /** Borne haute de recherche (minuit de demain par défaut). */
  rangeEnd?: Date,
): Date[] {
  if (!it.rrule || !it.due) return [];
  const due = new Date(it.due);
  if (Number.isNaN(due.getTime())) return [];
  const anchor = it.seriesAnchor ? new Date(it.seriesAnchor) : due;
  if (Number.isNaN(anchor.getTime())) return [];
  const completedAt = it.lastCompletedOccurrenceAt
    ? new Date(it.lastCompletedOccurrenceAt).getTime()
    : null;
  // De l'ancre de la série à demain minuit : toute l'histoire, la dernière
  // coche et le filtre « jour fini » réduisent ensuite au manqué réel.
  const start = anchor;
  const end = rangeEnd ?? midnightTomorrow(now);
  return occurrencesInRange(anchor, it.rrule, start, end)
    .map((o) => applyOverride(o, it.overrides, it.exdates))
    .filter((d): d is Date => d !== null)
    .filter((d) => {
      // « Jour déjà commencé/fini » : l'occurrence d'aujourd'hui n'est pas
      // manquée tant que son jour n'est pas fini.
      const p = zonedParts(d);
      const today = zonedParts(now);
      const isPastDay = `${p.y}-${p.m}-${p.d}` < `${today.y}-${today.m}-${today.d}`;
      if (!isPastDay) return false;
      // Pas encore « faite » : postérieure à la dernière coche.
      return completedAt === null || d.getTime() > completedAt;
    });
}

/** Minuit du jour suivant `now`, Europe/Paris. */
export function midnightTomorrow(now: Date): Date {
  const parts = zonedParts(now);
  const next = shiftDays(parts, 1);
  return zonedTime(next.y, next.m, next.d, 0, 0);
}

/** Une ligne « en retard » : l'item ET l'occurrence précise qui est manquée. */
export type OverdueRow = {
  item: Item;
  /** ISO de l'occurrence manquée (post-override) — celle que la coche va terminer. */
  due: string;
  key: string;
};

/**
 * Items en retard, occurrences comprises. Un item simple non fait dont
 * l'échéance est passée = une ligne. Une série récurrente = une ligne PAR
 * occurrence manquée (jour fini, non couverte par la dernière coche) —
 * c'est le filet « j'ai fait la séance mais j'ai oublié de cocher » :
 * cocher la ligne avance la série ET l'avancement de la semaine.
 */
export function overdueRows(items: Item[], now: Date, limit?: number): OverdueRow[] {
  const bucketOf = makeBucketOf(now);
  const rows: OverdueRow[] = [];
  for (const it of items) {
    if (!isActive(it) || it.doneAt) continue;
    if (it.rrule) {
      for (const missed of missedOccurrences(it, now)) {
        rows.push({ item: it, due: missed.toISOString(), key: `${it.id}:${missed.toISOString()}` });
      }
      continue;
    }
    if (it.due && bucketOf(it.due) === "overdue") {
      rows.push({ item: it, due: it.due, key: it.id });
    }
  }
  rows.sort((a, b) => a.due.localeCompare(b.due));
  return limit ? rows.slice(0, limit) : rows;
}

/**
 * Faites/total par projet sur la semaine calendaire en cours (lundi→dimanche,
 * Europe/Paris) — les projets les plus chargés d'abord, `limit` au maximum.
 * Un projet sans rien cette semaine n'apparaît pas.
 *
 * ⚠️ Le total compte les OCCURRENCES, pas les lignes : une série récurrente
 * (ex. « Aller courir » mer+sam) vaut 2 par semaine, comme le calendrier.
 * Une occurrence est « faite » quand la dernière coche
 * (`lastCompletedOccurrenceAt`, post-override) est ≥ à son heure effective —
 * la sémantique « coche = fait jusqu'à maintenant » des récurrentes.
 * Inclut les TÂCHES ET les RDV (`kind: "event"`). Exclut idées/archivés.
 */
export function weekProgressByProject(
  items: Item[],
  projects: Project[],
  now: Date,
  limit = 3,
): { project: Project; done: number; total: number }[] {
  const monday = mondayOf(now);
  const nextMonday = shiftDays(monday, 7);
  const start = zonedTime(monday.y, monday.m, monday.d, 0, 0);
  const end = zonedTime(nextMonday.y, nextMonday.m, nextMonday.d, 0, 0);

  /** Les occurrences (ou l'item simple) de la semaine pour un item actif. */
  const weekSlotsOf = (it: Item): Date[] => {
    if (!it.due) return [];
    if (it.status === "idea" || it.status === "archived") return [];
    const due = new Date(it.due);
    if (Number.isNaN(due.getTime())) return [];
    if (!it.rrule) {
      return due >= start && due < end ? [due] : [];
    }
    // Série récurrente : toutes les occurrences de la fenêtre, décalages
    // (overrides) et suppressions (exdates) appliqués comme dans l'agenda.
    const anchor = it.seriesAnchor ? new Date(it.seriesAnchor) : due;
    if (Number.isNaN(anchor.getTime())) return [];
    return occurrencesInRange(anchor, it.rrule, start, end)
      .map((occ) => applyOverride(occ, it.overrides, it.exdates))
      .filter((d): d is Date => d !== null && d >= start && d < end);
  };

  /** Une occurrence effective est-elle faite ? (coche de récurrente = dernière occurrence cochée) */
  const isDone = (it: Item, slot: Date): boolean => {
    if (it.rrule) {
      if (!it.lastCompletedOccurrenceAt) return false;
      const last = new Date(it.lastCompletedOccurrenceAt);
      return !Number.isNaN(last.getTime()) && slot.getTime() <= last.getTime();
    }
    return !!it.doneAt;
  };

  return projects
    .map((project) => {
      const mine = items.filter((it) => it.projectId === project.id);
      const slots = mine.flatMap((it) => weekSlotsOf(it).map((s) => ({ it, s })));
      const done = slots.filter(({ it, s }) => isDone(it, s)).length;
      return { project, done, total: slots.length };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/**
 * Id de l'item le moins urgent (priorité numériquement la plus haute — 4 avant
 * 1, RFC 5545) parmi une liste — sert à choisir quoi repousser pour « Alléger
 * mon mur ». À égalité de priorité, l'échéance la plus tardive gagne : c'est
 * celle qui peut le plus se permettre d'attendre un jour de plus.
 */
export function leastUrgentId(
  items: { id: string; priority: Priority; due: string | null }[],
): string | null {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (b.due ?? "").localeCompare(a.due ?? "");
  });
  return sorted[0].id;
}

export type TaskFilterKey = "all" | "today" | "overdue" | "done";

export const TASK_FILTERS: { key: TaskFilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "today", label: "Aujourd’hui" },
  { key: "overdue", label: "En retard" },
  { key: "done", label: "Faites" },
];

/** Filtre par type pour l'écran Tâches & RDV du desktop. */
export type TaskKindFilter = "all" | "task" | "event";

export const TASK_KIND_FILTERS: { key: TaskKindFilter; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "task", label: "Tâches" },
  { key: "event", label: "RDV" },
];

/** Items actifs filtrés par type (tâches et/ou RDV) — les idées/archivés ne passent jamais. */
export function filterAgendaItems(items: Item[], kind: TaskKindFilter): Item[] {
  const active = items.filter((it) => isActive(it));
  if (kind === "all") return active;
  return active.filter((it) => it.kind === kind);
}

/** Une ligne de l'onglet Tâches & RDV : un item à UN instant précis (occurrence). */
export type OccurrenceRow = {
  item: Item;
  /** ISO 8601 de CETTE occurrence (post-override) — l'heure affichée ET cochée. */
  due: string;
  /** Clé stable pour React — item + occurrence. */
  key: string;
};

/**
 * Lignes de l'onglet Tâches & RDV : une ligne par OCCURRENCE. Pour une série
 * récurrente : toutes les occurrences de la semaine (faites, manquées ou à
 * venir — le filtre d'état fait le tri), PLUS les occurrences manquées
 * d'avant la semaine (bornées à 7 jours en arrière, le filet « en retard »),
 * SANS jamais injecter d'occurrence de la semaine suivante (le comportement
 * précédent affichait le RDV du lundi suivant au milieu de la semaine en
 * cours — capture Aramis 29/08 : « un RDV le 28, puis 31, puis 2 »).
 */
export function weekOccurrenceRows(items: Item[], now: Date): OccurrenceRow[] {
  const monday = mondayOf(now);
  const nextMonday = shiftDays(monday, 7);
  const start = zonedTime(monday.y, monday.m, monday.d, 0, 0);
  const end = zonedTime(nextMonday.y, nextMonday.m, nextMonday.d, 0, 0);
  // Les occurrences manquées d'avant la semaine ne remontent que sur 7 jours
  // — plus loin, la ligne « en retard » du dashboard reste le bon endroit.
  const missedWindowStart = zonedTime(monday.y, monday.m, Math.max(1, monday.d - 7), 0, 0);

  const rows: OccurrenceRow[] = [];
  for (const it of items) {
    if (it.status === "idea" || it.status === "archived") continue;
    if (!it.due) continue;
    // Un item FAIT (non récurrent) n'apparaît que si son échéance est dans
    // la semaine — pour le filtre « Faites ». Les faits d'avant la semaine
    // n'ont rien à faire dans cette vue (pollution constatée en prod :
    // « salle de sport » du 17/08 toujours visible fin août).
    if (it.doneAt && !it.rrule) {
      const d = new Date(it.due);
      if (!Number.isNaN(d.getTime()) && d >= start && d < end) {
        rows.push({ item: it, due: it.due, key: it.id });
      }
      continue;
    }
    const due = new Date(it.due);
    if (Number.isNaN(due.getTime())) continue;

    // Item simple (fait ou non) : une ligne à son échéance.
    if (!it.rrule) {
      rows.push({ item: it, due: it.due, key: it.id });
      continue;
    }

    const anchor = it.seriesAnchor ? new Date(it.seriesAnchor) : due;
    if (Number.isNaN(anchor.getTime())) {
      rows.push({ item: it, due: it.due, key: it.id });
      continue;
    }

    // Série récurrente : TOUTES les occurrences de la semaine (faites
    // comprises — le filtre d'état décide de l'affichage), puis les
    // manquées d'avant la semaine. Jamais de semaine suivante.
    const occs = occurrencesInRange(anchor, it.rrule, anchor, end)
      .map((o) => ({ raw: o, eff: applyOverride(o, it.overrides, it.exdates) }))
      .filter((x): x is { raw: Date; eff: Date } => x.eff !== null)
      .sort((a, b) => a.eff.getTime() - b.eff.getTime());

    const seen = new Set<string>();
    for (const { eff } of occs) {
      const iso = eff.toISOString();
      if (seen.has(iso)) continue;
      if (eff >= start && eff < end) {
        seen.add(iso);
        rows.push({ item: it, due: iso, key: `${it.id}:${iso}` });
      }
    }
    // Occurrences manquées AVANT la semaine (fenêtre 7 jours) : non
    // couvertes par la dernière coche et dont le jour est fini.
    for (const missed of missedOccurrences(it, now, start)) {
      if (missed < missedWindowStart) continue;
      const iso = missed.toISOString();
      if (seen.has(iso)) continue;
      seen.add(iso);
      rows.push({ item: it, due: iso, key: `${it.id}:${iso}` });
    }
  }
  // Tri chronologique : une liste de RDV se lit par date croissante, pas par
  // ordre d'insertion dans items.json (capture Aramis 27/08 — « Aller courir »
  // samedi affiché avant « Séance push » jeudi).
  return rows.sort((a, b) => a.due.localeCompare(b.due));
}

/** Tâches (jamais les RDV) filtrées pour l'écran Tâches du desktop. */
export function filterTasks(items: Item[], filter: TaskFilterKey, now: Date): Item[] {
  const bucketOf = makeBucketOf(now);
  const tasks = items.filter((it) => it.kind === "task" && isActive(it));
  switch (filter) {
    case "today":
      return tasks.filter((it) => !it.doneAt && bucketOf(it.due) === "today");
    case "overdue":
      return tasks.filter((it) => !it.doneAt && bucketOf(it.due) === "overdue");
    case "done":
      return tasks.filter((it) => !!it.doneAt);
    default:
      return tasks.filter((it) => !it.doneAt);
  }
}

/** Items actifs filtrés par état — s'applique aux TÂCHES comme aux RDV (l'écran Tâches & RDV). */
export function filterActiveByState(items: Item[], filter: TaskFilterKey, now: Date): Item[] {
  const bucketOf = makeBucketOf(now);
  const active = items.filter((it) => isActive(it));
  switch (filter) {
    case "today":
      return active.filter((it) => !it.doneAt && bucketOf(it.due) === "today");
    case "overdue":
      return active.filter((it) => !it.doneAt && bucketOf(it.due) === "overdue");
    case "done":
      return active.filter((it) => !!it.doneAt);
    default:
      return active.filter((it) => !it.doneAt);
  }
}

/**
 * Filtre d'état sur les LIGNES d'occurrences : « Aujourd'hui » / « En retard »
 * se lisent sur l'occurrence (`row.due`), jamais sur le `due` courant de
 * l'item (qui peut pointer la semaine prochaine pour une série déjà avancée).
 */
export function filterRowsByState(rows: OccurrenceRow[], filter: TaskFilterKey, now: Date): OccurrenceRow[] {
  const bucketOf = makeBucketOf(now);
  const isDone = (r: OccurrenceRow): boolean => {
    // Une occurrence est faite si l'item est terminé OU si la série la
    // couvre (« fait jusqu'à maintenant ») — l'occurrence précise, pas
    // seulement la dernière coche.
    if (r.item.doneAt) return true;
    if (r.item.rrule && r.item.lastCompletedOccurrenceAt) {
      const last = new Date(r.item.lastCompletedOccurrenceAt).getTime();
      return !Number.isNaN(last) && new Date(r.due).getTime() <= last;
    }
    return false;
  };
  switch (filter) {
    case "today":
      return rows.filter((r) => !isDone(r) && bucketOf(r.due) === "today");
    case "overdue":
      return rows.filter((r) => !isDone(r) && bucketOf(r.due) === "overdue");
    case "done":
      return rows.filter((r) => isDone(r));
    default:
      return rows.filter((r) => !isDone(r));
  }
}

/** Items de la semaine calendaire (lundi→dimanche, Europe/Paris), actifs (non faits). */
export function weekOpenItems(items: Item[], now: Date): Item[] {
  const monday = mondayOf(now);
  const nextMonday = shiftDays(monday, 7);
  const start = zonedTime(monday.y, monday.m, monday.d, 0, 0);
  const end = zonedTime(nextMonday.y, nextMonday.m, nextMonday.d, 0, 0);
  return items.filter((it) => {
    if (!it.due) return false;
    if (it.status === "idea" || it.status === "archived") return false;
    if (it.doneAt) return false;
    const d = new Date(it.due);
    return !Number.isNaN(d.getTime()) && d >= start && d < end;
  });
}

/** Compteurs d'items ouverts par type sur la semaine calendaire — les mêmes bornes que `weekProgressByProject`. */
export function weekOpenCounts(
  items: Item[],
  now: Date,
): { tasks: number; events: number } {
  const open = weekOpenItems(items, now);
  return {
    tasks: open.filter((it) => it.kind === "task").length,
    events: open.filter((it) => it.kind === "event").length,
  };
}

/** Regroupe une liste d'items par projet, dans l'ordre des `projects`. Un projet sans ligne n'apparaît pas. */
export function groupByProject(
  items: Item[],
  projects: Project[],
): { project: Project; rows: Item[] }[] {
  return projects
    .map((project) => ({ project, rows: items.filter((it) => it.projectId === project.id) }))
    .filter((group) => group.rows.length > 0);
}

/** Répartition des tâches ouvertes par priorité — pour la carte « Par priorité ». */
export function priorityBreakdown(
  items: Item[],
): { priority: Priority; count: number; pct: number }[] {
  const open = items.filter((it) => it.kind === "task" && isActive(it) && !it.doneAt);
  const total = open.length || 1;
  return ([1, 2, 3, 4] as const).map((priority) => {
    const count = open.filter((it) => it.priority === priority).length;
    return { priority, count, pct: Math.round((count / total) * 100) };
  });
}
