import { describe, expect, it } from "vitest";
import { shiftRangePatch } from "./TimelineView";
import type { Item } from "@/lib/types";

/**
 * `shiftRangePatch` écrit dans `due` et `startDate`. Ce qu'il écrit de travers
 * ne lève rien : la tâche se déplace, la synchro CalDAV réécrit sur iCloud, et
 * on découvre le dégât dans l'app Calendrier.
 */

function task(over: Partial<Item> = {}): Item {
  return {
    id: "it_1",
    kind: "task",
    title: "Tâche",
    projectId: "p1",
    due: "2026-09-09T16:00:00.000Z",
    allDay: false,
    priority: 3,
    rrule: null,
    createdAt: "2026-09-01T08:00:00.000Z",
    remindedAt: null,
    doneAt: null,
    ...over,
  };
}

describe("shiftRangePatch", () => {
  it("décale une échéance simple du bon nombre de jours", () => {
    expect(shiftRangePatch(task(), 2).due).toBe("2026-09-11T16:00:00.000Z");
  });

  it("décale les DEUX bornes d'une plage, pour la déplacer et non l'étirer", () => {
    const it = task({ startDate: "2026-09-09T08:00:00.000Z", due: "2026-09-11T16:00:00.000Z" });
    const patch = shiftRangePatch(it, 3);
    expect(patch.startDate).toBe("2026-09-12T08:00:00.000Z");
    expect(patch.due).toBe("2026-09-14T16:00:00.000Z");
  });

  it("garde l'heure au passage à l'heure d'hiver", () => {
    // Du 24 au 31 octobre 2026 : Paris passe de UTC+2 à UTC+1 dans l'intervalle.
    // Une addition de 7 × 86 400 000 ms décalerait la tâche d'une heure.
    const it = task({ due: "2026-10-24T16:00:00.000+02:00" });
    const patch = shiftRangePatch(it, 7);
    const moved = new Date(patch.due!);
    const hour = moved.toLocaleTimeString("fr-FR", { hour: "2-digit", timeZone: "Europe/Paris" });
    // `fr-FR` rend « 16 h » — c'est l'heure qui compte, pas le formatage.
    expect(hour.replace(/\D/g, "")).toBe("16");
  });

  it("ne rend RIEN sur une série récurrente", () => {
    // Sans cette garde, un glissement d'un jour déplaçait `due` de trois (il
    // repartait de l'occurrence déjà décalée par l'override), le posait hors de
    // la grille RRULE — une série du dimanche atterrissait un mercredi — et
    // laissait l'override pointer une occurrence disparue.
    const serie = task({
      due: "2026-09-06T10:00:00.000Z",
      rrule: "FREQ=WEEKLY;BYDAY=SU",
      seriesAnchor: "2026-08-30T10:00:00.000Z",
      overrides: { "20260906T100000Z": "20260908T100000Z" },
    });
    expect(shiftRangePatch(serie, 1)).toEqual({});
  });

  it("ne rend rien non plus sur une série SANS override", () => {
    expect(shiftRangePatch(task({ rrule: "FREQ=WEEKLY;BYDAY=MO" }), 1)).toEqual({});
  });

  it("n'invente pas de startDate quand l'item n'en a pas", () => {
    expect(shiftRangePatch(task(), 1).startDate).toBeUndefined();
  });

  it("ne touche à rien quand l'échéance est illisible", () => {
    expect(shiftRangePatch(task({ due: "20260909T160000" }), 1)).toEqual({});
  });
});
