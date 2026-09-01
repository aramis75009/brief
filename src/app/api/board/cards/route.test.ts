import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";
import type { Item, KanbanBoard } from "@/lib/types";
import { fakeStore, TEST_USER_ID } from "@/lib/testing/fake-store";

vi.mock("@/lib/guard");
vi.mock("@/lib/objective-reconcile");

/**
 * La route de déplacement de carte. Ce qui vaut un test :
 *   - la garde de session est la première ligne (route d'ÉCRITURE) ;
 *   - le calcul des rangs tourne DANS la file, sur la liste complète — un
 *     client qui ne voit que trois cartes sur dix ne doit pas pouvoir écraser
 *     l'ordre des sept autres ;
 *   - une colonne inconnue devient « non placée », jamais un `columnId` mort
 *     (c'est l'état qui rendait des cartes invisibles) ;
 *   - un corps malformé répond 400 sans rien écrire.
 */
describe("/api/board/cards", () => {
  let stored: Item[];
  let store: ReturnType<typeof fakeStore>;

  function item(id: string, columnId: string | null, columnOrder?: number, extra: Partial<Item> = {}): Item {
    return {
      id, kind: "task", title: id, projectId: "p1", due: null, allDay: true,
      priority: 4, rrule: null, columnId, columnOrder,
      createdAt: "2026-08-31T10:00:00.000Z", remindedAt: null, doneAt: null, ...extra,
    };
  }

  const board: KanbanBoard = {
    columns: [
      { id: "todo", name: "À faire", order: 0 },
      { id: "doing", name: "En cours", order: 1 },
    ],
    updatedAt: "2026-08-31T10:00:00.000Z",
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    stored = [item("a", "todo", 0), item("b", "todo", 1), item("c", "todo", 2)];
    const guard = await import("@/lib/guard");
    const reconcile = await import("@/lib/objective-reconcile");
    vi.mocked(reconcile.reconcileObjectivesInStore).mockResolvedValue(undefined as never);
    store = fakeStore({
      readBoard: vi.fn(async () => board),
      updateItemsAtomically: vi.fn(async (fn: (items: Item[]) => { id: string; patch: Partial<Item> }[]) => {
        const patches = fn(stored);
        const byId = new Map(patches.map((p) => [p.id, p.patch]));
        stored = stored.map((it) =>
          byId.has(it.id) ? { ...it, ...byId.get(it.id), id: it.id } : it,
        );
        return stored;
      }),
    });
    vi.mocked(guard.requireStore).mockResolvedValue({ userId: TEST_USER_ID, store });
  });

  const move = (body: unknown) =>
    PATCH(new Request("https://brief.example/api/board/cards", {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }));

  const order = (columnId: string | null) =>
    stored
      .filter((it) => (it.columnId ?? null) === columnId)
      .sort((x, y) => (x.columnOrder ?? 99) - (y.columnOrder ?? 99))
      .map((it) => it.id);

  it("refuse sans session, avant toute lecture", async () => {
    const guard = await import("@/lib/guard");
    vi.mocked(guard.requireStore).mockResolvedValue(new Response(null, { status: 401 }));
    expect((await move({ itemId: "a", toColumnId: "todo" })).status).toBe(401);
    expect(store.updateItemsAtomically).not.toHaveBeenCalled();
  });

  it("déplace une carte entre deux voisines", async () => {
    const res = await move({ itemId: "c", toColumnId: "todo", afterId: "a" });
    expect(res.status).toBe(200);
    expect(order("todo")).toEqual(["c", "a", "b"]);
  });

  it("change de colonne et retasse la colonne quittée", async () => {
    const res = await move({ itemId: "a", toColumnId: "doing" });
    expect(res.status).toBe(200);
    expect(order("doing")).toEqual(["a"]);
    expect(order("todo")).toEqual(["b", "c"]);
  });

  it("réindexe les cartes que le client ne voit pas", async () => {
    // Le client n'affiche que « a » et « c » (filtre projet) ; « b » lui est
    // masquée. Son intention ne doit pas effacer le rang de « b ».
    stored = [item("a", "todo", 0), item("b", "todo", 1, { projectId: "p2" }), item("c", "todo", 2)];
    await move({ itemId: "c", toColumnId: "todo", afterId: "a" });
    expect(order("todo")).toEqual(["c", "a", "b"]);
  });

  it("une colonne inconnue devient « non placée », jamais un columnId mort", async () => {
    const res = await move({ itemId: "a", toColumnId: "col-supprimee" });
    expect(res.status).toBe(200);
    expect(stored.find((it) => it.id === "a")?.columnId).toBeNull();
  });

  it("sort une carte du board avec toColumnId null", async () => {
    await move({ itemId: "b", toColumnId: null });
    expect(stored.find((it) => it.id === "b")?.columnId).toBeNull();
    expect(order("todo")).toEqual(["a", "c"]);
  });

  it("rend l'état frais des colonnes touchées", async () => {
    const res = await move({ itemId: "a", toColumnId: "doing" });
    const json = (await res.json()) as { columns: Record<string, { id: string; columnOrder?: number }[]> };
    expect(json.columns.doing.map((c) => c.id)).toEqual(["a"]);
    expect(json.columns.todo.map((c) => c.id)).toEqual(["b", "c"]);
  });

  it("404 sur un item inconnu, sans réconciliation", async () => {
    const reconcile = await import("@/lib/objective-reconcile");
    const res = await move({ itemId: "fantome", toColumnId: "todo" });
    expect(res.status).toBe(404);
    expect(reconcile.reconcileObjectivesInStore).not.toHaveBeenCalled();
  });

  it("400 sur un corps illisible, sans rien écrire", async () => {
    expect((await move("{pas du json")).status).toBe(400);
    expect(store.updateItemsAtomically).not.toHaveBeenCalled();
  });

  it("400 sur un itemId absent ou non textuel", async () => {
    expect((await move({ toColumnId: "todo" })).status).toBe(400);
    expect((await move({ itemId: { toString: () => "a" }, toColumnId: "todo" })).status).toBe(400);
  });

  it("400 sur un toColumnId qui n'est ni chaîne ni null", async () => {
    expect((await move({ itemId: "a", toColumnId: 42 })).status).toBe(400);
  });
});
