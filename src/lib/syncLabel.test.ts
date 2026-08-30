import { describe, expect, it } from "vitest";
import { relativeSyncLabel } from "./syncLabel";

const NOW = Date.parse("2026-08-30T21:00:00.000Z");
const minutesAgo = (n: number) => NOW - n * 60_000;

describe("relativeSyncLabel", () => {
  it("dit franchement qu'on ne sait pas quand la valeur est absente", () => {
    // Le 2026-08-30, l'écran Réglages affichait « jamais synchronisé » alors
    // que la synchro tournait toutes les 15 min : personne n'allait chercher
    // `lastSyncAt`. Un texte rassurant par défaut aurait caché la panne.
    expect(relativeSyncLabel(null, NOW)).toBe("jamais synchronisé");
  });

  it("moins d'une minute", () => {
    expect(relativeSyncLabel(NOW, NOW)).toBe("à l’instant");
    expect(relativeSyncLabel(minutesAgo(0.4), NOW)).toBe("à l’instant");
  });

  it("en minutes sous l'heure", () => {
    expect(relativeSyncLabel(minutesAgo(1), NOW)).toBe("il y a 1 min");
    expect(relativeSyncLabel(minutesAgo(14), NOW)).toBe("il y a 14 min");
    expect(relativeSyncLabel(minutesAgo(59), NOW)).toBe("il y a 59 min");
  });

  it("en heures au-delà", () => {
    expect(relativeSyncLabel(minutesAgo(60), NOW)).toBe("il y a 1 h");
    expect(relativeSyncLabel(minutesAgo(200), NOW)).toBe("il y a 3 h");
  });

  it("ne rend jamais une durée négative si l'horloge du serveur est en avance", () => {
    expect(relativeSyncLabel(NOW + 90_000, NOW)).toBe("à l’instant");
  });
});
