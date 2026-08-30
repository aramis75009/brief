import { describe, expect, it } from "vitest";
import { cleanDeps } from "./route";

/**
 * `cleanDeps` décide ce qu'un `PATCH /api/objectives { dependsOn }` a le droit
 * d'enregistrer. Même esprit que `sanitizePatch` pour les items : on nettoie
 * ici, on résout (existe / n'existe pas) plus tard dans `effectiveDeps`.
 */
describe("cleanDeps", () => {
  it("garde les chaînes non vides, ids d'items et d'objectifs mêlés", () => {
    expect(cleanDeps(["t1", "obj:o2", "t3"], "o1")).toEqual(["t1", "obj:o2", "t3"]);
  });

  it("retire l'auto-référence obj:<ownId>", () => {
    expect(cleanDeps(["t1", "obj:o1", "obj:o2"], "o1")).toEqual(["t1", "obj:o2"]);
  });

  it("retire les non-chaînes et les chaînes blanches, trim le reste", () => {
    expect(cleanDeps(["  t1  ", 42, null, "", "   ", "t2"], "o1")).toEqual(["t1", "t2"]);
  });

  it("plafonne à 40", () => {
    const many = Array.from({ length: 60 }, (_, i) => `t${i}`);
    expect(cleanDeps(many, "o1")).toHaveLength(40);
  });

  it("renvoie undefined si ce n'est pas un tableau (champ absent = on ne touche pas)", () => {
    expect(cleanDeps(undefined, "o1")).toBeUndefined();
    expect(cleanDeps("t1", "o1")).toBeUndefined();
  });
});
