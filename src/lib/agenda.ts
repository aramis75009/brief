import "server-only";
import { applyOverride, remoteDueToItem } from "./caldav";
import { occurrencesInRange } from "./rrule";
import type { CalendarEvent } from "./caldav";
import type { Item, ItemKind } from "./types";

/**
 * Fusion « Rendez-vous » — la SEULE porte d'entrée pour construire ce que la
 * vue Rendez-vous affiche un jour donné.
 *
 * Deux sources, jamais une troisième copie :
 *
 *   1. `items` (le store Brief) — pour tout ce que Brief possède : coche,
 *      sous-tâches, projet, statut. Un item terminé (`doneAt`) ou en
 *      idée/archivé n'est pas actif, même règle que HomeScreen/SearchScreen.
 *
 *   2. `snapshotEvents` (l'instantané CalDAV écrit par `runCalDavSync`,
 *      `caldav.ts`) — TOUS les événements des calendriers que Brief affiche,
 *      `brief-*` compris. Sert à deux choses : montrer les événements posés
 *      DIRECTEMENT dans l'app Calendrier (jamais dans `items.json`), et
 *      étendre un item récurrent sur tous ses jours de la fenêtre — `due` ne
 *      porte que l'occurrence COURANTE d'une série (le cron des rappels
 *      l'avance une fois complétée), alors que le calendrier connaît la
 *      RRULE complète et peut être développé sur n'importe quel jour.
 *
 * Un événement calendrier dont l'UID correspond à un item déjà inclus depuis
 * `items` POUR CE JOUR n'est jamais dupliqué — que l'item soit brief-owned
 * (`brief-<id>`) ou ADOPTÉ d'un événement posé directement dans Calendrier
 * (`Item.externalUid` — décision Aramis du 2026-08-19, DECISIONS.md).
 */

export type AgendaItem = {
  /** Identifiant stable pour React — pas forcément un id d'item Brief. */
  id: string;
  source: "brief" | "calendar";
  /** Id de l'item Brief, si l'événement en est un (posé par Brief ou reconnu par UID). */
  briefItemId: string | null;
  kind: ItemKind | "external";
  title: string;
  /** ISO 8601 — l'instant de CETTE occurrence précise. */
  due: string;
  allDay: boolean;
  durationMinutes: number | null;
  projectId: string | null;
  subtasksCount: number | null;
};

function isActiveBriefItem(it: Item): boolean {
  return !it.doneAt && it.status !== "idea" && it.status !== "archived";
}

