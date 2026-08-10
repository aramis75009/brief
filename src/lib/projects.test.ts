import { describe, expect, it } from "vitest";
import { PRIORITIES, PRIORITY_VALUES, inboxIdOf, isPriority, skinFor, tintFromId } from "./projects";
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
    expect(first).toBeLessThanOrEqual(5);
  });

  it("chaque projet d'amorçage a une teinte distincte", () => {
    const tints = SEED_PROJECTS.map((p) => p.tint);
    expect(new Set(tints).size).toBe(tints.length);
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
