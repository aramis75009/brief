import { describe, expect, it } from "vitest";
import { compareByDue, formatDue, formatRelativeDue, isDueToday, resolveDue, toIsoWithOffset } from "./due";

/**
 * Ces tests couvrent le chantier que le pivot a déplacé : c'est Brief qui
 * résout les dates françaises, plus un service tiers. Une erreur ici ne se voit
 * pas à l'écran — elle se voit le jour où un rappel sonne au mauvais moment.
 */

/** Lundi 10 août 2026, 10h00, heure de Paris (heure d'été, +02:00). */
const MONDAY = new Date("2026-08-10T10:00:00+02:00");
/** Mardi 13 janvier 2026, 10h00, heure de Paris (heure d'hiver, +01:00). */
const WINTER = new Date("2026-01-13T10:00:00+01:00");

describe("toIsoWithOffset", () => {
  it("écrit le décalage d'été", () => {
    expect(toIsoWithOffset(MONDAY)).toBe("2026-08-10T10:00:00+02:00");
  });

  it("écrit le décalage d'hiver — le changement d'heure ne doit pas décaler les rappels", () => {
    expect(toIsoWithOffset(WINTER)).toBe("2026-01-13T10:00:00+01:00");
  });
});

describe("resolveDue", () => {
  it("rend null sur une chaîne vide", () => {
    expect(resolveDue("", MONDAY)).toBeNull();
  });

  it("rend null sur un libellé non reconnu — jamais une date approchée", () => {
    // Le point du test : une échéance absente se voit, une échéance fausse non.
    expect(resolveDue("un de ces quatre", MONDAY)).toBeNull();
    expect(resolveDue("plus tard", MONDAY)).toBeNull();
  });

  it("résout demain à 9 h par défaut, en journée entière", () => {
    const r = resolveDue("demain", MONDAY);
    expect(r?.due).toBe("2026-08-11T09:00:00+02:00");
    expect(r?.allDay).toBe(true);
  });

  it("respecte une heure explicite et sort du mode journée entière", () => {
    const r = resolveDue("demain 14h", MONDAY);
    expect(r?.due).toBe("2026-08-11T14:00:00+02:00");
    expect(r?.allDay).toBe(false);
  });

  it("lit les minutes", () => {
    expect(resolveDue("demain 9h30", MONDAY)?.due).toBe("2026-08-11T09:30:00+02:00");
  });

  it("après-demain avance de deux jours", () => {
    expect(resolveDue("après-demain", MONDAY)?.due).toBe("2026-08-12T09:00:00+02:00");
  });

  it("ce soir vise 19 h", () => {
    expect(resolveDue("ce soir", MONDAY)?.due).toBe("2026-08-10T19:00:00+02:00");
  });

  it("un jour de semaine vise la PROCHAINE occurrence, jamais aujourd'hui", () => {
    // Lundi + « lundi » doit donner le lundi suivant : sinon un rappel dit
    // « lundi » sonnerait dans l'heure.
    expect(resolveDue("lundi", MONDAY)?.due).toBe("2026-08-17T09:00:00+02:00");
    expect(resolveDue("vendredi", MONDAY)?.due).toBe("2026-08-14T09:00:00+02:00");
  });

  it("fin de mois vise le dernier jour", () => {
    expect(resolveDue("fin de mois", MONDAY)?.due).toBe("2026-08-31T09:00:00+02:00");
  });

  it("calcule dans le fuseau de Paris, pas dans celui de la machine", () => {
    // Non-régression du bug du 2026-08-14 : `atHour` posait l'heure avec
    // `setHours()`, c'est-à-dire dans le fuseau de la MACHINE. Sur le VPS, qui
    // tourne en UTC, « demain » sonnait à 11 h au lieu de 9 h. La suite est
    // désormais forcée en UTC (voir `vitest.config.mts`), donc ce test échoue
    // si quelqu'un réintroduit une méthode `Date` locale dans ce module.
    expect(resolveDue("demain", WINTER)?.due).toBe("2026-01-14T09:00:00+01:00");
    expect(resolveDue("vendredi", WINTER)?.due).toBe("2026-01-16T09:00:00+01:00");
  });

  it("suit le jour de Paris quand il diffère du jour UTC", () => {
    // 00 h 30 à Paris le 11, mais encore le 10 en UTC. « Demain » doit viser le
    // 12 : lire le calendrier dans le mauvais fuseau ferait perdre un jour
    // entier à toute échéance saisie après minuit.
    const nuit = new Date("2026-08-10T22:30:00Z");
    expect(resolveDue("demain", nuit)?.due).toBe("2026-08-12T09:00:00+02:00");
  });

  it("traverse le changement d'heure sans décaler l'heure de rappel", () => {
    // Le 10 mars est en heure d'hiver (+01:00), le 31 en heure d'été (+02:00) :
    // la bascule 2026 tombe le 29 mars. L'échéance doit rester à 9 h locales,
    // pas glisser à 8 h ou 10 h.
    const mars = new Date("2026-03-10T10:00:00+01:00");
    expect(resolveDue("fin de mois", mars)?.due).toBe("2026-03-31T09:00:00+02:00");
  });

  it("laisse passer une date déjà absolue sans la retoucher", () => {
    const r = resolveDue("2026-12-24T18:30:00+01:00", MONDAY);
    expect(r?.due).toBe("2026-12-24T18:30:00+01:00");
  });

  it("rejette une date absolue impossible plutôt que de l'accepter", () => {
    expect(resolveDue("2026-02-31T10:00:00+01:00", MONDAY)).toBeNull();
  });
});

