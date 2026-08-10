import { describe, expect, it } from "vitest";
import {
  PRIORITIES,
  PRIORITY_VALUES,
  inboxIdOf,
  isPriority,
  shapeFor,
  shapeFromId,
  skinFor,
  tintFromId,
} from "./projects";
import { SEED_PROJECTS } from "./projects";

describe("priorités", () => {
  it("1 est la plus haute — l'inverse de l'échelle d'où vient ce projet", () => {
    // Ce test existe pour qu'une réintroduction accidentelle de l'échelle
    // Todoist (4 = urgente) casse quelque chose de bruyant.
    expect(PRIORITY_VALUES[0]).toBe(1);
    expect(PRIORITIES[1].long).toContain("Urgent");
    expect(PRIORITIES[4].long).toContain("défaut");
  });

  it("refuse les valeurs hors échelle", () => {
    expect(isPriority(0)).toBe(false);
    expect(isPriority(5)).toBe(false);
    expect(isPriority("1")).toBe(false);
    expect(isPriority(1)).toBe(true);
  });
});

describe("teintes de projet", () => {
  it("rend des variables CSS, jamais des hexadécimaux — sinon pas de mode sombre", () => {
    const skin = skinFor({ id: "inbox", tint: 3 });
    expect(skin.bg).toBe("var(--color-p3)");
    expect(skin.fg).toBe("var(--color-p3-ink)");
  });

  it("dérive une teinte STABLE d'un id inconnu", () => {
    // Un projet qui changerait de couleur d'une session à l'autre rendrait la
    // vision globale illisible : c'est la couleur qu'on apprend, pas le nom.
    const first = tintFromId("un-projet-quelconque");
    expect(tintFromId("un-projet-quelconque")).toBe(first);
    expect(first).toBeGreaterThanOrEqual(1);
    expect(first).toBeLessThanOrEqual(8);
  });

  it("chaque projet d'amorçage a une teinte distincte", () => {
    const tints = SEED_PROJECTS.map((p) => p.tint);
    expect(new Set(tints).size).toBe(tints.length);
  });
});

describe("formes de projet", () => {
  it("dérive une forme STABLE d'un id inconnu", () => {
    const first = shapeFromId("un-projet-quelconque");
    expect(shapeFromId("un-projet-quelconque")).toBe(first);
  });

  it("respecte la forme explicite d'un projet plutôt que le hachage", () => {
    // Sans ça, renommer un projet en changerait la pastille — or c'est la
    // pastille qu'on apprend à reconnaître, pas le libellé.
    expect(shapeFor({ id: "n-importe-quoi", shape: "capsule" })).toBe("capsule");
  });

  it("chaque projet d'amorçage a une forme distincte", () => {
    const shapes = SEED_PROJECTS.map((p) => shapeFor(p));
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("couvre 40 couples teinte+forme avant de se répéter", () => {
    // C'est la promesse qui remplace le plafond de cinq projets : si le calcul
    // dégénère (par exemple teinte et forme dérivées du même rang de hachage),
    // le nombre de couples uniques s'effondre et ce test le dit.
    const couples = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const id = `projet-${i}`;
      couples.add(`${tintFromId(id)}-${shapeFromId(id)}`);
    }
    expect(couples.size).toBe(40);
  });
});

describe("inboxIdOf", () => {
  it("trouve l'inbox", () => {
    expect(inboxIdOf(SEED_PROJECTS)).toBe("inbox");
  });

  it("se rabat sur le premier projet si l'inbox a disparu", () => {
    expect(inboxIdOf([{ id: "autre", name: "Autre", tint: 1 }])).toBe("autre");
  });

  it("ne renvoie jamais undefined, même sans aucun projet", () => {
    // L'appelant range l'item quelque part : un id vide perdrait la tâche.
    expect(inboxIdOf([])).toBe("inbox");
  });
});
