import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, applySettingsPatch, normalizeSettings } from "./settings";
import type { Settings } from "./settings";

/**
 * Les réglages pilotent des services qui tournent sans surveillance (la synchro
 * CalDAV, le récap du matin). Une lecture qui échoue en silence les éteindrait
 * sans que rien ne le signale — d'où le paquet de tests sur la tolérance.
 */
describe("normalizeSettings — tout ce qui n'est pas un booléen retombe sur le défaut ON", () => {
  it("garde des réglages valides tels quels", () => {
    expect(normalizeSettings({ caldavSync: false, digest: true })).toEqual({
      caldavSync: false,
      digest: true,
    });
  });

  it("rend les défauts (ON) sur un fichier absent", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("rend les défauts (ON) sur du JSON qui n'est pas un objet", () => {
    expect(normalizeSettings("caldavSync=false")).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings([])).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it("complète champ par champ — un réglage absent ne perd pas l'autre", () => {
    expect(normalizeSettings({ caldavSync: false })).toEqual({
      caldavSync: false,
      digest: true,
    });
  });

  it("ignore un champ mal typé plutôt que de le croire", () => {
    // `"false"` est une chaîne VRAIE en JavaScript : la lire naïvement
    // ALLUMERAIT un réglage que l'utilisateur voulait éteindre, ou l'inverse.
    expect(normalizeSettings({ caldavSync: "false", digest: 0 })).toEqual(DEFAULT_SETTINGS);
  });

  it("laisse tomber les clés inconnues", () => {
    expect(normalizeSettings({ caldavSync: true, digest: true, pin: true })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it("les défauts sont ON — un déploiement sur volume neuf ne coupe aucun service", () => {
    expect(DEFAULT_SETTINGS).toEqual({ caldavSync: true, digest: true });
  });
});

describe("applySettingsPatch", () => {
  const current: Settings = { caldavSync: true, digest: true };

  it("applique un patch partiel sans toucher au reste", () => {
    expect(applySettingsPatch(current, { digest: false })).toEqual({
      caldavSync: true,
      digest: false,
    });
  });

  it("rend la MÊME référence quand rien ne change — l'écriture disque est sautée", () => {
    expect(applySettingsPatch(current, { caldavSync: true })).toBe(current);
    expect(applySettingsPatch(current, {})).toBe(current);
    expect(applySettingsPatch(current, { inconnu: false })).toBe(current);
  });

  it("ignore les valeurs non booléennes plutôt que de les convertir", () => {
    expect(applySettingsPatch(current, { digest: "non" })).toBe(current);
    expect(applySettingsPatch(current, { digest: null })).toBe(current);
  });

  it("ignore un corps qui n'est pas un objet", () => {
    expect(applySettingsPatch(current, null)).toBe(current);
    expect(applySettingsPatch(current, "digest=false")).toBe(current);
  });

  it("applique les deux réglages d'un coup", () => {
    expect(applySettingsPatch(current, { caldavSync: false, digest: false })).toEqual({
      caldavSync: false,
      digest: false,
    });
  });
});
