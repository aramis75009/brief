import { describe, expect, it } from "vitest";
import {
  COMPACT,
  boundingBox,
  depths,
  graphEdges,
  graphStatus,
  graphTasks,
  indexById,
  layoutGraph,
  unlocks,
  visibleTasks,
} from "./graph";
import type { Item } from "./types";

function item(over: Partial<Item> = {}): Item {
  return {
    id: "i1",
    kind: "task",
    title: "Trier le lot de polos",
    projectId: "frip",
    due: "2026-08-24T09:00:00+02:00",
    allDay: false,
    priority: 3,
    rrule: null,
    status: "active",
    createdAt: "2026-08-01T00:00:00+02:00",
    remindedAt: null,
    doneAt: null,
    ...over,
  };
}

/** Chaîne a → b → c : `a` ouvre, `c` ferme. */
const CHAIN = [
  item({ id: "a", title: "Trier" }),
  item({ id: "b", title: "Shooter", dependsOn: ["a"] }),
  item({ id: "c", title: "Publier", dependsOn: ["b"] }),
];

describe("graphStatus — trois statuts dérivés de doneAt", () => {
  it("une tâche cochée est terminée, même si elle bloque encore quelqu'un", () => {
    const list = [item({ id: "a", doneAt: "2026-08-23T10:00:00+02:00" })];
    expect(graphStatus(list[0], indexById(list))).toBe("done");
  });

  it("une tâche sans dépendance est prête", () => {
    const list = [item({ id: "a" })];
    expect(graphStatus(list[0], indexById(list))).toBe("ready");
  });

  it("une tâche dont un prédécesseur reste à faire est bloquée", () => {
    const byId = indexById(CHAIN);
    expect(graphStatus(CHAIN[1], byId)).toBe("blocked");
  });

  it("une tâche redevient prête quand tous ses prédécesseurs sont cochés", () => {
    const list = [
      item({ id: "a", doneAt: "2026-08-23T10:00:00+02:00" }),
      item({ id: "b", dependsOn: ["a"] }),
    ];
    expect(graphStatus(list[1], indexById(list))).toBe("ready");
  });

  it("une seule dépendance non terminée suffit à bloquer", () => {
    const list = [
      item({ id: "a", doneAt: "2026-08-23T10:00:00+02:00" }),
      item({ id: "b" }),
      item({ id: "c", dependsOn: ["a", "b"] }),
    ];
    expect(graphStatus(list[2], indexById(list))).toBe("blocked");
  });

  it("une dépendance qui pointe vers un id inconnu n'est pas bloquante", () => {
    // Sinon un item supprimé bloquerait sa suite pour toujours, sans recours.
    const list = [item({ id: "b", dependsOn: ["disparu"] })];
    expect(graphStatus(list[0], indexById(list))).toBe("ready");
  });
});

describe("graphTasks — le graphe ne parle que de tâches", () => {
  it("écarte les rendez-vous", () => {
    const list = [item({ id: "a" }), item({ id: "e", kind: "event" })];
    expect(graphTasks(list).map((t) => t.id)).toEqual(["a"]);
  });
});

