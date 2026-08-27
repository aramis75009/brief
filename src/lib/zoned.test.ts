import { describe, expect, it } from "vitest";
import { zonedParts } from "./zoned";

describe("zonedParts", () => {
  it("renvoie les composantes d'une date valide dans le fuseau Paris", () => {
    const parts = zonedParts(new Date("2026-08-19T12:30:00Z"));
    // 12:30 UTC = 14:30 à Paris (été, UTC+2)
    expect(parts).toMatchObject({ y: 2026, m: 8, d: 19, hour: 14, minute: 30 });
  });

  it("ne lève JAMAIS d'exception sur une date invalide (RangeError formatToParts, prod 2026-08-19)", () => {
    expect(() => zonedParts(new Date("20260820T140000"))).not.toThrow();
    const parts = zonedParts(new Date("pas-une-date"));
    // Sentinelle : année/mois/jour 0, heure/minute -1 — les appelants traitent
    // ces valeurs comme « aucune date » (aucun item ne matche un jour 0).
    expect(parts).toEqual({ y: 0, m: 0, d: 0, weekday: -1, hour: -1, minute: -1 });
  });
});