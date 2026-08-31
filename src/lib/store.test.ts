import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "./types";

/**
 * Le cloisonnement par compte — le test central du pivot multi-utilisateur.
 *
 * Ce que ces tests protègent ne lève aucune erreur quand on le casse : deux
 * comptes qui partagent un fichier se comportent normalement, répondent 200, et
 * l'un lit les tâches de l'autre.
 */

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function task(id: string, extra: Partial<Item> = {}): Item {
  return { id, kind: "task", title: id, ...extra } as Item;
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "brief-store-"));
  process.env.BRIEF_DATA_DIR = dir;
  // `store.ts` lit BRIEF_DATA_DIR à l'import : sans reset, tous les tests
  // écriraient dans le répertoire du premier.
  vi.resetModules();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("storeForUser", () => {
  it("cloisonne deux comptes : écrire chez A ne change rien chez B", async () => {
    const { storeForUser } = await import("./store");
    const a = storeForUser(A);
    const b = storeForUser(B);

    await a.saveItems([task("i1")]);

    expect(await a.readItems()).toHaveLength(1);
    expect(await b.readItems()).toEqual([]);
  });

  it("cloisonne les projets, les étiquettes et les objectifs", async () => {
    const { storeForUser } = await import("./store");
    const a = storeForUser(A);
    const b = storeForUser(B);

    await a.writeProjects([{ id: "p1", name: "Chez A", tint: 1 }]);
    await a.writeTags([{ id: "t1", name: "urgent", color: "red" }]);
    await a.writeObjectives([
      {
        id: "o1",
        projectId: "p1",
        title: "Objectif A",
        horizon: "court",
        createdAt: "2026-08-31T10:00:00.000Z",
        achievedAt: null,
        dependsOn: [],
      },
    ]);

    expect((await a.readProjects()).map((p) => p.id)).toEqual(["p1"]);
    expect(await a.readTags()).toHaveLength(1);
    expect(await a.readObjectives()).toHaveLength(1);

    // B n'a rien écrit : il voit les projets d'amorçage, pas ceux de A.
    expect((await b.readProjects()).some((p) => p.id === "p1")).toBe(false);
    expect(await b.readTags()).toEqual([]);
    expect(await b.readObjectives()).toEqual([]);
  });

  it("cloisonne les abonnements push", async () => {
    const { storeForUser } = await import("./store");
    const a = storeForUser(A);
    const b = storeForUser(B);

    await a.saveSubscription({
      endpoint: "https://example.com/x",
      keys: { p256dh: "p", auth: "a" },
    });

    expect(await a.readSubscriptions()).toHaveLength(1);
    expect(await b.readSubscriptions()).toEqual([]);
  });

  it("cloisonne le garde-fou de synchro CalDAV", async () => {
    const { storeForUser } = await import("./store");
    const a = storeForUser(A);
    const b = storeForUser(B);

    await a.writeLastCalDavSync(1_700_000_000_000);

    expect(await a.readLastCalDavSync()).toBe(1_700_000_000_000);
    // Sans cloisonnement, la synchro de A ferait sauter celle de B pendant 15 min.
    expect(await b.readLastCalDavSync()).toBeNull();
  });

  it("refuse un identifiant qui n'est pas un UUID", async () => {
    const { storeForUser } = await import("./store");
    expect(() => storeForUser("../../etc")).toThrow();
    expect(() => storeForUser("")).toThrow();
    expect(() => storeForUser("pas-un-uuid")).toThrow();
    expect(() => storeForUser("users/../../etc/passwd")).toThrow();
  });

  it("sérialise les écritures d'un même compte", async () => {
    const { storeForUser } = await import("./store");
    const a = storeForUser(A);
    await a.saveItems([task("i1")]);

    // Deux lecture-modification-écriture concurrentes : la seconde doit voir le
    // résultat de la première, pas l'état initial.
    await Promise.all([
      a.updateItemsAtomically((items) =>
        items.map((i) => ({ id: i.id, patch: { title: "un" } })),
      ),
      a.updateItemsAtomically((items) =>
        items.map((i) => ({ id: i.id, patch: { notes: "deux" } })),
      ),
    ]);

    const [item] = await a.readItems();
    expect(item.title).toBe("un");
    expect(item.notes).toBe("deux");
  });

  it("rend le même store pour le même compte", async () => {
    const { storeForUser } = await import("./store");
    expect(storeForUser(A)).toBe(storeForUser(A));
    expect(storeForUser(A)).not.toBe(storeForUser(B));
  });

  it("neutralise une date illisible à la lecture, par compte", async () => {
    const { storeForUser } = await import("./store");
    const a = storeForUser(A);

    // Le format DTSTART flottant qui avait éteint toute l'app le 2026-08-19.
    await a.saveItems([task("i1", { due: "20260820T140000" } as Partial<Item>)]);

    expect((await a.readItems())[0].due).toBeNull();
  });
});
