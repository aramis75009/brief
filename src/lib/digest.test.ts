import { describe, expect, it } from "vitest";
import { buildDigest } from "./digest";
import type { Item, Project } from "./types";

/**
 * Le récap du matin est lu par une machine (n8n) puis par un humain à 8h30.
 *
 * Ses deux façons de rater sont asymétriques, comme pour les rappels :
 *   - montrer une tâche de trop : bruit, visible, sans gravité ;
 *   - oublier une tâche due aujourd'hui : invisible, et c'est la journée qui
 *     part de travers.
 *
 * Le cas critique est le fuseau. La suite tourne en UTC (`vitest.config.mts`)
 * et la production aussi, alors que les échéances sont pensées à Paris : une
 * journée calculée avec les méthodes locales de `Date` commence à 2 h du matin
 * heure de Paris l'été. Une tâche due à 1 h passe alors pour en retard.
 */

const PROJECTS: Project[] = [
  { id: "inbox", name: "Inbox", tint: 1 },
  { id: "sport", name: "Sport", tint: 3 },
];

/** 8h30 à Paris — l'heure du déclencheur n8n. */
const NOW = new Date("2026-08-15T08:30:00+02:00");

function item(over: Partial<Item> = {}): Item {
  return {
    id: "i1",
    kind: "task",
    title: "Relancer le fournisseur",
    projectId: "inbox",
    due: "2026-08-15T14:00:00+02:00",
    allDay: false,
    priority: 4,
    rrule: null,
    createdAt: "2026-08-01T00:00:00+02:00",
    remindedAt: null,
    doneAt: null,
    ...over,
  };
}

describe("buildDigest", () => {
  it("range une échéance du jour dans `today`", () => {
    const d = buildDigest([item()], PROJECTS, NOW);
    expect(d.today.map((e) => e.id)).toEqual(["i1"]);
    expect(d.overdue).toHaveLength(0);
  });

  it("compte une échéance à 1 h du matin comme AUJOURD'HUI, pas en retard", () => {
    // Le test qui protège du fuseau. En UTC, minuit « local » tombe à 2 h de
    // Paris : sans `zoned.ts`, cette tâche est classée en retard.
    const petitMatin = item({ due: "2026-08-15T01:00:00+02:00" });
    const d = buildDigest([petitMatin], PROJECTS, NOW);
    expect(d.today.map((e) => e.id)).toEqual(["i1"]);
    expect(d.overdue).toHaveLength(0);
  });

  it("range une échéance d'hier dans `overdue`", () => {
    const d = buildDigest([item({ due: "2026-08-14T09:00:00+02:00" })], PROJECTS, NOW);
    expect(d.overdue.map((e) => e.id)).toEqual(["i1"]);
    expect(d.today).toHaveLength(0);
  });

  it("ignore une échéance de demain — le récap parle du jour, pas de la semaine", () => {
    const d = buildDigest([item({ due: "2026-08-16T09:00:00+02:00" })], PROJECTS, NOW);
    expect(d.counts).toEqual({ overdue: 0, today: 0 });
  });

  it("ignore un item terminé", () => {
    const fait = item({ doneAt: "2026-08-15T07:00:00+02:00" });
    expect(buildDigest([fait], PROJECTS, NOW).counts).toEqual({ overdue: 0, today: 0 });
  });

  it("ignore un item sans échéance plutôt que de déverser l'Inbox chaque matin", () => {
    expect(buildDigest([item({ due: null })], PROJECTS, NOW).counts.today).toBe(0);
  });

  it("ignore une échéance illisible sans faire tomber le récap entier", () => {
    const casse = item({ id: "i0", due: "n'importe quoi" });
    const d = buildDigest([casse, item({ id: "i2" })], PROJECTS, NOW);
    expect(d.today.map((e) => e.id)).toEqual(["i2"]);
  });

  it("résout le nom du projet — n8n n'a pas à connaître les identifiants", () => {
    const d = buildDigest([item({ projectId: "sport" })], PROJECTS, NOW);
    expect(d.today[0].project).toBe("Sport");
  });

  it("nomme un projet inconnu « Autre », comme l'écran Tâches", () => {
    // Un item peut porter un projectId supprimé depuis : le récap doit sortir.
    // Le libellé suit celui de `TasksScreen.tsx` — deux mots pour la même chose
    // feraient croire à deux notions différentes d'un écran à l'autre.
    const d = buildDigest([item({ projectId: "disparu" })], PROJECTS, NOW);
    expect(d.today[0].project).toBe("Autre");
  });

  it("trie par priorité, la 1 en tête — c'est la plus haute", () => {
    const items = [
      item({ id: "basse", priority: 4 }),
      item({ id: "haute", priority: 1 }),
      item({ id: "moyenne", priority: 2 }),
    ];
    const d = buildDigest(items, PROJECTS, NOW);
    expect(d.today.map((e) => e.id)).toEqual(["haute", "moyenne", "basse"]);
  });

  it("à priorité égale, la plus ancienne échéance passe devant", () => {
    const items = [
      item({ id: "apres", due: "2026-08-15T18:00:00+02:00" }),
      item({ id: "avant", due: "2026-08-15T09:00:00+02:00" }),
    ];
    expect(buildDigest(items, PROJECTS, NOW).today.map((e) => e.id)).toEqual(["avant", "apres"]);
  });

  it("horodate le récap avec l'instant fourni, pas l'heure de la machine", () => {
    expect(buildDigest([], PROJECTS, NOW).generatedAt).toBe(NOW.toISOString());
  });
});
