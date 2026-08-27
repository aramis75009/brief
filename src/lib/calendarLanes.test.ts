import { describe, expect, it } from "vitest";
import { layoutDayLanes, type LaneInput } from "./calendarLanes";

/**
 * Régression du 2026-08-25 : dans la grille semaine desktop, les événements du
 * même créneau se recouvraient au lieu de se partager la largeur du jour, alors
 * que DESIGN.md §7 règle 2 l'interdit explicitement.
 *
 * L'invariant central est testé ici : deux événements qui se croisent n'ont
 * JAMAIS la même voie dans le même groupe.
 */

const ev = (id: string, startMin: number, durationMin: number): LaneInput => ({ id, startMin, durationMin });

/** Deux placements se recouvrent-ils dans le temps ET dans l'espace ? */
function collides(a: LaneInput, b: LaneInput, la: number, lb: number): boolean {
  const endA = a.startMin + Math.max(30, a.durationMin);
  const endB = b.startMin + Math.max(30, b.durationMin);
  const overlapInTime = a.startMin < endB && b.startMin < endA;
  return overlapInTime && la === lb;
}

describe("layoutDayLanes", () => {
  it("ne rend rien pour une journée vide", () => {
    expect(layoutDayLanes([])).toEqual([]);
  });

  it("laisse un événement seul occuper toute la largeur", () => {
    const [p] = layoutDayLanes([ev("a", 120, 60)]);
    expect(p.lane).toBe(0);
    expect(p.lanes).toBe(1);
    expect(p.hidden).toBe(false);
    expect(p.overflow).toBe(0);
  });

  it("donne deux voies à deux événements sur le même créneau", () => {
    const placements = layoutDayLanes([ev("a", 120, 60), ev("b", 120, 60)]);
    expect(placements.map((p) => p.lanes)).toEqual([1, 1].map(() => 2));
    expect(new Set(placements.map((p) => p.lane))).toEqual(new Set([0, 1]));
  });

  it("garde une seule voie pour deux événements qui ne se croisent pas", () => {
    // 9h→10h puis 10h→11h : ils se touchent sans se croiser.
    const placements = layoutDayLanes([ev("a", 120, 60), ev("b", 180, 60)]);
    for (const p of placements) {
      expect(p.lanes).toBe(1);
      expect(p.lane).toBe(0);
    }
  });

  it("sépare deux groupes indépendants dans la même journée", () => {
    const placements = layoutDayLanes([
      ev("a", 60, 60),
      ev("b", 60, 60), // croise a → groupe 0, 2 voies
      ev("c", 300, 60), // seul → groupe 1, 1 voie
    ]);
    const byId = new Map(placements.map((p) => [p.id, p]));
    expect(byId.get("a")!.cluster).toBe(0);
    expect(byId.get("b")!.cluster).toBe(0);
    expect(byId.get("c")!.cluster).toBe(1);
    expect(byId.get("c")!.lanes).toBe(1);
  });

  it("ne met jamais deux événements qui se croisent dans la même voie", () => {
    const events = [
      ev("a", 0, 90),
      ev("b", 30, 90),
      ev("c", 45, 30),
      ev("d", 60, 120),
      ev("e", 200, 60),
      ev("f", 210, 30),
      ev("g", 215, 45),
    ];
    const placements = layoutDayLanes(events, Infinity);
    const byId = new Map(placements.map((p) => [p.id, p]));

    for (const a of events) {
      for (const b of events) {
        if (a.id >= b.id) continue;
        const pa = byId.get(a.id)!;
        const pb = byId.get(b.id)!;
        if (pa.cluster !== pb.cluster) continue;
        expect(collides(a, b, pa.lane, pb.lane)).toBe(false);
      }
    }
  });

  it("rend toute la largeur à un événement qui ne croise plus personne", () => {
    // a 0→60 et b 0→60 se partagent la largeur ; c démarre pile à 60, donc il ne
    // croise ni l'un ni l'autre : il ouvre son propre groupe et reprend tout.
    // C'est le comportement de Google Calendar, pas une largeur gaspillée.
    const placements = layoutDayLanes([ev("a", 0, 60), ev("b", 0, 60), ev("c", 60, 30)]);
    const byId = new Map(placements.map((p) => [p.id, p]));
    expect(byId.get("a")!.lanes).toBe(2);
    expect(byId.get("b")!.lanes).toBe(2);
    expect(byId.get("c")!.cluster).toBe(1);
    expect(byId.get("c")!.lane).toBe(0);
    expect(byId.get("c")!.lanes).toBe(1);
  });

  it("réutilise une voie libérée à l'intérieur d'un groupe", () => {
    // a couvre 0→120, b 0→60 prend la voie 1 puis la libère ; c 60→90 croise
    // encore a, donc reste dans le groupe et reprend la voie 1.
    const placements = layoutDayLanes([ev("a", 0, 120), ev("b", 0, 60), ev("c", 60, 30)]);
    const byId = new Map(placements.map((p) => [p.id, p]));
    expect(byId.get("a")!.lane).toBe(0);
    expect(byId.get("b")!.lane).toBe(1);
    expect(byId.get("c")!.cluster).toBe(0);
    expect(byId.get("c")!.lane).toBe(1);
    expect(byId.get("c")!.lanes).toBe(2);
  });

  it("compte un événement sans durée comme un créneau de 30 min", () => {
    // Deux événements à 15 min d'écart, durée 0 : ils se croisent quand même.
    const placements = layoutDayLanes([ev("a", 0, 0), ev("b", 15, 0)]);
    expect(new Set(placements.map((p) => p.lane))).toEqual(new Set([0, 1]));
  });

  it("place le plus long à gauche quand deux événements démarrent ensemble", () => {
    const placements = layoutDayLanes([ev("court", 0, 30), ev("long", 0, 120)]);
    const byId = new Map(placements.map((p) => [p.id, p]));
    expect(byId.get("long")!.lane).toBe(0);
    expect(byId.get("court")!.lane).toBe(1);
  });

  it("plafonne les voies visibles et compte le débordement", () => {
    // Cinq événements simultanés, plafond à 3.
    const events = Array.from({ length: 5 }, (_, i) => ev(`e${i}`, 60, 60));
    const placements = layoutDayLanes(events, 3);
    expect(placements.every((p) => p.lanes === 3)).toBe(true);
    expect(placements.filter((p) => p.hidden)).toHaveLength(2);
    expect(placements.every((p) => p.overflow === 2)).toBe(true);
    // Les trois visibles occupent bien les voies 0, 1, 2.
    expect(new Set(placements.filter((p) => !p.hidden).map((p) => p.lane))).toEqual(new Set([0, 1, 2]));
  });

  it("ne replie rien quand le plafond est levé", () => {
    const events = Array.from({ length: 5 }, (_, i) => ev(`e${i}`, 60, 60));
    const placements = layoutDayLanes(events, Infinity);
    expect(placements.every((p) => !p.hidden)).toBe(true);
    expect(placements.every((p) => p.lanes === 5)).toBe(true);
    expect(placements.every((p) => p.overflow === 0)).toBe(true);
  });

  it("est déterministe : deux appels donnent le même plan", () => {
    const events = [ev("b", 30, 90), ev("a", 0, 90), ev("c", 45, 30)];
    expect(layoutDayLanes(events)).toEqual(layoutDayLanes([...events].reverse()));
  });

  it("gère un événement qui commence avant le début de la grille", () => {
    // startMin négatif : 6h30 sur une grille qui démarre à 7h.
    const placements = layoutDayLanes([ev("tot", -30, 120), ev("apres", 0, 60)]);
    expect(new Set(placements.map((p) => p.lane))).toEqual(new Set([0, 1]));
    expect(placements.every((p) => p.lanes === 2)).toBe(true);
  });
});
