import { describe, expect, it } from "vitest";
import { coerce } from "./route";

/**
 * `coerce` — la porte d'entrée des items créés.
 *
 * Ce qu'elle laisse tomber est PERDU SANS BRUIT : la requête répond 200, le
 * client croit avoir enregistré, et le champ n'existe nulle part. C'est
 * exactement ce qui arrivait à `dependsOn` jusqu'au 2026-09-07 — découvert en
 * recette parce que la chronologie s'est mise à dessiner les flèches de
 * dépendance et n'en trouvait aucune.
 */

const KNOWN = new Set(["frip-trend", "sport"]);
const FALLBACK = "perso";

function base(over: Record<string, unknown> = {}) {
  return { id: "it_1", title: "Une tâche", projectId: "frip-trend", ...over };
}

describe("coerce — champs de liaison", () => {
  it("conserve les dépendances", () => {
    expect(coerce(base({ dependsOn: ["it_a", "it_b"] }), KNOWN, FALLBACK)?.dependsOn).toEqual([
      "it_a",
      "it_b",
    ]);
  });

  it("conserve les étiquettes et l'objectif", () => {
    const out = coerce(base({ tags: ["t1"], objectiveId: "obj-1" }), KNOWN, FALLBACK);
    expect(out?.tags).toEqual(["t1"]);
    expect(out?.objectiveId).toBe("obj-1");
  });

  it("rend `undefined` — pas un tableau vide — quand rien n'est fourni", () => {
    const out = coerce(base(), KNOWN, FALLBACK);
    expect(out?.dependsOn).toBeUndefined();
    expect(out?.tags).toBeUndefined();
  });

  it("écarte les entrées vides ou non textuelles sans jeter le reste", () => {
    expect(coerce(base({ dependsOn: ["  ", 42, null, " it_a "] }), KNOWN, FALLBACK)?.dependsOn).toEqual([
      "it_a",
    ]);
  });

  it("plafonne les dépendances à 20 et les étiquettes à 10", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => `x${i}`);
    expect(coerce(base({ dependsOn: many(50) }), KNOWN, FALLBACK)?.dependsOn).toHaveLength(20);
    expect(coerce(base({ tags: many(50) }), KNOWN, FALLBACK)?.tags).toHaveLength(10);
  });

  it("ignore une valeur qui n'est pas un tableau", () => {
    expect(coerce(base({ dependsOn: "it_a" }), KNOWN, FALLBACK)?.dependsOn).toBeUndefined();
  });
});

describe("coerce — plage de dates", () => {
  it("conserve un startDate lisible", () => {
    const out = coerce(base({ startDate: "2026-09-09T08:00:00.000Z" }), KNOWN, FALLBACK);
    expect(out?.startDate).toBe("2026-09-09T08:00:00.000Z");
  });

  it("rend null sur un startDate illisible plutôt qu'une date approchée", () => {
    // Le DTSTART flottant qui avait fait planter toute l'app le 2026-08-19.
    expect(coerce(base({ startDate: "20260909T080000" }), KNOWN, FALLBACK)?.startDate).toBeNull();
  });

  it("rend null sur une date qui n'existe pas au calendrier", () => {
    // `new Date("2026-02-31")` ne lève pas : JavaScript déborde sur mars.
    expect(coerce(base({ startDate: "2026-02-31T08:00:00.000Z" }), KNOWN, FALLBACK)?.startDate).toBeNull();
  });
});

describe("coerce — garde-fous existants", () => {
  it("refuse un item sans titre ou sans identifiant", () => {
    expect(coerce({ id: "it_1", title: "  " }, KNOWN, FALLBACK)).toBeNull();
    expect(coerce({ title: "Sans id" }, KNOWN, FALLBACK)).toBeNull();
  });

  it("bascule un projet inconnu sur le repli", () => {
    expect(coerce(base({ projectId: "nexistepas" }), KNOWN, FALLBACK)?.projectId).toBe(FALLBACK);
  });
});
