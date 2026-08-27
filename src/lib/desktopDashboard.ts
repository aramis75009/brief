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

/** Items actifs, non faits, dont l'échéance est avant aujourd'hui minuit Paris — triés du plus ancien au plus récent. */
export function overdueItems(items: Item[], now: Date): Item[] {
  const bucketOf = makeBucketOf(now);
  return items
    .filter((it) => isActive(it) && !it.doneAt && bucketOf(it.due) === "overdue")
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
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
 * Lignes de l'onglet Tâches & RDV : une ligne par OCCURRENCE de la semaine
 * calendaire (lundi→dimanche, Europe/Paris) pour les séries récurrentes, une
 * ligne par item pour les autres. Même logique que le calendrier
 * (`buildDayAgenda`) : overrides/exdates appliqués, occurrences ≤
 * `lastCompletedOccurrenceAt` masquées (« fait jusqu'à maintenant »). Une
 * série sans occurrence dans la semaine (jour hors fenêtre, série finie)
 * garde une ligne à son occurrence courante pour rester visible.
 */
export function weekOccurrenceRows(items: Item[], now: Date): OccurrenceRow[] {
  const monday = mondayOf(now);
  const nextMonday = shiftDays(monday, 7);
  const start = zonedTime(monday.y, monday.m, monday.d, 0, 0);
  const end = zonedTime(nextMonday.y, nextMonday.m, nextMonday.d, 0, 0);

  const rows: OccurrenceRow[] = [];
  for (const it of items) {
    if (it.status === "idea" || it.status === "archived") continue;
    if (!it.due) continue;
    // Les items faits restent dans `rows` : `filterRowsByState` les écarte du
    // filtre par défaut et les garde pour « Faites » (les exclure ici rendait
    // « Faites » toujours vide — bug 27/08). Une série faite garde UNE ligne à
    // son `due` courant, sans développer d'occurrences résiduelles.
    if (it.doneAt) {
      rows.push({ item: it, due: it.due, key: it.id });
      continue;
    }
    const due = new Date(it.due);
    if (Number.isNaN(due.getTime())) continue;

    if (!it.rrule) {
      rows.push({ item: it, due: it.due, key: it.id });
      continue;
    }

    const anchor = it.seriesAnchor ? new Date(it.seriesAnchor) : due;
    if (Number.isNaN(anchor.getTime())) {
      rows.push({ item: it, due: it.due, key: it.id });
      continue;
    }
    const completedAt = it.lastCompletedOccurrenceAt
      ? new Date(it.lastCompletedOccurrenceAt).getTime()
      : null;
    const occs = occurrencesInRange(anchor, it.rrule, start, end)
      .map((o) => ({ raw: o, eff: applyOverride(o, it.overrides, it.exdates) }))
      .filter((x): x is { raw: Date; eff: Date } => x.eff !== null)
      .filter((x) => completedAt === null || x.eff.getTime() > completedAt)
      .sort((a, b) => a.eff.getTime() - b.eff.getTime());

    if (occs.length) {
      for (const { eff } of occs) {
        rows.push({ item: it, due: eff.toISOString(), key: `${it.id}:${eff.toISOString()}` });
      }
    } else {
      rows.push({ item: it, due: it.due, key: it.id });
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
  switch (filter) {
    case "today":
      return rows.filter((r) => !r.item.doneAt && bucketOf(r.due) === "today");
    case "overdue":
      return rows.filter((r) => !r.item.doneAt && bucketOf(r.due) === "overdue");
    case "done":
      return rows.filter((r) => !!r.item.doneAt);
    default:
      return rows.filter((r) => !r.item.doneAt);
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
