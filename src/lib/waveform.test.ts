import { describe, expect, it } from "vitest";
import { levelForBar } from "./waveform";

/**
 * Régression du 2026-08-25 : la waveform de l'écran de capture était figée.
 *
 * Deux défauts empilés. Le second est couvert ici : `useRecorder` produit 4
 * niveaux et le dessin compte 20 barres, donc il faut une interpolation. Sans
 * elle, brancher `levels` directement donnerait 4 barres au lieu de 20 — ou,
 * pire, des hauteurs de 0.35 pixel si on confondait un niveau (0→1) avec une
 * hauteur en pixels (14→74), ce qui referait exactement le symptôme observé :
 * des barres plates qui ne bougent pas.
 *
 * Le premier défaut (les niveaux jamais transmis de BriefApp à CaptureSheet)
 * n'est pas testable ici : la suite tourne sans DOM. Il est vérifié dans le
 * navigateur, cf. la passation du 25/08.
 */
describe("levelForBar", () => {
  const FLOOR = 0.35;

  it("étale 4 niveaux mesurés sur les 20 barres du dessin", () => {
    const levels = [0.4, 0.8, 0.6, 1];
    const spread = Array.from({ length: 20 }, (_, i) => levelForBar(levels, i, 20));

    expect(spread).toHaveLength(20);
    // Les extrémités collent aux niveaux mesurés, pas à une valeur inventée.
    expect(spread[0]).toBeCloseTo(0.4, 5);
    expect(spread[19]).toBeCloseTo(1, 5);
    // Aucune barre ne sort de l'enveloppe mesurée.
    for (const value of spread) {
      expect(value).toBeGreaterThanOrEqual(0.4);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("interpole entre deux bandes au lieu de créer des marches", () => {
    const levels = [0, 1];
    // Le milieu exact doit valoir la moyenne : c'est ce qui distingue une onde
    // d'un escalier à quatre marches.
    expect(levelForBar(levels, 5, 11)).toBeCloseTo(0.5, 5);
    expect(levelForBar(levels, 0, 11)).toBeCloseTo(0, 5);
    expect(levelForBar(levels, 10, 11)).toBeCloseTo(1, 5);
  });

  it("reste au plancher dans le silence, jamais à zéro", () => {
    const silence = new Array(4).fill(FLOOR);
    for (let i = 0; i < 20; i++) {
      expect(levelForBar(silence, i, 20)).toBeCloseTo(FLOOR, 5);
    }
  });

  it("ne s'effondre pas sur un tableau vide ou d'un seul niveau", () => {
    // Tableau vide : pleine échelle, la barre garde sa hauteur dessinée.
    expect(levelForBar([], 3, 20)).toBe(1);
    // Un seul niveau : toutes les barres le suivent.
    expect(levelForBar([0.62], 0, 20)).toBeCloseTo(0.62, 5);
    expect(levelForBar([0.62], 19, 20)).toBeCloseTo(0.62, 5);
  });

  it("ne déborde pas quand l'index dépasse le nombre de barres", () => {
    const levels = [0.2, 0.9];
    expect(levelForBar(levels, 99, 20)).toBeCloseTo(0.9, 5);
  });

  it("supporte un total de 1 barre sans division par zéro", () => {
    expect(Number.isFinite(levelForBar([0.5, 0.7], 0, 1))).toBe(true);
  });
});
