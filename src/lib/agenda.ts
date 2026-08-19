import "server-only";
import { applyOverride } from "./caldav";
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
    if (Number.isNaN(due.getTime()) || due < dayStart || due >= dayEnd) continue;
    // Occurrence décalée (RECURRENCE-ID) ou supprimée (EXDATE) dans l'app
    // Calendrier : l'heure affichée est celle du calendrier, jamais celle de
    // `due` — le calendrier gagne (décision 18/08), y compris par occurrence.
    const effective = applyOverride(due, it.overrides, it.exdates);
    if (!effective) continue;
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

    const occurrences = ev.rrule
      ? occurrencesInRange(new Date(ev.start), ev.rrule, dayStart, dayEnd)
      : inWindow(new Date(ev.start), dayStart, dayEnd);

    for (const occ of occurrences) {
      // Occurrence décalée dans l'app Calendrier (RECURRENCE-ID) ou supprimée
      // (EXDATE) : l'heure affichée est celle du calendrier, jamais celle de
      // la RRULE — le calendrier gagne (décision 18/08), y compris par
      // occurrence. `null` = occurrence supprimée, on ne l'affiche pas.
      const effective = applyOverride(occ, ev.overrides, ev.exdates);
      if (!effective) continue;
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
