import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "./route";
import type { Item, KanbanBoard } from "@/lib/types";
import { fakeStore, TEST_USER_ID } from "@/lib/testing/fake-store";

vi.mock("@/lib/guard");
vi.mock("@/lib/objective-reconcile");

/**
 * Les actions du board. Ce qui vaut un test :
 *   - **`delete` détache les cartes** — c'est le bug que trois voix de la revue
 *     ont remonté : sans ça, elles gardent un `columnId` mort et disparaissent
 *     du board sans un mot (ni dans une colonne, ni dans « Non placées ») ;
 *   - l'ordre des deux écritures : les cartes AVANT la colonne, pour qu'une
 *     panne au milieu laisse l'état sûr ;
 *   - `wip` refuse ce qui n'est pas un entier ≥ 1 plutôt que de le raboter ;
 *   - `reorder` ne fait pas sauter en tête une colonne absente de la liste
 *     (un autre onglet vient de la créer).
 */
describe("PATCH /api/board", () => {
  let board: KanbanBoard;
  let items: Item[];
  let writeOrder: string[];
  let store: ReturnType<typeof fakeStore>;

  function item(id: string, columnId: string | null, columnOrder?: number): Item {
    return {
      id, kind: "task", title: id, projectId: "p1", due: null, allDay: true,
      priority: 4, rrule: null, columnId, columnOrder,
      createdAt: "2026-08-31T10:00:00.000Z", remindedAt: null, doneAt: null,
    };
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    writeOrder = [];
    board = {
      columns: [
        { id: "todo", name: "À faire", order: 0 },
        { id: "doing", name: "En cours", order: 1 },
        { id: "done", name: "Fait", order: 2 },
      ],
      updatedAt: "2026-08-31T10:00:00.000Z",
    };
    items = [item("a", "doing", 0), item("b", "doing", 1), item("c", "todo", 0)];

    const guard = await import("@/lib/guard");
    const reconcile = await import("@/lib/objective-reconcile");
    vi.mocked(reconcile.reconcileObjectivesInStore).mockResolvedValue(undefined as never);

    store = fakeStore({
      readBoard: vi.fn(async () => board),
      updateBoardAtomically: vi.fn(async (fn) => {
        writeOrder.push("board");
        board = fn(board);
        return board;
      }),
      updateItemsAtomically: vi.fn(async (fn: (items: Item[]) => { id: string; patch: Partial<Item> }[]) => {
        writeOrder.push("items");
        const byId = new Map(fn(items).map((p) => [p.id, p.patch]));
        items = items.map((it) =>
          byId.has(it.id) ? { ...it, ...byId.get(it.id), id: it.id } : it,
        );
        return items;
      }),
    });
    vi.mocked(guard.requireStore).mockResolvedValue({ userId: TEST_USER_ID, store });
  });

  const patch = (body: unknown) =>
    PATCH(new Request("https://brief.example/api/board", {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }));

  it("refuse sans session — la garde est la première ligne", async () => {
    const guard = await import("@/lib/guard");
    vi.mocked(guard.requireStore).mockResolvedValue(new Response(null, { status: 401 }));
    expect((await patch({ action: "add", name: "X" })).status).toBe(401);
    expect(store.updateBoardAtomically).not.toHaveBeenCalled();
  });

  describe("GET — passe de récupération", () => {
    it("ramasse les cartes orphelines des suppressions PASSÉES", async () => {
      // L'ancienne action `delete` retirait la colonne sans toucher aux cartes.
      // `items.json` en prod porte donc des `columnId` morts : ces cartes ne
      // s'affichent dans aucune colonne, ni dans « Non placées » (`!columnId`).
      items = [item("orpheline", "col-supprimee-en-aout", 3), item("saine", "todo", 0)];

      const res = await GET(new Request("https://brief.example/api/board"));
      expect(res.status).toBe(200);

      const recovered = items.find((it) => it.id === "orpheline")!;
      expect(recovered.columnId).toBeNull();
      expect(recovered.columnOrder).toBeUndefined();
      expect(items.find((it) => it.id === "saine")!.columnId).toBe("todo");
    });

    it("n'écrit rien quand le board est sain", async () => {
        await GET(new Request("https://brief.example/api/board"));
      // `updateItemsAtomically` est appelée, mais son plan est vide — c'est elle
      // qui décide de ne pas écrire. Ce qui compte : aucun item n'a bougé.
      expect(items.every((it) => it.columnId !== null)).toBe(true);
      expect(store.updateBoardAtomically).not.toHaveBeenCalled();
    });

    it("refuse sans session", async () => {
      const guard = await import("@/lib/guard");
      vi.mocked(guard.requireStore).mockResolvedValue(new Response(null, { status: 401 }));
      expect((await GET(new Request("https://brief.example/api/board"))).status).toBe(401);
    });
  });

  describe("delete", () => {
    it("renvoie les cartes de la colonne en « Non placées » au lieu de les perdre", async () => {
      const res = await patch({ action: "delete", id: "doing" });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ detached: 2 });

      expect(items.filter((it) => it.columnId === "doing")).toHaveLength(0);
      for (const id of ["a", "b"]) {
        const moved = items.find((it) => it.id === id)!;
        expect(moved.columnId).toBeNull();
        // Le rang doit partir AVEC la colonne : gardé, il classerait la carte
        // dans « Non placées » selon une position qui n'a plus de sens.
        expect(moved.columnOrder).toBeUndefined();
      }
      // La carte d'une autre colonne n'a pas bougé.
      expect(items.find((it) => it.id === "c")!.columnId).toBe("todo");
    });

    it("écrit les cartes AVANT la colonne", async () => {
      await patch({ action: "delete", id: "doing" });
      expect(writeOrder).toEqual(["items", "board"]);
    });

    it("renumérote les colonnes restantes sans trou", async () => {
      await patch({ action: "delete", id: "doing" });
      expect(board.columns.map((c) => [c.id, c.order])).toEqual([["todo", 0], ["done", 1]]);
    });

    it("réconcilie les objectifs — l'invariant AGENTS.md n'a pas de liste blanche", async () => {
      const reconcile = await import("@/lib/objective-reconcile");
      await patch({ action: "delete", id: "doing" });
      expect(reconcile.reconcileObjectivesInStore).toHaveBeenCalledTimes(1);
    });

    it("ne réconcilie pas quand la colonne était vide — rien n'a été écrit", async () => {
      const reconcile = await import("@/lib/objective-reconcile");
      await patch({ action: "delete", id: "done" });
      expect(reconcile.reconcileObjectivesInStore).not.toHaveBeenCalled();
    });
  });

  describe("reorder", () => {
    it("applique l'ordre demandé", async () => {
      await patch({ action: "reorder", order: ["done", "todo", "doing"] });
      expect(board.columns.map((c) => c.id)).toEqual(["done", "todo", "doing"]);
      expect(board.columns.map((c) => c.order)).toEqual([0, 1, 2]);
    });

    it("met en fin une colonne absente de la liste, jamais en tête", async () => {
      await patch({ action: "reorder", order: ["done", "todo"] });
      expect(board.columns.map((c) => c.id)).toEqual(["done", "todo", "doing"]);
    });

    it("refuse un `order` qui n'est pas un tableau", async () => {
      expect((await patch({ action: "reorder", order: "todo" })).status).toBe(400);
    });
  });

  describe("wip", () => {
    it("pose une limite entière", async () => {
      expect((await patch({ action: "wip", id: "doing", limit: 3 })).status).toBe(200);
      expect(board.columns.find((c) => c.id === "doing")!.wipLimit).toBe(3);
    });

    it("efface la limite avec null", async () => {
      await patch({ action: "wip", id: "doing", limit: 3 });
      await patch({ action: "wip", id: "doing", limit: null });
      expect(board.columns.find((c) => c.id === "doing")).not.toHaveProperty("wipLimit");
    });

    it.each([0, -1, 2.5, 1000, "3", {}])("refuse %o plutôt que de le raboter", async (limit) => {
      const res = await patch({ action: "wip", id: "doing", limit });
      expect(res.status).toBe(400);
      expect(board.columns.find((c) => c.id === "doing")).not.toHaveProperty("wipLimit");
    });

    it("répond 404 sur une colonne inconnue", async () => {
      expect((await patch({ action: "wip", id: "fantome", limit: 3 })).status).toBe(404);
    });
  });

  describe("rename", () => {
    it("refuse un nom vide au lieu d'effacer le nom de la colonne", async () => {
      expect((await patch({ action: "rename", id: "todo", name: "   " })).status).toBe(400);
      expect(board.columns.find((c) => c.id === "todo")!.name).toBe("À faire");
    });

    it("répond 404 sur une colonne inconnue", async () => {
      expect((await patch({ action: "rename", id: "fantome", name: "X" })).status).toBe(404);
    });
  });

  it("répond 400 sur un JSON illisible", async () => {
    expect((await patch("{pas du json")).status).toBe(400);
  });
});
