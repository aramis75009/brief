import { describe, expect, it } from "vitest";
import { describeRrule, nextOccurrence, parseRrule } from "./rrule";

/**
 * La récurrence est le coin le moins interopérable de la RFC 5545, et une règle
 * mal évaluée fait apparaître une tâche le mauvais jour, chaque semaine, sans
 * que rien ne le signale. D'où ces tests.
 */

const TUESDAY_9H = new Date("2026-08-11T09:00:00+02:00");

describe("parseRrule", () => {
  it("lit une règle hebdomadaire", () => {
    expect(parseRrule("FREQ=WEEKLY;BYDAY=TU")).toMatchObject({ freq: "WEEKLY", byDay: [2] });
  });

  it("lit l'intervalle", () => {
    expect(parseRrule("FREQ=DAILY;INTERVAL=3")?.interval).toBe(3);
  });

  it("refuse une fréquence inconnue plutôt que de deviner", () => {
    expect(parseRrule("FREQ=FORTNIGHTLY")).toBeNull();
    expect(parseRrule("BYDAY=TU")).toBeNull();
  });

  it("refuse un intervalle absurde", () => {
    expect(parseRrule("FREQ=DAILY;INTERVAL=0")).toBeNull();
  });

  it("lit UNTIL au format RFC", () => {
    expect(parseRrule("FREQ=WEEKLY;UNTIL=20260901T000000Z")?.until?.toISOString())
      .toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("nextOccurrence", () => {
  it("avance d'une semaine et conserve l'heure", () => {
    const next = nextOccurrence(TUESDAY_9H, "FREQ=WEEKLY;BYDAY=TU", TUESDAY_9H);
    expect(next?.toISOString()).toBe(new Date("2026-08-18T09:00:00+02:00").toISOString());
  });

  it("reste aligné sur l'origine même si le rappel part en retard", () => {
    // Point critique : on avance depuis `start`, pas depuis `from`. Sinon un
    // envoi tardif décalerait toute la série, définitivement.
    const late = new Date("2026-08-11T23:00:00+02:00");
    const next = nextOccurrence(TUESDAY_9H, "FREQ=WEEKLY;BYDAY=TU", late);
    expect(next?.toISOString()).toBe(new Date("2026-08-18T09:00:00+02:00").toISOString());
  });

  it("rattrape plusieurs occurrences manquées d'un coup", () => {
    const threeWeeksLater = new Date("2026-09-01T12:00:00+02:00");
    const next = nextOccurrence(TUESDAY_9H, "FREQ=WEEKLY;BYDAY=TU", threeWeeksLater);
    expect(next?.toISOString()).toBe(new Date("2026-09-08T09:00:00+02:00").toISOString());
  });

  it("gère plusieurs jours dans la semaine", () => {
    const next = nextOccurrence(TUESDAY_9H, "FREQ=WEEKLY;BYDAY=TU,TH", TUESDAY_9H);
    expect(next?.toISOString()).toBe(new Date("2026-08-13T09:00:00+02:00").toISOString());
  });

  it("gère le quotidien avec intervalle", () => {
    const next = nextOccurrence(TUESDAY_9H, "FREQ=DAILY;INTERVAL=3", TUESDAY_9H);
    expect(next?.toISOString()).toBe(new Date("2026-08-14T09:00:00+02:00").toISOString());
  });

  it("gère le mensuel", () => {
    const next = nextOccurrence(TUESDAY_9H, "FREQ=MONTHLY", TUESDAY_9H);
    expect(next?.toISOString()).toBe(new Date("2026-09-11T09:00:00+02:00").toISOString());
  });

  it("s'arrête après UNTIL au lieu de continuer indéfiniment", () => {
    expect(nextOccurrence(TUESDAY_9H, "FREQ=WEEKLY;BYDAY=TU;UNTIL=20260815T000000Z", TUESDAY_9H))
      .toBeNull();
  });

  it("rend null sur une règle non comprise — la série s'arrête au lieu de dériver", () => {
    expect(nextOccurrence(TUESDAY_9H, "n'importe quoi", TUESDAY_9H)).toBeNull();
  });
});

describe("describeRrule", () => {
  it("décrit en français", () => {
    expect(describeRrule("FREQ=WEEKLY;BYDAY=TU")).toBe("tous les mardis");
    expect(describeRrule("FREQ=DAILY")).toBe("tous les jours");
    expect(describeRrule("FREQ=DAILY;INTERVAL=3")).toBe("toutes les 3 jours");
  });

  it("rend null si la règle n'est pas comprise", () => {
    expect(describeRrule("FREQ=NEVER")).toBeNull();
  });
});
