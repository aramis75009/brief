import { describe, expect, it } from "vitest";
import {
  HORIZONS,
  HORIZON_LABEL,
  effectiveDeps,
  objectiveEdges,
  objectiveEffectiveProgress,
  objectiveGraphEdges,
  objectiveNodeId,
  objectiveProgress,
  objectiveSatisfied,
  objectivesByProject,
  openTasksFor,
  reconcileObjectives,
  uniqueObjectiveId,
} from "./objectives";
import type { Item, Objective, Project } from "./types";

/* --- Fixtures ------------------------------------------------------------- */

const projA: Project = { id: "webacademie", name: "Web@cadémie", tint: 3, shape: "ring" };
const projB: Project = { id: "sport", name: "Sport", tint: 5, shape: "capsule" };

const objWeb: Objective = {
  id: "rejoindre-webacademie",
  projectId: "webacademie",
  title: "Rejoindre la Web@cadémie",
  horizon: "long",
  createdAt: "2026-08-29T20:00:00.000Z",
  achievedAt: null,
};
const objCourt: Objective = {
  id: "portfolio-pret",
  projectId: "webacademie",
  title: "Portfolio prêt",
  horizon: "court",
  createdAt: "2026-08-29T20:01:00.000Z",
  achievedAt: null,
};
const objAchieved: Objective = {
  id: "vieux-but",
  projectId: "webacademie",
  title: "Vieux but atteint",
  horizon: "moyen",
  createdAt: "2026-08-01T08:00:00.000Z",
  achievedAt: "2026-08-20T10:00:00.000Z",
};
const objSport: Objective = {
  id: "courir-10k",
  projectId: "sport",
  title: "Courir 10 km",
  horizon: "moyen",
  createdAt: "2026-08-29T20:02:00.000Z",
  achievedAt: null,
};

function makeItem(partial: Partial<Item>): Item {
  return {
    id: partial.id ?? "it-x",
    kind: "task",
    title: partial.title ?? "Tâche",
    projectId: partial.projectId ?? "webacademie",
    due: partial.due ?? null,
    allDay: partial.allDay ?? false,
    priority: partial.priority ?? 3,
    rrule: partial.rrule ?? null,
    createdAt: "2026-08-29T08:00:00.000Z",
    remindedAt: null,
    doneAt: partial.doneAt ?? null,
    status: partial.status ?? "active",
    ...partial,
  };
}

/* --- objectiveProgress ---------------------------------------------------- */

