import { describe, expect, it } from "vitest";
import {
  COMPACT,
  boundingBox,
  connectedComponents,
  depths,
  wouldCreateCycle,
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

describe("graphTasks — le graphe ne parle que de tâches actives", () => {
  it("écarte les rendez-vous", () => {
    const list = [item({ id: "a" }), item({ id: "e", kind: "event" })];
    expect(graphTasks(list).map((t) => t.id)).toEqual(["a"]);
  });

  it("écarte les tâches terminées (barrées)", () => {
    const list = [
      item({ id: "a" }),
      item({ id: "b", doneAt: "2026-08-23T10:00:00+02:00" }),
    ];
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

  it("« bloquées » : un maillon terminé n'est plus bloquant — vue vide", () => {
    // `b` ne dépend que de `a`, terminée : elle est prête, donc le filtre
    // « bloquées » n'a plus rien à montrer.
    const list = [
      item({ id: "a", doneAt: "2026-08-23T10:00:00+02:00" }),
      item({ id: "b", dependsOn: ["a"] }),
    ];
    const got = visibleTasks(list, { projectFilter: [], blockedOnly: true });
    expect(got).toEqual([]);
    expect(graphStatus(list[1], indexById(graphTasks(list)))).toBe("ready");
  });

  it("un maillon terminé disparaît du graphe, la suite reste prête", () => {
    const list = [
      item({ id: "a", doneAt: "2026-08-23T10:00:00+02:00" }),
      item({ id: "b", dependsOn: ["a"] }),
    ];
    const got = visibleTasks(list, { projectFilter: [], blockedOnly: false });
    expect(got.map((t) => t.id)).toEqual(["b"]);
    expect(graphStatus(list[1], indexById(graphTasks(list)))).toBe("ready");
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

  /**
   * ⚠️ Contrat CHANGÉ le 2026-08-25, volontairement.
   *
   * L'ancien test exigeait que deux tâches isolées partagent la même colonne
   * (même x, un cran de plus en y). C'était la description fidèle du bug : une
   * tâche sans dépendance a une profondeur de 0, donc les 40 tâches isolées d'un
   * jeu réel s'empilaient toutes dans la colonne 0. Les isolées vont maintenant
   * en grille — ce test dit la nouvelle règle.
   */
  it("met les tâches isolées côte à côte, pas en colonne", () => {
    const list = [item({ id: "a" }), item({ id: "b" })];
    const pos = layoutGraph(list);
    expect(pos.get("a")!.y).toBe(pos.get("b")!.y);
    expect(Math.abs(pos.get("a")!.x - pos.get("b")!.x)).toBe(COMPACT.W + COMPACT.GAP);
  });

  it("ne fait jamais une seule colonne d'un paquet de tâches isolées", () => {
    const list = Array.from({ length: 42 }, (_, i) => item({ id: `t${i}` }));
    const pos = layoutGraph(list);
    const xs = new Set([...pos.values()].map((p) => p.x));
    const ys = new Set([...pos.values()].map((p) => p.y));
    // C'est le cœur du bug : avant, xs.size valait 1 et ys.size 42.
    expect(xs.size).toBeGreaterThan(4);
    expect(ys.size).toBeLessThan(10);
  });

  it("ne superpose jamais deux nœuds", () => {
    const list = [
      ...CHAIN,
      item({ id: "d", dependsOn: ["a"] }),
      item({ id: "e", dependsOn: ["d"] }),
      ...Array.from({ length: 17 }, (_, i) => item({ id: `libre${i}` })),
    ];
    const pos = layoutGraph(list);
    const points = [...pos.entries()];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const [, a] = points[i];
        const [, b] = points[j];
        const chevauche =
          Math.abs(a.x - b.x) < COMPACT.W && Math.abs(a.y - b.y) < COMPACT.H;
        expect(chevauche).toBe(false);
      }
    }
  });

  it("donne sa propre bande à chaque chaîne", () => {
    const list = [
      item({ id: "a1" }),
      item({ id: "a2", dependsOn: ["a1"] }),
      item({ id: "b1" }),
      item({ id: "b2", dependsOn: ["b1"] }),
    ];
    const pos = layoutGraph(list);
    // Les deux chaînes démarrent à la même abscisse (colonne 0 locale)…
    expect(pos.get("a1")!.x).toBe(pos.get("b1")!.x);
    // …mais pas à la même hauteur : deux bandes distinctes.
    expect(pos.get("a1")!.y).not.toBe(pos.get("b1")!.y);
  });

  it("place les chaînes au-dessus de la grille des isolées", () => {
    const list = [...CHAIN, item({ id: "seule" })];
    const pos = layoutGraph(list);
    expect(pos.get("seule")!.y).toBeGreaterThan(pos.get("a")!.y);
  });

  it("est déterministe sur un même jeu, quel que soit l'ordre d'entrée", () => {
    const list = [...CHAIN, item({ id: "x" }), item({ id: "y" })];
    const a = layoutGraph(list);
    const b = layoutGraph([...list].reverse());
    for (const id of ["a", "b", "c", "x", "y"]) {
      expect(a.get(id)).toEqual(b.get(id));
    }
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

describe("connectedComponents", () => {
  it("regroupe une chaîne entière dans une seule composante", () => {
    const comps = connectedComponents(CHAIN);
    expect(comps).toHaveLength(1);
    expect(comps[0].map((t) => t.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("relie deux tâches qui partagent un prédécesseur", () => {
    // b et c dépendent tous deux de a : une seule composante, en Y.
    const comps = connectedComponents([
      item({ id: "a" }),
      item({ id: "b", dependsOn: ["a"] }),
      item({ id: "c", dependsOn: ["a"] }),
    ]);
    expect(comps).toHaveLength(1);
  });

  it("sépare des tâches sans lien", () => {
    const comps = connectedComponents([item({ id: "a" }), item({ id: "b" })]);
    expect(comps).toHaveLength(2);
  });

  it("ignore un dependsOn qui sort de la liste", () => {
    const comps = connectedComponents([item({ id: "a", dependsOn: ["absent"] }), item({ id: "b" })]);
    expect(comps).toHaveLength(2);
  });

  it("range les grosses composantes d'abord", () => {
    const comps = connectedComponents([item({ id: "seule" }), ...CHAIN]);
    expect(comps[0]).toHaveLength(3);
    expect(comps[1]).toHaveLength(1);
  });

  it("ne boucle pas sur un cycle", () => {
    const comps = connectedComponents([
      item({ id: "a", dependsOn: ["b"] }),
      item({ id: "b", dependsOn: ["a"] }),
    ]);
    expect(comps).toHaveLength(1);
    expect(comps[0]).toHaveLength(2);
  });
});

describe("wouldCreateCycle — le garde-fou du tirage de lien", () => {
  it("refuse une tâche qui dépendrait d'elle-même", () => {
    expect(wouldCreateCycle("a", "a", CHAIN)).toBe(true);
  });

  it("refuse de refermer une chaîne existante", () => {
    // a → b → c. Faire dépendre `a` de `c` boucle.
    expect(wouldCreateCycle("a", "c", CHAIN)).toBe(true);
  });

  it("refuse aussi le rebouclage d'un seul cran", () => {
    expect(wouldCreateCycle("a", "b", CHAIN)).toBe(true);
  });

  it("accepte un lien qui va dans le sens du courant", () => {
    // Faire dépendre `c` de `a` : redondant mais pas cyclique.
    expect(wouldCreateCycle("c", "a", CHAIN)).toBe(false);
  });

  it("accepte un lien vers une tâche sans rapport", () => {
    const list = [...CHAIN, item({ id: "libre" })];
    expect(wouldCreateCycle("libre", "c", list)).toBe(false);
    expect(wouldCreateCycle("a", "libre", list)).toBe(false);
  });

  it("ne boucle pas si un cycle existe déjà dans les données", () => {
    const cyclique = [
      item({ id: "a", dependsOn: ["b"] }),
      item({ id: "b", dependsOn: ["a"] }),
      item({ id: "c" }),
    ];
    expect(wouldCreateCycle("c", "a", cyclique)).toBe(false);
    expect(wouldCreateCycle("a", "b", cyclique)).toBe(true);
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
