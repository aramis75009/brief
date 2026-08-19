import { describe, expect, it } from "vitest";
import { buildDayAgenda } from "./agenda";
import type { CalendarEvent } from "./caldav";
import type { Item } from "./types";

/**
 * `buildDayAgenda` est ce que la vue Rendez-vous affiche pour UN jour donné.
 * Ces tests couvrent les bugs constatés le 2026-08-19 : des tâches terminées
 * qui restent visibles, des événements posés directement dans l'app
 * Calendrier absents de Brief, et une série récurrente qui ne montre qu'une
 * seule occurrence au lieu de toutes celles de la fenêtre.
 */

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "it_1",
    kind: "task",
    title: "Item",
    projectId: "perso",
    due: "2026-08-20T09:00:00+02:00",
    allDay: true,
    priority: 3,
    rrule: null,
    createdAt: "2026-08-15T10:00:00+02:00",
    remindedAt: null,
    doneAt: null,
    ...overrides,
  };
}

function calEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    uid: "91A2AEE9-AD19-42EB-AD7E-ABFF79178A86",
    briefItemId: null,
    calendar: "Personnel",
    title: "Rentre Jeanne",
    start: "2026-08-20T07:00:00.000Z",
    allDay: true,
    durationMinutes: null,
    rrule: null,
    ...overrides,
  };
}

// Jour du 20 août 2026, dans Europe/Paris.
const DAY_START = new Date("2026-08-19T22:00:00Z");
const DAY_END = new Date("2026-08-20T22:00:00Z");

describe("buildDayAgenda", () => {
  it("montre un item Brief actif dont l'échéance tombe ce jour-là", () => {
    const out = buildDayAgenda([item()], [], DAY_START, DAY_END);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Item");
    expect(out[0].source).toBe("brief");
  });

  it("le bug « Relancer Anais » : un item TERMINÉ n'apparaît plus, même daté ce jour", () => {
    const done = item({ doneAt: "2026-08-20T10:00:00+02:00" });
    expect(buildDayAgenda([done], [], DAY_START, DAY_END)).toHaveLength(0);
  });

  it("exclut les idées et les items archivés", () => {
    const idea = item({ id: "idea1", status: "idea" });
    const archived = item({ id: "arch1", status: "archived" });
    expect(buildDayAgenda([idea, archived], [], DAY_START, DAY_END)).toHaveLength(0);
  });

  it("montre un événement posé DIRECTEMENT dans l'app Calendrier, absent de Brief", () => {
    const out = buildDayAgenda([], [calEvent()], DAY_START, DAY_END);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: "calendar", kind: "external", title: "Rentre Jeanne", briefItemId: null });
  });

  it("ne duplique JAMAIS un item brief déjà montré via `items` pour ce jour", () => {
    const it1 = item({ id: "it_push", due: "2026-08-20T16:00:00+02:00", allDay: false });
    const ev = calEvent({ uid: "brief-it_push", briefItemId: "it_push", title: "Séance push", start: "2026-08-20T14:00:00.000Z" });
    const out = buildDayAgenda([it1], [ev], DAY_START, DAY_END);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("brief");
  });

  it("étend une série récurrente sur TOUS ses jours de la fenêtre — pas seulement l'occurrence courante de `due`", () => {
    // L'item Brief a son `due` ancré sur un AUTRE jour (avancement interne),
    // mais la RRULE dit lundi+jeudi : le 20 août (jeudi) doit quand même sortir.
    const it1 = item({
      id: "it_push",
      due: "2026-08-24T16:00:00+02:00", // ancré au lundi suivant
      allDay: false,
      rrule: "FREQ=WEEKLY;BYDAY=MO,TH",
      kind: "event",
    });
    const ev = calEvent({
      uid: "brief-it_push",
      briefItemId: "it_push",
      title: "Séance push",
      start: "2026-08-24T14:00:00.000Z",
      rrule: "FREQ=WEEKLY;BYDAY=MO,TH",
    });
    const out = buildDayAgenda([it1], [ev], DAY_START, DAY_END);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("calendar");
    expect(out[0].kind).toBe("event"); // reprend le kind du vrai item Brief lié
    expect(out[0].due).toBe("2026-08-20T14:00:00.000Z");
  });

  it("un item brief-* dont l'item lié est terminé n'apparaît pas non plus via le calendrier (fenêtre ~15 min)", () => {
    const done = item({ id: "it_x", doneAt: "2026-08-19T10:00:00+02:00" });
    const ev = calEvent({ uid: "brief-it_x", briefItemId: "it_x", title: "Item" });
    expect(buildDayAgenda([done], [ev], DAY_START, DAY_END)).toHaveLength(0);
  });

  it("trie toute-la-journée d'abord, puis par heure croissante", () => {
    const morning = calEvent({ uid: "a", title: "08h", start: "2026-08-20T06:00:00.000Z", allDay: false });
    const allDay = calEvent({ uid: "b", title: "Toute la journée", start: "2026-08-20T07:00:00.000Z", allDay: true });
    const evening = calEvent({ uid: "c", title: "19h", start: "2026-08-20T17:00:00.000Z", allDay: false });
    const out = buildDayAgenda([], [evening, morning, allDay], DAY_START, DAY_END);
    expect(out.map((e) => e.title)).toEqual(["Toute la journée", "08h", "19h"]);
  });

  it("ignore les événements en dehors de la fenêtre du jour demandé", () => {
    const yesterday = calEvent({ uid: "y", title: "Hier", start: "2026-08-19T14:00:00.000Z" });
    const tomorrow = calEvent({ uid: "t", title: "Demain", start: "2026-08-21T14:00:00.000Z" });
    expect(buildDayAgenda([], [yesterday, tomorrow], DAY_START, DAY_END)).toHaveLength(0);
  });

  it("un item ADOPTÉ (externalUid) n'est jamais dupliqué avec son événement source", () => {
    const adopted = item({
      id: "caldav-91A2AEE9",
      title: "Rentre Jeanne",
      due: "2026-08-20T09:00:00+02:00",
      externalUid: "91A2AEE9",
      externalCalendar: "Personnel",
    });
    const ev = calEvent({ uid: "91A2AEE9", briefItemId: null, title: "Rentre Jeanne" });
    const out = buildDayAgenda([adopted], [ev], DAY_START, DAY_END);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("brief");
    expect(out[0].briefItemId).toBe("caldav-91A2AEE9");
  });

  it("un item ADOPTÉ coché dans Brief n'apparaît plus, même si son événement traîne encore dans le calendrier", () => {
    const done = item({
      id: "caldav-91A2AEE9",
      due: "2026-08-20T09:00:00+02:00",
      doneAt: "2026-08-19T20:00:00Z",
      externalUid: "91A2AEE9",
      externalCalendar: "Personnel",
    });
    const ev = calEvent({ uid: "91A2AEE9", briefItemId: null });
    expect(buildDayAgenda([done], [ev], DAY_START, DAY_END)).toHaveLength(0);
  });
});