describe("formatDue", () => {
  it("dit clairement l'absence d'échéance", () => {
    expect(formatDue(null, true)).toBe("Pas d'échéance");
  });

  it("masque l'heure en journée entière", () => {
    expect(formatDue("2026-08-11T09:00:00+02:00", true)).not.toContain(":");
  });

  it("affiche l'heure quand elle compte", () => {
    expect(formatDue("2026-08-11T14:00:00+02:00", false)).toContain("14:00");
  });

  it("signale une date illisible au lieu d'afficher Invalid Date", () => {
    expect(formatDue("n'importe quoi", false)).toBe("Échéance illisible");
  });

  describe("formatRelativeDue", () => {
    const fixedNow = new Date("2026-08-15T12:00:00+02:00");

    it("identifie aujourd'hui avec heure", () => {
      const res = formatRelativeDue("2026-08-15T20:00:00+02:00", false, fixedNow);
      expect(res.tone).toBe("today");
      expect(res.label).toBe("Aujourd'hui · 20:00");
    });

    it("identifie demain", () => {
      const res = formatRelativeDue("2026-08-16T09:00:00+02:00", true, fixedNow);
      expect(res.tone).toBe("tomorrow");
      expect(res.label).toBe("Demain");
    });

    it("identifie après-demain", () => {
      const res = formatRelativeDue("2026-08-17T14:30:00+02:00", false, fixedNow);
      expect(res.tone).toBe("future");
      expect(res.label).toBe("Après-demain · 14:30");
    });

    it("identifie en retard / hier", () => {
      const res = formatRelativeDue("2026-08-14T09:00:00+02:00", true, fixedNow);
      expect(res.tone).toBe("overdue");
      expect(res.label).toBe("Hier");
    });
  });
});

describe("isDueToday", () => {
  // Mercredi 19 août 2026, n'importe quelle heure de la journée à Paris.
  const now = new Date("2026-08-19T10:00:00+02:00");

  it("une tâche aujourd'hui à 20:15 (Paris) compte, quelle que soit l'heure", () => {
    expect(isDueToday("2026-08-19T20:15:00+02:00", now)).toBe(true);
  });

  it("une tâche demain ne compte pas", () => {
    expect(isDueToday("2026-08-20T09:00:00+02:00", now)).toBe(false);
  });

  it("sans échéance, ce n'est jamais aujourd'hui", () => {
    expect(isDueToday(null, now)).toBe(false);
  });

  it("une échéance illisible n'est jamais aujourd'hui", () => {
    expect(isDueToday("pas-une-date", now)).toBe(false);
  });

  it("21h30 UTC (23h30 à Paris) reste le 19 — la comparaison doit lire l'heure française", () => {
    expect(isDueToday("2026-08-19T21:30:00Z", now)).toBe(true);
  });

  it("22h30 UTC (00h30 le 20 à Paris) devient DEMAIN — le fuseau français décide, jamais l'UTC brut", () => {
    expect(isDueToday("2026-08-19T22:30:00Z", now)).toBe(false);
  });

  it("23h30 UTC la veille (01h30 à Paris le 19) compte comme aujourd'hui", () => {
    expect(isDueToday("2026-08-18T23:30:00Z", now)).toBe(true);
  });
});

describe("compareByDue", () => {
  it("trie par échéance croissante — la plus proche d'abord", () => {
    const items = [
      { due: "2026-08-25T00:00:00Z" },
      { due: "2026-08-20T00:00:00Z" },
      { due: "2026-08-22T00:00:00Z" },
    ];
    expect(items.sort(compareByDue).map((i) => i.due)).toEqual([
      "2026-08-20T00:00:00Z",
      "2026-08-22T00:00:00Z",
      "2026-08-25T00:00:00Z",
    ]);
  });

  it("relègue les items sans échéance à la fin", () => {
    const items = [{ due: null }, { due: "2026-08-20T00:00:00Z" }, { due: null }];
    const sorted = items.sort(compareByDue);
    expect(sorted[0].due).toBe("2026-08-20T00:00:00Z");
    expect(sorted[1].due).toBeNull();
    expect(sorted[2].due).toBeNull();
  });

  it("une échéance illisible est traitée comme une absence d'échéance", () => {
    const items = [{ due: "n'importe quoi" }, { due: "2026-08-20T00:00:00Z" }];
    expect(items.sort(compareByDue)[0].due).toBe("2026-08-20T00:00:00Z");
  });
});