describe("visibleTasks — filtres projet et « bloquées »", () => {
  it("un filtre projet vide montre tout", () => {
    const got = visibleTasks(CHAIN, { projectFilter: [], blockedOnly: false });
    expect(got).toHaveLength(3);
  });

  it("le filtre projet ne garde que les projets cochés", () => {
    const list = [item({ id: "a", projectId: "frip" }), item({ id: "b", projectId: "ia" })];
    const got = visibleTasks(list, { projectFilter: ["ia"], blockedOnly: false });
    expect(got.map((t) => t.id)).toEqual(["b"]);
  });

  it("« bloquées » garde le bloqué ET toute son ascendance", () => {
    // `c` est bloquée par `b`, elle-même bloquée par `a`. Montrer `c` seule
    // n'apprendrait pas ce qui la retient.
    const got = visibleTasks(CHAIN, { projectFilter: [], blockedOnly: true });
    expect(got.map((t) => t.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("« bloquées » remonte une ascendance qui vit dans un autre projet", () => {
    const list = [
      item({ id: "a", projectId: "ia" }),
      item({ id: "b", projectId: "frip", dependsOn: ["a"] }),
    ];
    const got = visibleTasks(list, { projectFilter: ["frip"], blockedOnly: true });
    expect(got.map((t) => t.id).sort()).toEqual(["a", "b"]);
  });

  it("« bloquées » sans aucun blocage rend une vue vide", () => {
    const list = [item({ id: "a" }), item({ id: "b" })];
    expect(visibleTasks(list, { projectFilter: [], blockedOnly: true })).toEqual([]);
  });
});

describe("graphEdges", () => {
  it("ne garde que les arêtes dont les deux bouts sont visibles", () => {
    const list = [item({ id: "b", dependsOn: ["a"] }), item({ id: "c", dependsOn: ["b"] })];
    const edges = graphEdges(list);
    expect(edges).toHaveLength(1);
    expect([edges[0].from.id, edges[0].to.id]).toEqual(["b", "c"]);
  });
});

describe("depths — les colonnes", () => {
  it("range une chaîne en colonnes successives", () => {
    const d = depths(CHAIN);
    expect([d.get("a"), d.get("b"), d.get("c")]).toEqual([0, 1, 2]);
  });

  it("prend le plus long chemin quand deux chemins mènent au même nœud", () => {
    // a → b → d et a → d : `d` doit se placer après `b`, pas à côté.
    const list = [
      item({ id: "a" }),
      item({ id: "b", dependsOn: ["a"] }),
      item({ id: "d", dependsOn: ["a", "b"] }),
    ];
    expect(depths(list).get("d")).toBe(2);
  });

  it("ne boucle pas sur un cycle", () => {
    const list = [
      item({ id: "a", dependsOn: ["b"] }),
      item({ id: "b", dependsOn: ["a"] }),
    ];
    expect(() => depths(list)).not.toThrow();
    expect(depths(list).size).toBe(2);
  });
});

describe("layoutGraph", () => {
  it("place chaque colonne un cran plus à droite", () => {
    const pos = layoutGraph(CHAIN);
    const step = COMPACT.W + COMPACT.GAP;
    expect(pos.get("b")!.x - pos.get("a")!.x).toBe(step);
    expect(pos.get("c")!.x - pos.get("b")!.x).toBe(step);
  });

  it("empile les tâches d'une même colonne sans les superposer", () => {
    const list = [item({ id: "a" }), item({ id: "b" })];
    const pos = layoutGraph(list);
    expect(pos.get("a")!.x).toBe(pos.get("b")!.x);
    expect(Math.abs(pos.get("a")!.y - pos.get("b")!.y)).toBe(COMPACT.H + COMPACT.VGAP);
  });

  it("la position épinglée par l'utilisateur gagne sur le calcul", () => {
    const pos = layoutGraph(CHAIN, COMPACT, { b: { x: 999, y: 777 } });
    expect(pos.get("b")).toEqual({ x: 999, y: 777 });
  });

  it("ignore une position épinglée sur un nœud devenu invisible", () => {
    const pos = layoutGraph(CHAIN, COMPACT, { fantome: { x: 1, y: 1 } });
    expect(pos.has("fantome")).toBe(false);
  });
});

describe("boundingBox", () => {
  it("englobe le gabarit des nœuds, pas seulement leur coin", () => {
    const list = [item({ id: "a" })];
    const box = boundingBox(list, layoutGraph(list))!;
    expect(box.maxX - box.minX).toBe(COMPACT.W);
    expect(box.maxY - box.minY).toBe(COMPACT.H);
  });

  it("rend null sur un graphe vide — rien à cadrer", () => {
    expect(boundingBox([], new Map())).toBeNull();
  });
});

describe("unlocks", () => {
  it("liste ce que cette tâche débloquera", () => {
    expect(unlocks(CHAIN[0], CHAIN).map((t) => t.id)).toEqual(["b"]);
  });

  it("rend une liste vide quand rien n'attend", () => {
    expect(unlocks(CHAIN[2], CHAIN)).toEqual([]);
  });
});
