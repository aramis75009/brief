import { describe, expect, it } from "vitest";
import { describeRrule, nextOccurrence, occurrencesInRange, parseRrule } from "./rrule";

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

describe("occurrencesInRange", () => {
  // Semaine du lundi 17 au dimanche 23 août 2026, bornes larges pour ne pas
  // dépendre du fuseau du test au niveau des extrémités.
  const weekStart = new Date("2026-08-16T22:00:00Z");
  const weekEnd = new Date("2026-08-23T22:00:00Z");

  it("rend TOUTES les occurrences de la semaine — pas une seule — pour une série lundi+jeudi", () => {
    // Séance push : FREQ=WEEKLY;BYDAY=MO,TH, ancrée un lundi 16h.
    const anchor = new Date("2026-08-17T16:00:00+02:00");
    const occs = occurrencesInRange(anchor, "FREQ=WEEKLY;BYDAY=MO,TH", weekStart, weekEnd);
    expect(occs.map((d) => d.toISOString())).toEqual([
      "2026-08-17T14:00:00.000Z", // lundi 16h Paris
      "2026-08-20T14:00:00.000Z", // jeudi 16h Paris
    ]);
  });

  it("étend une série quotidienne sur toute la fenêtre, avant ET après l'ancre", () => {
    // Ancrée le 19 (un jour quelconque de la série), la fenêtre couvre les 7
    // jours du 17 au 23 : la série existait déjà avant le 19, elle doit
    // apparaître sur toute la semaine, pas seulement à partir de l'ancre.
    const anchor = new Date("2026-08-19T09:00:00+02:00");
    expect(occurrencesInRange(anchor, "FREQ=DAILY", weekStart, weekEnd).length).toBe(7);
  });

  it("recule au-delà de l'ancre : un item dont le rappel a déjà avancé `due` au samedi montre quand même le mercredi qu'on regarde", () => {
    // Cas réel du 2026-08-19 : reminders.ts avance `due` dès l'envoi du
    // rappel, pas seulement à la coche — l'ancre pointe donc déjà samedi 22
    // alors qu'on affiche mercredi 19, jour de l'occurrence en cours.
    const advancedAnchor = new Date("2026-08-22T16:00:00+02:00");
    const wednesday = new Date("2026-08-18T22:00:00Z"); // 2026-08-19T00:00 Paris
    const wednesdayEnd = new Date("2026-08-19T22:00:00Z"); // 2026-08-20T00:00 Paris
    const occs = occurrencesInRange(advancedAnchor, "FREQ=WEEKLY;BYDAY=WE,SA", wednesday, wednesdayEnd);
    expect(occs).toEqual([new Date("2026-08-19T16:00:00+02:00")]);
  });

  it("inclut `start` même pour une règle non comprise — jamais un événement qui disparaît sur un doute", () => {
    const anchor = new Date("2026-08-20T08:00:00+02:00");
    const occs = occurrencesInRange(anchor, "n'importe quoi", weekStart, weekEnd);
    expect(occs).toHaveLength(1);
    expect(occs[0]).toEqual(anchor);
  });

  it("inclut `start` même pour un UNTIL déjà expiré — le calendrier gagne, on ne réinterprète pas", () => {
    const anchor = new Date("2026-08-20T08:00:00+02:00");
    const occs = occurrencesInRange(anchor, "FREQ=YEARLY;UNTIL=19191005T230000Z", weekStart, weekEnd);
    expect(occs).toEqual([anchor]);
  });

  it("exclut `start` s'il tombe hors de la fenêtre demandée", () => {
    const anchor = new Date("2026-08-01T09:00:00+02:00");
    const occs = occurrencesInRange(anchor, "FREQ=WEEKLY;BYDAY=SA", weekStart, weekEnd);
    // Le 1er août n'est pas dans la fenêtre ; seule l'occurrence du samedi 22 l'est.
    expect(occs).toEqual([new Date("2026-08-22T09:00:00+02:00")]);
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
