import { describe, expect, it } from "vitest";
import { buildEventIcs, calendarForProject } from "./caldav";
import type { Item } from "./types";

/**
 * La conversion item Brief → événement iCalendar est ce que voit Aramis dans
 * son calendrier Apple. Une date décalée ne se voit pas dans les logs — elle
 * se voit le jour où le résumé du matin sert un rendez-vous à la mauvaise
 * date. La suite tourne en UTC (vitest.config.mts) : si ces tests passent,
 * la conversion est indépendante du fuseau de la machine.
 */

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "it_123",
    kind: "task",
    title: "Préparer la réunion",
    projectId: "p1",
    due: "2026-08-18T09:00:00+02:00",
    allDay: true,
    priority: 1,
    rrule: null,
    notes: undefined,
    createdAt: "2026-08-17T10:00:00+02:00",
    remindedAt: null,
    doneAt: null,
    ...overrides,
  };
}

describe("buildEventIcs", () => {
  it("renvoie null pour un item terminé — il disparaît du calendrier", () => {
    expect(buildEventIcs(item({ doneAt: "2026-08-17T10:05:00+02:00" }))).toBeNull();
  });

  it("renvoie null pour un item sans échéance — rien à dater", () => {
    expect(buildEventIcs(item({ due: null }))).toBeNull();
  });

  it("renvoie null pour une échéance illisible — jamais un événement approximatif", () => {
    expect(buildEventIcs(item({ due: "pas-une-date" }))).toBeNull();
  });

  it("écrit l'UID `brief-<id>` — la synchro en dépend pour l'idempotence", () => {
    const ics = buildEventIcs(item());
    expect(ics).toContain("UID:brief-it_123");
  });

  it("une tâche journée entière utilise VALUE=DATE avec la date de Paris", () => {
    const ics = buildEventIcs(item());
    // 2026-08-18T09:00:00+02:00 = le 18 août à Paris → journée du 18.
    expect(ics).toContain("DTSTART;VALUE=DATE:20260818");
    // La journée entière se termine le lendemain, exclusif.
    expect(ics).toContain("DTEND;VALUE=DATE:20260819");
  });

  it("un rende-vous horaire écrit DTSTART/DTEND en UTC avec une durée d'une heure", () => {
    const ics = buildEventIcs(
      item({
        kind: "event",
        allDay: false,
        // 14h00 à Paris (+02:00) = 12h00 UTC.
        due: "2026-08-18T14:00:00+02:00",
      }),
    );
    expect(ics).toContain("DTSTART:20260818T120000Z");
    expect(ics).toContain("DTEND:20260818T130000Z");
  });

  it("échappe les virgules, points-virgules et retours à la ligne du titre", () => {
    const ics = buildEventIcs(item({ title: "Résumé, suite ; suite\nsuite" }));
    expect(ics).toContain("SUMMARY:Résumé\\, suite \\; suite\\nsuite");
  });

  it("transmet la récurrence RFC 5545 telle quelle", () => {
    const ics = buildEventIcs(item({ rrule: "FREQ=WEEKLY;BYDAY=TU" }));
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU");
  });

  it("écrit la priorité Brief (1 = la plus haute) en PRIORITY iCalendar", () => {
    expect(buildEventIcs(item({ priority: 1 }))).toContain("PRIORITY:1");
    expect(buildEventIcs(item({ priority: 4 }))).toContain("PRIORITY:4");
  });
});

describe("calendarForProject", () => {
  it("route chaque projet Brief vers son calendrier Apple", () => {
    expect(calendarForProject("frip-trend")).toBe("Vinted Frip&Trend");
    expect(calendarForProject("my-flip")).toBe("My Flip");
    expect(calendarForProject("perso")).toBe("Personnel");
    expect(calendarForProject("sport")).toBe("Sport");
    expect(calendarForProject("webacademie")).toBe("Web@académie");
    expect(calendarForProject("ia")).toBe("IA");
  });

  it("retombe sur Personnel pour un projet inconnu ou absent", () => {
    expect(calendarForProject("projet-inconnu")).toBe("Personnel");
    expect(calendarForProject(null)).toBe("Personnel");
    expect(calendarForProject(undefined)).toBe("Personnel");
  });
});