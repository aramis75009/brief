import { describe, expect, it } from "vitest";
import { columnItems, detachColumn, moveCardPlan, reorderColumnIds, sortColumnItems } from "./kanban";
import type { Item, KanbanColumn } from "./types";

/* --- Fixtures ------------------------------------------------------------- */

function item(id: string, columnId: string | null, columnOrder?: number, extra: Partial<Item> = {}): Item {
  return {
    id,
    kind: "task",
    title: id,
    projectId: "p1",
    due: null,
    allDay: true,
    priority: 4,
    rrule: null,
    columnId,
    columnOrder,
    createdAt: "2026-08-31T10:00:00.000Z",
    remindedAt: null,
    doneAt: null,
    ...extra,
  };
}

const cols: KanbanColumn[] = [
  { id: "todo", name: "À faire", order: 0 },
  { id: "doing", name: "En cours", order: 1 },
  { id: "done", name: "Fait", order: 2 },
];

/** Ids de la colonne, dans l'ordre, après application d'un plan. */
function applied(items: Item[], plan: { id: string; patch: Partial<Item> }[], columnId: string | null): string[] {
  const byId = new Map(plan.map((p) => [p.id, p.patch]));
  const next = items.map((it) => (byId.has(it.id) ? { ...it, ...byId.get(it.id) } : it));
  return columnItems(next, columnId).map((it) => it.id);
}

/* --- sortColumnItems ------------------------------------------------------ */

