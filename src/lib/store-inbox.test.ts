import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InboxEvent, Portfolio } from "./types";

/**
 * Portefeuilles et boîte de réception — les deux jeux de données ajoutés par
 * la refonte v2.
 *
 * Comme partout dans `store.ts`, ce qui est protégé ici ne lève rien quand on
 * le casse : un journal trié à l'envers, un doublon écrit à chaque passage de
 * cron ou un portefeuille visible d'un compte à l'autre se comportent
 * normalement et répondent 200.
 */

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function evt(id: string, at: string, over: Partial<InboxEvent> = {}): InboxEvent {
  return { id, kind: "reminder", title: id, body: "corps", at, readAt: null, ...over };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "brief-inbox-"));
  process.env.BRIEF_DATA_DIR = dir;
  vi.resetModules();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/* --- Portefeuilles -------------------------------------------------------- */

describe("portefeuilles", () => {
  it("cloisonne deux comptes", async () => {
    const { storeForUser } = await import("./store");
    const pf: Portfolio = {
      id: "pf1",
      name: "Revente",
      projectIds: ["p1"],
      createdAt: "2026-09-07T08:00:00.000Z",
    };
    await storeForUser(A).writePortfolios([pf]);

    expect(await storeForUser(A).readPortfolios()).toHaveLength(1);
    expect(await storeForUser(B).readPortfolios()).toEqual([]);
  });

  it("rend une liste vide au premier démarrage", async () => {
    const { storeForUser } = await import("./store");
    expect(await storeForUser(A).readPortfolios()).toEqual([]);
  });

  it("normalise un projectIds absent en tableau vide plutôt que de laisser passer undefined", async () => {
    const { storeForUser } = await import("./store");
    const store = storeForUser(A);
    // Un fichier écrit par une version antérieure : `.map()` sur `undefined`
    // lèverait au premier rendu, dans un composant client — écran blanc.
    await store.writeUserJson("portfolios.json", [{ id: "pf1", name: "X", createdAt: "2026-09-07T08:00:00.000Z" }]);
    expect((await store.readPortfolios())[0].projectIds).toEqual([]);
  });

  it("updatePortfoliosAtomically n'écrit pas quand fn rend null", async () => {
    const { storeForUser } = await import("./store");
    const store = storeForUser(A);
    await store.writePortfolios([
      { id: "pf1", name: "Revente", projectIds: [], createdAt: "2026-09-07T08:00:00.000Z" },
    ]);
    const out = await store.updatePortfoliosAtomically(() => null);
    expect(out).toHaveLength(1);
    expect((await store.readPortfolios())[0].name).toBe("Revente");
  });

  it("updatePortfoliosAtomically écrit quand fn rend un nouveau tableau", async () => {
    const { storeForUser } = await import("./store");
    const store = storeForUser(A);
    await store.updatePortfoliosAtomically(() => [
      { id: "pf1", name: "Formation", projectIds: ["p3"], createdAt: "2026-09-07T08:00:00.000Z" },
    ]);
    expect((await store.readPortfolios())[0].name).toBe("Formation");
  });
});

/* --- Boîte de réception --------------------------------------------------- */

describe("boîte de réception", () => {
  it("rend le journal du plus récent au plus ancien, quel que soit l'ordre d'écriture", async () => {
    const { storeForUser } = await import("./store");
    const store = storeForUser(A);
    await store.appendInbox([
      evt("vieux", "2026-09-01T08:00:00.000Z"),
      evt("recent", "2026-09-07T08:00:00.000Z"),
      evt("milieu", "2026-09-04T08:00:00.000Z"),
    ]);
    expect((await store.readInbox()).map((e) => e.id)).toEqual(["recent", "milieu", "vieux"]);
  });

  it("dédoublonne par id — le cron repasse toutes les 60 s sur les mêmes faits", async () => {
    const { storeForUser } = await import("./store");
    const store = storeForUser(A);
    await store.appendInbox([evt("rappel-1", "2026-09-07T08:00:00.000Z")]);
    await store.appendInbox([evt("rappel-1", "2026-09-07T08:00:00.000Z")]);
    await store.appendInbox([evt("rappel-1", "2026-09-07T08:00:00.000Z")]);
    expect(await store.readInbox()).toHaveLength(1);
  });

  it("borne le journal à 200 entrées et garde les plus RÉCENTES", async () => {
    const { storeForUser } = await import("./store");
    const store = storeForUser(A);
    const many = Array.from({ length: 250 }, (_, i) =>
      // i croissant → date croissante : les derniers sont les plus récents.
      evt(`e${i}`, new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString()),
    );
    await store.appendInbox(many);
    const out = await store.readInbox();
    expect(out).toHaveLength(200);
    expect(out[0].id).toBe("e249");
    expect(out.some((e) => e.id === "e0")).toBe(false);
  });

  it("jette une entrée mal formée sans faire tomber le journal", async () => {
    const { storeForUser } = await import("./store");
    const store = storeForUser(A);
    await store.writeUserJson("inbox.json", [
      evt("bon", "2026-09-07T08:00:00.000Z"),
      { id: "sans-date", kind: "reminder", title: "x", body: "y", readAt: null },
      { id: "date-illisible", kind: "reminder", title: "x", body: "y", at: "pas une date", readAt: null },
      { id: "kind-inconnu", kind: "martien", title: "x", body: "y", at: "2026-09-07T08:00:00.000Z", readAt: null },
      null,
    ]);
    expect((await store.readInbox()).map((e) => e.id)).toEqual(["bon"]);
  });

  it("markInboxRead sans ids marque tout le journal", async () => {
    const { storeForUser } = await import("./store");
    const store = storeForUser(A);
    await store.appendInbox([
      evt("a", "2026-09-07T08:00:00.000Z"),
      evt("b", "2026-09-06T08:00:00.000Z"),
    ]);
    const out = await store.markInboxRead([]);
    expect(out.every((e) => e.readAt !== null)).toBe(true);
  });

  it("markInboxRead avec des ids ne touche que ceux-là", async () => {
    const { storeForUser } = await import("./store");
    const store = storeForUser(A);
    await store.appendInbox([
      evt("a", "2026-09-07T08:00:00.000Z"),
      evt("b", "2026-09-06T08:00:00.000Z"),
    ]);
    const out = await store.markInboxRead(["a"]);
    expect(out.find((e) => e.id === "a")?.readAt).not.toBeNull();
    expect(out.find((e) => e.id === "b")?.readAt).toBeNull();
  });

  it("markInboxRead ne réécrit pas un événement déjà lu", async () => {
    const { storeForUser } = await import("./store");
    const store = storeForUser(A);
    await store.appendInbox([evt("a", "2026-09-07T08:00:00.000Z")]);
    const first = await store.markInboxRead([]);
    const readAt = first[0].readAt;
    const second = await store.markInboxRead([]);
    expect(second[0].readAt).toBe(readAt);
  });

  it("cloisonne le journal entre deux comptes", async () => {
    const { storeForUser } = await import("./store");
    await storeForUser(A).appendInbox([evt("a", "2026-09-07T08:00:00.000Z")]);
    expect(await storeForUser(B).readInbox()).toEqual([]);
  });
});

/* --- Répertoire des pièces jointes ---------------------------------------- */

describe("attachmentsDir", () => {
  it("vit sous le répertoire du compte, comme audioDir", async () => {
    const { storeForUser } = await import("./store");
    const a = storeForUser(A).attachmentsDir();
    const b = storeForUser(B).attachmentsDir();
    expect(a).toContain(join("users", A));
    expect(a).not.toBe(b);
  });
});
