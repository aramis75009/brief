import { describe, expect, it } from "vitest";
import { agree, plural } from "./plural";

describe("plural", () => {
  it("met le SINGULIER à zéro — la règle française qu'on rate toujours", () => {
    expect(plural(0, "tâche")).toBe("0 tâche");
  });

  it("met le singulier à un", () => {
    expect(plural(1, "tâche")).toBe("1 tâche");
  });

  it("met le pluriel au-delà", () => {
    expect(plural(2, "tâche")).toBe("2 tâches");
  });

  it("accepte une forme plurielle irrégulière", () => {
    expect(plural(3, "rendez-vous", "rendez-vous")).toBe("3 rendez-vous");
  });
});

describe("agree", () => {
  it("rend le mot seul, sans le nombre", () => {
    expect(agree(1, "terminée")).toBe("terminée");
    expect(agree(4, "terminée")).toBe("terminées");
    expect(agree(0, "terminée")).toBe("terminée");
  });
});