describe("sortColumnItems", () => {
  it("trie par columnOrder croissant", () => {
    const items = [item("c", "todo", 2), item("a", "todo", 0), item("b", "todo", 1)];
    expect(sortColumnItems(items).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("garde l'ordre d'entrée quand AUCUN item n'a de rang", () => {
    // Le piège : `(a ?? Infinity) - (b ?? Infinity)` rend NaN, donc un ordre
    // non spécifié — et c'est l'état de TOUTES les cartes au premier
    // chargement, avant le moindre glissement.
    const items = [item("x", "todo"), item("y", "todo"), item("z", "todo")];
    expect(sortColumnItems(items).map((i) => i.id)).toEqual(["x", "y", "z"]);
  });

  it("place les items sans rang après ceux qui en ont un", () => {
    const items = [item("sans1", "todo"), item("avec", "todo", 5), item("sans2", "todo")];
    expect(sortColumnItems(items).map((i) => i.id)).toEqual(["avec", "sans1", "sans2"]);
  });

  it("départage deux rangs égaux par l'ordre d'entrée (état atteignable à deux onglets)", () => {
    const items = [item("premier", "todo", 1), item("second", "todo", 1)];
    expect(sortColumnItems(items).map((i) => i.id)).toEqual(["premier", "second"]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const items = [item("b", "todo", 1), item("a", "todo", 0)];
    sortColumnItems(items);
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

/* --- columnItems ---------------------------------------------------------- */

describe("columnItems", () => {
  it("ne garde que la colonne demandée, triée", () => {
    const items = [item("a", "todo", 1), item("b", "doing", 0), item("c", "todo", 0)];
    expect(columnItems(items, "todo").map((i) => i.id)).toEqual(["c", "a"]);
  });

  it("columnId null = les non placées, y compris columnId absent", () => {
    const items = [item("a", null, 0), item("b", "todo", 0), { ...item("c", null), columnId: undefined }];
    expect(columnItems(items, null).map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("garde les items faits — le serveur réindexe la colonne COMPLÈTE", () => {
    // Sinon un dépôt écraserait le rang des cartes que l'écran masque.
    const items = [item("ouvert", "todo", 0), item("fait", "todo", 1, { doneAt: "2026-08-31T09:00:00.000Z" })];
    expect(columnItems(items, "todo").map((i) => i.id)).toEqual(["ouvert", "fait"]);
  });
});

/* --- moveCardPlan --------------------------------------------------------- */

describe("moveCardPlan", () => {
  const trois = [item("a", "todo", 0), item("b", "todo", 1), item("c", "todo", 2)];

  it("déplace en tête (afterId = la carte qui suivra)", () => {
    const plan = moveCardPlan({ items: trois, itemId: "c", toColumnId: "todo", afterId: "a" });
    expect(applied(trois, plan, "todo")).toEqual(["c", "a", "b"]);
  });

  it("déplace au milieu (entre deux voisins)", () => {
    const plan = moveCardPlan({ items: trois, itemId: "a", toColumnId: "todo", beforeId: "b", afterId: "c" });
    expect(applied(trois, plan, "todo")).toEqual(["b", "a", "c"]);
  });

  it("déplace en queue (beforeId = la dernière carte)", () => {
    const plan = moveCardPlan({ items: trois, itemId: "a", toColumnId: "todo", beforeId: "c" });
    expect(applied(trois, plan, "todo")).toEqual(["b", "c", "a"]);
  });

  it("dépôt sans voisin = fin de colonne (zone vide)", () => {
    const items = [...trois, item("z", "doing", 0)];
    const plan = moveCardPlan({ items, itemId: "z", toColumnId: "todo" });
    expect(applied(items, plan, "todo")).toEqual(["a", "b", "c", "z"]);
  });

  it("change de colonne : réindexe la CIBLE, laisse un trou dans la source", () => {
    const items = [...trois, item("x", "doing", 0), item("y", "doing", 1)];
    const plan = moveCardPlan({ items, itemId: "b", toColumnId: "doing", afterId: "y" });
    expect(applied(items, plan, "doing")).toEqual(["x", "b", "y"]);

    // La source garde ses rangs (0, _, 2) et n'est PAS retassée : aucun patch
    // ne la concerne. Ce qui compte est que l'ORDRE reste juste — le tri gère
    // le trou.
    expect(applied(items, plan, "todo")).toEqual(["a", "c"]);
    expect(plan.find((p) => p.id === "c")).toBeUndefined();
    expect(plan.find((p) => p.id === "a")).toBeUndefined();
  });

  it("sortir une carte des « non placées » ne renumérote pas tout le reste", () => {
    // `columnId: null` n'est pas une colonne : c'est TOUT ce qui n'a jamais été
    // posé sur le board — idées, items archivés et terminés compris. Retasser
    // cette pseudo-colonne tamponnait un `columnOrder` sur des centaines
    // d'items que le Kanban n'affiche jamais.
    const items = [
      ...Array.from({ length: 200 }, (_, i) => item(`libre${i}`, null)),
      item("cible", null),
      item("deja", "todo", 0),
    ];
    const plan = moveCardPlan({ items, itemId: "cible", toColumnId: "todo", beforeId: "deja" });

    expect(plan.filter((p) => p.id.startsWith("libre"))).toHaveLength(0);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toEqual({ id: "cible", patch: { columnId: "todo", columnOrder: 1 } });
    expect(applied(items, plan, "todo")).toEqual(["deja", "cible"]);
  });

  it("ranger une carte DANS les « non placées » réindexe bien cette barre", () => {
    // L'inverse est vrai : la barre « Non placées » est triable à l'écran, donc
    // quand elle est la CIBLE elle est numérotée comme une vraie colonne.
    const items = [item("p", null, 0), item("q", null, 1), item("r", "todo", 0)];
    const plan = moveCardPlan({ items, itemId: "r", toColumnId: null, beforeId: "p" });
    expect(applied(items, plan, null)).toEqual(["p", "r", "q"]);
  });

  it("dépôt sur place = AUCUN patch (aucune écriture disque)", () => {
    expect(moveCardPlan({ items: trois, itemId: "b", toColumnId: "todo", beforeId: "a", afterId: "c" })).toEqual([]);
  });

  it("item inconnu = aucun patch", () => {
    expect(moveCardPlan({ items: trois, itemId: "fantome", toColumnId: "todo" })).toEqual([]);
  });

  it("sort une carte du board vers les non placées", () => {
    const plan = moveCardPlan({ items: trois, itemId: "b", toColumnId: null });
    expect(plan.find((p) => p.id === "b")?.patch.columnId).toBeNull();
    expect(applied(trois, plan, "todo")).toEqual(["a", "c"]);
  });

  it("entre depuis les non placées", () => {
    const items = [...trois, item("neuve", null)];
    const plan = moveCardPlan({ items, itemId: "neuve", toColumnId: "todo", afterId: "a" });
    expect(applied(items, plan, "todo")).toEqual(["neuve", "a", "b", "c"]);
  });

  it("voisins introuvables (carte supprimée entre-temps) → fin de colonne, sans planter", () => {
    const items = [...trois, item("z", "doing", 0)];
    const plan = moveCardPlan({ items, itemId: "z", toColumnId: "todo", beforeId: "disparue", afterId: "aussi" });
    expect(applied(items, plan, "todo")).toEqual(["a", "b", "c", "z"]);
  });

  it("réindexe une colonne dont les rangs sont dupliqués ou absents", () => {
    const cassee = [item("a", "todo", 1), item("b", "todo", 1), item("c", "todo")];
    const plan = moveCardPlan({ items: cassee, itemId: "c", toColumnId: "todo", afterId: "a" });
    const ordres = applied(cassee, plan, "todo");
    expect(ordres).toEqual(["c", "a", "b"]);
  });

  it("réindexe la colonne COMPLÈTE, y compris les cartes que l'écran masque", () => {
    // Le défaut central du plan initial : réindexer côté client, sur la liste
    // filtrée, écrasait le rang des cartes masquées par un filtre projet.
    const items = [
      item("visible1", "todo", 0),
      item("masquee", "todo", 1, { projectId: "p2" }),
      item("visible2", "todo", 2),
    ];
    const plan = moveCardPlan({ items, itemId: "visible2", toColumnId: "todo", afterId: "visible1" });
    expect(applied(items, plan, "todo")).toEqual(["visible2", "visible1", "masquee"]);
  });

  it("propriété : jamais deux rangs égaux, jamais un item perdu", () => {
    const items = [item("a", "todo", 0), item("b", "todo", 1), item("c", "todo", 2), item("d", "doing", 0)];
    for (const cible of ["todo", "doing", null] as const) {
      for (const voisin of [undefined, "a", "b", "c"]) {
        const plan = moveCardPlan({ items, itemId: "d", toColumnId: cible, afterId: voisin });
        const byId = new Map(plan.map((p) => [p.id, p.patch]));
        const next = items.map((it) => (byId.has(it.id) ? { ...it, ...byId.get(it.id) } : it));
        expect(next).toHaveLength(items.length);
        for (const col of ["todo", "doing", null] as const) {
          const rangs = columnItems(next, col).map((it) => it.columnOrder);
          expect(new Set(rangs).size).toBe(rangs.length);
        }
      }
    }
  });
});

/* --- reorderColumnIds ----------------------------------------------------- */

describe("reorderColumnIds", () => {
  it("déplace une colonne vers la droite", () => {
    expect(reorderColumnIds(cols, "todo", "doing")).toEqual(["doing", "todo", "done"]);
  });

  it("déplace une colonne vers la gauche", () => {
    expect(reorderColumnIds(cols, "done", "todo")).toEqual(["done", "todo", "doing"]);
  });

  it("respecte `order` et non l'ordre du tableau", () => {
    const desordre: KanbanColumn[] = [
      { id: "done", name: "Fait", order: 2 },
      { id: "todo", name: "À faire", order: 0 },
      { id: "doing", name: "En cours", order: 1 },
    ];
    expect(reorderColumnIds(desordre, "todo", "doing")).toEqual(["doing", "todo", "done"]);
  });

  it("colonne inconnue ou immobile = ordre inchangé", () => {
    expect(reorderColumnIds(cols, "todo", "todo")).toEqual(["todo", "doing", "done"]);
    expect(reorderColumnIds(cols, "fantome", "todo")).toEqual(["todo", "doing", "done"]);
  });
});

/* --- detachColumn --------------------------------------------------------- */

describe("detachColumn", () => {
  it("renvoie les cartes de la colonne en non placées, rang effacé", () => {
    const items = [item("a", "todo", 0), item("b", "todo", 1), item("c", "doing", 0)];
    const plan = detachColumn(items, "todo");
    expect(plan.map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(plan[0].patch).toEqual({ columnId: null, columnOrder: undefined });
  });

  it("colonne vide ou inconnue = aucun patch", () => {
    expect(detachColumn([item("a", "todo", 0)], "vide")).toEqual([]);
  });

  it("récupère aussi les orphelines : colonnes vivantes fournies, columnId mort effacé", () => {
    // Les cartes dont la colonne a déjà été supprimée sont invisibles en prod :
    // ni dans une colonne, ni dans « non placées » (qui teste `!columnId`).
    const items = [item("vivante", "todo", 0), item("orpheline", "colonne-morte", 0)];
    const plan = detachColumn(items, null, ["todo"]);
    expect(plan.map((p) => p.id)).toEqual(["orpheline"]);
  });
});