export function buildDayAgenda(
  items: Item[],
  snapshotEvents: CalendarEvent[],
  dayStart: Date,
  dayEnd: Date,
): AgendaItem[] {
  const itemById = new Map(items.map((it) => [it.id, it]));
  const itemByExternalUid = new Map(
    items.filter((it): it is Item & { externalUid: string } => !!it.externalUid).map((it) => [it.externalUid, it]),
  );
  const includedForThisDay = new Set<string>();
  const out: AgendaItem[] = [];

  for (const it of items) {
    if (!isActiveBriefItem(it) || !it.due) continue;
    const due = new Date(it.due);
    if (Number.isNaN(due.getTime())) continue;
    // Occurrence décalée (RECURRENCE-ID) ou supprimée (EXDATE) dans l'app
    // Calendrier : l'heure affichée est celle du calendrier, jamais celle de
    // `due` — le calendrier gagne (décision 18/08), y compris par occurrence.
    const effective = applyOverride(due, it.overrides, it.exdates);
    if (!effective) continue;
    // ⚠️ La fenêtre se teste sur l'heure EFFECTIVE, jamais sur `due` brut :
    // un item décalé au lendemain dans l'app Calendrier appartient au jour
    // d'ARRIVÉE. Filtrer sur `due` l'affichait au jour d'origine avec
    // l'horodatage du lendemain, et le rendait introuvable le bon jour
    // (constaté en prod le 2026-09-05).
    if (effective < dayStart || effective >= dayEnd) continue;
    out.push({
      id: `brief:${it.id}`,
      source: "brief",
      briefItemId: it.id,
      kind: it.kind,
      title: it.title,
      due: effective.toISOString(),
      allDay: it.allDay,
      durationMinutes: it.durationMinutes ?? null,
      projectId: it.projectId,
      subtasksCount: it.subtasks?.length ?? null,
    });
    includedForThisDay.add(it.id);
  }

  for (const ev of snapshotEvents) {
    // L'item Brief que cet événement représente, brief-owned OU adopté.
    const linkedItem = (ev.briefItemId ? itemById.get(ev.briefItemId) : undefined) ?? itemByExternalUid.get(ev.uid);

    // Déjà montré via `items` pour ce jour précis — jamais de doublon.
    if (linkedItem && includedForThisDay.has(linkedItem.id)) continue;

    // L'item lié existe mais est terminé/idée/archivé : le calendrier n'a pas
    // encore rattrapé (fenêtre ~15 min) — ne pas le montrer comme actif.
    if (linkedItem && !isActiveBriefItem(linkedItem)) continue;

    // Occurrences que la grille place ce jour-là, PLUS celles qu'un override
    // y amène depuis un autre jour — voir `candidateOccurrences`.
    const occurrences = candidateOccurrences(
      ev.rrule
        ? occurrencesInRange(new Date(ev.start), ev.rrule, dayStart, dayEnd)
        : inWindow(new Date(ev.start), dayStart, dayEnd),
      ev.overrides,
      dayStart,
      dayEnd,
    );

    // Une occurrence qu'une coche utilisateur a terminée ne doit pas
    // réapparaître : `completionPatch` avance `due` sans jamais poser
    // `doneAt` sur une récurrence, et Brief ne touche jamais au calendrier
    // pour une complétion (décision 2026-08-19) — la série RRULE la
    // recontient donc pour toujours. Comparer à `due` directement serait trop
    // large : le cron des rappels avance AUSSI `due`, pour planifier le
    // prochain envoi, sans que rien n'ait été fait (constaté en prod le
    // 2026-08-20 : « Reposter 10 articles »/« Poster 10 articles »
    // disparaissaient du jour dès que leur rappel sonnait). Seul
    // `lastCompletedOccurrenceAt`, posé UNIQUEMENT par une coche utilisateur,
    // identifie la frontière. Une coche vaut « fait jusqu'à aujourd'hui » :
    // on masque TOUTES les occurrences de la série ≤ cette dernière occurrence
    // comprise, pas seulement l'exact match — sans quoi les occurrences de la
    // veille (jamais cochées individuellement) ressurgissent à la consultation
    // d'un jour passé et font croire que « la tâche ne se marque jamais faite »
    // (retour Aramis du 2026-08-20, agenda du 19 août affichait encore
    // Poster/Reposter alors que le 20 était coché).
    const completedAt = linkedItem?.lastCompletedOccurrenceAt
      ? new Date(linkedItem.lastCompletedOccurrenceAt).getTime()
      : null;

    for (const occ of occurrences) {
      // Occurrence décalée dans l'app Calendrier (RECURRENCE-ID) ou supprimée
      // (EXDATE) : l'heure affichée est celle du calendrier, jamais celle de
      // la RRULE — le calendrier gagne (décision 18/08), y compris par
      // occurrence. `null` = occurrence supprimée, on ne l'affiche pas.
      const effective = applyOverride(occ, ev.overrides, ev.exdates);
      if (!effective) continue;
      // Même règle que pour les items ci-dessus : c'est l'heure EFFECTIVE qui
      // décide du jour. Une occurrence que l'override sort de la fenêtre
      // appartient à un autre jour — elle y sera reprise comme candidate.
      if (effective < dayStart || effective >= dayEnd) continue;
      // `lastCompletedOccurrenceAt` est posé à partir de `due`, qui reflète
      // déjà l'heure EFFECTIVE d'une occurrence décalée (la synchro CalDAV
      // adopte l'override dans `due` avant que la coche n'avance la série) —
      // comparer à `effective`, pas à `occ` brut de la RRULE, sous peine de
      // ne jamais matcher une occurrence décalée qui vient d'être cochée.
      // Seuil ≤ (pas seulement égal) : une coche vaut « fait jusqu'à
      // aujourd'hui » — l'occurrence cochée ET toutes les précédentes de la
      // série sont faites (retour Aramis 20/08).
      if (completedAt !== null && effective.getTime() <= completedAt) continue;
      out.push({
        id: `cal:${ev.uid}:${effective.toISOString()}`,
        source: "calendar",
        briefItemId: linkedItem?.id ?? null,
        kind: linkedItem ? linkedItem.kind : "external",
        title: linkedItem ? linkedItem.title : ev.title,
        due: effective.toISOString(),
        allDay: ev.allDay,
        durationMinutes: ev.durationMinutes,
        projectId: linkedItem ? linkedItem.projectId : null,
        subtasksCount: linkedItem?.subtasks?.length ?? null,
      });
    }
  }

  return out.sort((a, b) => {
    // Toute la journée d'abord, comme la ligne dédiée d'Apple Calendar.
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return new Date(a.due).getTime() - new Date(b.due).getTime();
  });
}

function inWindow(d: Date, start: Date, end: Date): Date[] {
  return d >= start && d < end ? [d] : [];
}

/**
 * Les occurrences D'ORIGINE à examiner pour ce jour : celles que la grille
 * (RRULE, ou date unique) y place, PLUS celles qu'un override déplace VERS ce
 * jour depuis un autre.
 *
 * Sans cette seconde moitié, une séance décalée dans l'app Calendrier n'est
 * candidate AUCUN jour : ni le jour d'origine — l'override l'en sort — ni le
 * jour d'arrivée, où la grille RRULE ne la met pas. C'est le défaut constaté
 * en prod le 2026-09-05 : « Séance push » décalée du jeudi au vendredi
 * s'affichait le jeudi, horodatée au vendredi, et manquait le vendredi.
 *
 * Dédoublonné par horodatage : une occurrence seulement décalée d'une heure
 * DANS la même journée arrive par les deux chemins et ne doit compter qu'une
 * fois. Les clés illisibles sont ignorées plutôt que devinées — même principe
 * qu'ailleurs dans Brief : pas d'occurrence à une date approchée.
 */
function candidateOccurrences(
  grid: Date[],
  overrides: Record<string, string> | undefined,
  dayStart: Date,
  dayEnd: Date,
): Date[] {
  if (!overrides) return grid;
  const byTime = new Map(grid.map((d) => [d.getTime(), d]));
  for (const [from, to] of Object.entries(overrides)) {
    const moved = new Date(remoteDueToItem(to));
    if (Number.isNaN(moved.getTime()) || moved < dayStart || moved >= dayEnd) continue;
    const origin = new Date(remoteDueToItem(from));
    if (Number.isNaN(origin.getTime())) continue;
    byTime.set(origin.getTime(), origin);
  }
  return [...byTime.values()];
}