describe("objectiveProgress", () => {
  it("0/0 => pct 0, pas NaN", () => {
    expect(objectiveProgress(objWeb, [])).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it("compte fait/total et arrondit le pourcentage", () => {
    const items: Item[] = [
      makeItem({ id: "a", objectiveId: "rejoindre-webacademie", doneAt: "2026-08-29T18:00:00.000Z" }),
      makeItem({ id: "b", objectiveId: "rejoindre-webacademie", doneAt: "2026-08-29T19:00:00.000Z" }),
      makeItem({ id: "c", objectiveId: "rejoindre-webacademie" }),
    ];
    expect(objectiveProgress(objWeb, items)).toEqual({ done: 2, total: 3, pct: 67 });
  });

  it("ignore idées, archives, events et tâches d'autres objectifs", () => {
    const items: Item[] = [
      makeItem({ id: "a", objectiveId: "rejoindre-webacademie", status: "idea" }),
      makeItem({ id: "b", objectiveId: "rejoindre-webacademie", status: "archived" }),
      makeItem({ id: "c", objectiveId: "rejoindre-webacademie", kind: "event" }),
      makeItem({ id: "d", objectiveId: "courir-10k" }),
      makeItem({ id: "e", objectiveId: "rejoindre-webacademie" }),
    ];
    expect(objectiveProgress(objWeb, items)).toEqual({ done: 0, total: 1, pct: 0 });
  });
});

/* --- openTasksFor --------------------------------------------------------- */

describe("openTasksFor", () => {
  it("ne garde que les tâches actives liées à l'objectif", () => {
    const items: Item[] = [
      makeItem({ id: "a", objectiveId: "rejoindre-webacademie" }),
      makeItem({ id: "b", objectiveId: "rejoindre-webacademie", doneAt: "2026-08-29T18:00:00.000Z" }),
      makeItem({ id: "c", objectiveId: "courir-10k" }),
      makeItem({ id: "d" }),
    ];
    const ids = openTasksFor(objWeb, items).map((i) => i.id);
    expect(ids).toEqual(["a"]);
  });

  it("inclut aussi les tâches ajoutées via dependsOn (tirées dans le graphe)", () => {
    const items: Item[] = [
      makeItem({ id: "a", objectiveId: "rejoindre-webacademie" }),
      makeItem({ id: "linked-in-graph" }),
      makeItem({ id: "linked-done", doneAt: "2026-08-29T18:00:00.000Z" }),
    ];
    const obj: Objective = { ...objWeb, dependsOn: ["linked-in-graph", "linked-done"] };
    const ids = openTasksFor(obj, items, [obj]).map((i) => i.id).sort();
    expect(ids).toEqual(["a", "linked-in-graph"]);
  });
});

/* --- objectivesByProject -------------------------------------------------- */

describe("objectivesByProject", () => {
  it("regroupe par projet, trie par horizon, calcule la progression", () => {
    const items: Item[] = [
      makeItem({ id: "a", objectiveId: "rejoindre-webacademie", doneAt: "2026-08-29T18:00:00.000Z" }),
      makeItem({ id: "b", objectiveId: "portfolio-pret" }),
    ];
    const groups = objectivesByProject(
      [objWeb, objCourt, objAchieved, objSport],
      [projA, projB],
      items,
    );
    expect(groups.map((g) => g.project.id)).toEqual(["webacademie", "sport"]);
    // l'objectif atteint disparaît
    expect(groups[0].rows.map((r) => r.objective.id)).toEqual(["portfolio-pret", "rejoindre-webacademie"]);
    expect(groups[0].rows[1].progress).toEqual({ done: 1, total: 1, pct: 100 });
    expect(groups[1].rows[0].progress).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it("ignore les projets sans objectif actif", () => {
    const groups = objectivesByProject([objAchieved], [projA, projB], []);
    expect(groups).toEqual([]);
  });
});

/* --- uniqueObjectiveId --------------------------------------------------- */

describe("uniqueObjectiveId", () => {
  it("slugifie le titre et suffixe en cas de doublon", () => {
    expect(uniqueObjectiveId("Rejoindre la Web@cadémie", new Set())).toBe("rejoindre-la-web-cademie");
    expect(uniqueObjectiveId("Portfolio prêt", new Set(["portfolio-pret"]))).toBe("portfolio-pret-2");
  });
});

/* --- objectif dans le graphe ---------------------------------------------- */

describe("graphe", () => {
  it("id de nœud stable et distinct d'un id d'item", () => {
    expect(objectiveNodeId(objWeb)).toBe("obj:rejoindre-webacademie");
  });

  it("arêtes des tâches actives vers leur objectif, jamais vers un objectif atteint", () => {
    const items: Item[] = [
      makeItem({ id: "a", objectiveId: "rejoindre-webacademie" }),
      makeItem({ id: "b", objectiveId: "rejoindre-webacademie", doneAt: "2026-08-29T18:00:00.000Z" }),
      makeItem({ id: "c", objectiveId: "vieux-but" }),
      makeItem({ id: "d", objectiveId: null }),
      makeItem({ id: "e", kind: "event", objectiveId: "rejoindre-webacademie" }),
    ];
    const edges = objectiveEdges([objWeb, objAchieved], items);
    expect(edges).toEqual([{ fromId: "a", toId: "obj:rejoindre-webacademie" }]);
  });
});

/* --- objectiveEffectiveProgress ---------------------------------------- */

describe("objectiveEffectiveProgress", () => {
  it("compte les dépendances explicites que `objectiveProgress` ignore", () => {
    const items = [
      makeItem({ id: "t1", doneAt: "2026-08-29T10:00:00.000Z" }),
      makeItem({ id: "t2" }),
    ];
    const obj: Objective = { ...objCourt, dependsOn: ["t1", "t2", "obj:rejoindre-webacademie"] };
    // objectiveProgress ne voit rien (aucun objectiveId ne pointe dessus)
    expect(objectiveProgress(obj, items)).toEqual({ done: 0, total: 0, pct: 0 });
    // effective : t1 fait, t2 non, objWeb non atteint → 1/3
    expect(objectiveEffectiveProgress(obj, items, [obj, objWeb])).toEqual({ done: 1, total: 3, pct: 33 });
  });

  it("une tâche récurrente « faite » ne compte pas", () => {
    const items = [makeItem({ id: "t1", objectiveId: "portfolio-pret", rrule: "FREQ=WEEKLY;BYDAY=MO", doneAt: "2026-08-29T10:00:00.000Z" })];
    expect(objectiveEffectiveProgress(objCourt, items, [objCourt])).toEqual({ done: 0, total: 1, pct: 0 });
  });
});

/* --- effectiveDeps ------------------------------------------------------- */

describe("effectiveDeps", () => {
  it("réunit les tâches liées par objectiveId et les dependsOn explicites, dédupliqués", () => {
    const items = [
      makeItem({ id: "t1", objectiveId: "portfolio-pret" }),
      makeItem({ id: "t2", objectiveId: "portfolio-pret" }),
      makeItem({ id: "t3" }),
    ];
    const obj: Objective = { ...objCourt, dependsOn: ["t2", "t3", "obj:rejoindre-webacademie"] };
    const deps = effectiveDeps(obj, items, [obj, objWeb]);
    expect([...deps.itemIds].sort()).toEqual(["t1", "t2", "t3"]);
    expect(deps.objectiveIds).toEqual(["rejoindre-webacademie"]);
  });

  it("ignore un dependsOn qui pointe vers un objectif inexistant", () => {
    const obj: Objective = { ...objCourt, dependsOn: ["obj:fantome"] };
    expect(effectiveDeps(obj, [], [obj]).objectiveIds).toEqual([]);
  });

  it("ignore un dependsOn item inexistant et l'auto-référence", () => {
    const obj: Objective = { ...objCourt, dependsOn: ["ghost", "obj:portfolio-pret"] };
    const deps = effectiveDeps(obj, [], [obj]);
    expect(deps.itemIds).toEqual([]);
    expect(deps.objectiveIds).toEqual([]);
  });

  it("ne compte pas une tâche archivée / repassée en idée, ni un event, liés par objectiveId", () => {
    const items = [
      makeItem({ id: "t1", objectiveId: "portfolio-pret" }),
      makeItem({ id: "t2", objectiveId: "portfolio-pret", status: "archived" }),
      makeItem({ id: "t3", objectiveId: "portfolio-pret", status: "idea" }),
      makeItem({ id: "t4", objectiveId: "portfolio-pret", kind: "event" }),
    ];
    expect(effectiveDeps(objCourt, items, [objCourt]).itemIds).toEqual(["t1"]);
  });
});

/* --- objectiveSatisfied ------------------------------------------------- */

describe("objectiveSatisfied", () => {
  it("faux si aucune dépendance", () => {
    expect(objectiveSatisfied({ ...objCourt, dependsOn: [] }, [], [objCourt])).toBe(false);
  });

  it("vrai quand toutes les tâches liées sont faites", () => {
    const items = [
      makeItem({ id: "t1", objectiveId: "portfolio-pret", doneAt: "2026-08-29T10:00:00.000Z" }),
      makeItem({ id: "t2", objectiveId: "portfolio-pret", doneAt: "2026-08-29T11:00:00.000Z" }),
    ];
    expect(objectiveSatisfied(objCourt, items, [objCourt])).toBe(true);
  });

  it("faux si une tâche liée reste à faire", () => {
    const items = [
      makeItem({ id: "t1", objectiveId: "portfolio-pret", doneAt: "2026-08-29T10:00:00.000Z" }),
      makeItem({ id: "t2", objectiveId: "portfolio-pret" }),
    ];
    expect(objectiveSatisfied(objCourt, items, [objCourt])).toBe(false);
  });

  it("faux si une tâche liée est récurrente, même « faite »", () => {
    const items = [
      makeItem({ id: "t1", objectiveId: "portfolio-pret", rrule: "FREQ=WEEKLY;BYDAY=MO", doneAt: "2026-08-29T10:00:00.000Z" }),
    ];
    expect(objectiveSatisfied(objCourt, items, [objCourt])).toBe(false);
  });

  it("suit les objectifs-dépendances", () => {
    const upstream: Objective = { ...objCourt, id: "amont", achievedAt: null };
    const downstream: Objective = { ...objWeb, dependsOn: ["obj:amont"] };
    expect(objectiveSatisfied(downstream, [], [upstream, downstream])).toBe(false);
    const upstreamDone: Objective = { ...upstream, achievedAt: "2026-08-30T00:00:00.000Z" };
    expect(objectiveSatisfied(downstream, [], [upstreamDone, downstream])).toBe(true);
  });
});

/* --- objectiveGraphEdges --------------------------------------------- */

describe("objectiveGraphEdges", () => {
  it("tâche visible → objectif, et objectif → objectif pour les chaînes", () => {
    const amont: Objective = { ...objCourt, id: "amont", achievedAt: null };
    const aval: Objective = { ...objWeb, id: "aval", dependsOn: ["obj:amont"], achievedAt: null };
    const items = [
      makeItem({ id: "t1", objectiveId: "amont" }),
      makeItem({ id: "t2", objectiveId: "amont" }),
    ];
    const edges = objectiveGraphEdges([amont, aval], items, new Set(["t1"]));
    expect(edges).toContainEqual({ fromId: "t1", toId: "obj:amont", kind: "task" });
    // t2 n'est pas visible → pas d'arête
    expect(edges.find((e) => e.fromId === "t2")).toBeUndefined();
    expect(edges).toContainEqual({ fromId: "obj:amont", toId: "obj:aval", kind: "objective" });
  });

  it("aucune arête vers un objectif atteint", () => {
    const done: Objective = { ...objCourt, id: "d", achievedAt: "2026-08-29T00:00:00.000Z" };
    const items = [makeItem({ id: "t1", objectiveId: "d" })];
    expect(objectiveGraphEdges([done], items, new Set(["t1"]))).toEqual([]);
  });
});

/* --- reconcileObjectives ---------------------------------------------- */

describe("reconcileObjectives", () => {
  const NOW = "2026-08-30T12:00:00.000Z";

  it("auto-atteint un objectif dont toutes les tâches sont faites", () => {
    const items = [makeItem({ id: "t1", objectiveId: "portfolio-pret", doneAt: NOW })];
    const [out] = reconcileObjectives(items, [{ ...objCourt, achievedAt: null }], NOW);
    expect(out.achievedAt).toBe(NOW);
  });

  it("rouvre un objectif auto-atteint quand une tâche redevient à faire", () => {
    const items = [makeItem({ id: "t1", objectiveId: "portfolio-pret" })];
    const prev: Objective = { ...objCourt, achievedAt: "2026-08-29T00:00:00.000Z", achievedManually: false };
    const [out] = reconcileObjectives(items, [prev], NOW);
    expect(out.achievedAt).toBeNull();
  });

  it("ne touche jamais un objectif atteint à la main", () => {
    const prev: Objective = { ...objCourt, achievedAt: "2026-08-29T00:00:00.000Z", achievedManually: true };
    const [out] = reconcileObjectives([], [prev], NOW);
    expect(out.achievedAt).toBe("2026-08-29T00:00:00.000Z");
  });

  it("cascade : un objectif aval s'atteint quand son objectif amont vient de s'atteindre", () => {
    const items = [makeItem({ id: "t1", objectiveId: "amont", doneAt: NOW })];
    const amont: Objective = { ...objCourt, id: "amont", achievedAt: null };
    const aval: Objective = { ...objWeb, id: "aval", dependsOn: ["obj:amont"], achievedAt: null };
    const out = reconcileObjectives(items, [amont, aval], NOW);
    expect(out.find((o) => o.id === "amont")!.achievedAt).toBe(NOW);
    expect(out.find((o) => o.id === "aval")!.achievedAt).toBe(NOW);
  });

  it("préserve l'identité des objets non modifiés", () => {
    const untouched: Objective = { ...objSport, achievedAt: null };
    const [out] = reconcileObjectives([], [untouched], NOW);
    expect(out).toBe(untouched);
  });
});

/* --- constantes ------------------------------------------------------------ */

describe("constantes", () => {
  it("trois horizons, tous libellés", () => {
    expect(HORIZONS).toEqual(["court", "moyen", "long"]);
    for (const h of HORIZONS) expect(HORIZON_LABEL[h]).toBeTruthy();
  });
});
