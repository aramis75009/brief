import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La migration des données d'avant le pivot.
 *
 * ⚠️ C'est le seul code de ce lot qui TOUCHE aux données réelles d'Aramis, en
 * production, avec une synchro CalDAV vivante. Ce qui doit être vrai :
 *
 *   - rejouer un démarrage ne refait rien (les conteneurs redémarrent) ;
 *   - les originaux ne sont JAMAIS supprimés ;
 *   - sans propriétaire désigné, elle ne touche à rien — deviner attribuerait
 *     le Brief d'Aramis à un compte au hasard, et la synchro le propagerait au
 *     calendrier Apple de quelqu'un d'autre avant que ça ne se voie.
 */

const OWNER = "11111111-1111-4111-8111-111111111111";

let dir: string;

async function migrate() {
  process.env.BRIEF_DATA_DIR = dir;
  vi.resetModules();
  const { migrateToMultiUser } = await import("./migrate-multiuser");
  return migrateToMultiUser();
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "brief-migrate-"));
  process.env.BRIEF_OWNER_USER_ID = OWNER;
});

afterEach(async () => {
  delete process.env.BRIEF_DATA_DIR;
  delete process.env.BRIEF_OWNER_USER_ID;
  await rm(dir, { recursive: true, force: true });
});

describe("migrateToMultiUser", () => {
  it("ne touche à rien sur une installation neuve", async () => {
    expect(await migrate()).toEqual({ status: "fresh-install" });
    expect(await readdir(dir)).toEqual([]);
  });

  it("attribue les fichiers globaux au compte propriétaire", async () => {
    await writeFile(join(dir, "items.json"), '[{"id":"i1"}]', "utf8");
    await writeFile(join(dir, "settings.json"), '{"digest":false}', "utf8");

    const report = await migrate();

    expect(report.status).toBe("migrated");
    expect(await readFile(join(dir, "users", OWNER, "items.json"), "utf8")).toContain("i1");
    expect(await readFile(join(dir, "users", OWNER, "settings.json"), "utf8")).toContain(
      "digest",
    );
  });

  it("préserve les originaux au lieu de les supprimer", async () => {
    await writeFile(join(dir, "items.json"), '[{"id":"i1"}]', "utf8");

    await migrate();

    expect(await readFile(join(dir, "_pre-multiuser", "items.json"), "utf8")).toContain("i1");
    // Le fichier n'est plus à la racine : il ne doit pas être relu par erreur.
    await expect(readFile(join(dir, "items.json"), "utf8")).rejects.toThrow();
  });

  it("est idempotente : un second passage ne refait rien", async () => {
    await writeFile(join(dir, "items.json"), '[{"id":"i1"}]', "utf8");

    expect((await migrate()).status).toBe("migrated");
    expect(await migrate()).toEqual({ status: "already-migrated" });
  });

  it("ne réécrase pas un compte déjà peuplé si des fichiers globaux réapparaissent", async () => {
    // Une restauration partielle, ou un volume monté de travers : le compte a
    // déjà des données. Les écraser avec un vieux jeu global perdrait tout ce
    // qui a été fait depuis.
    await mkdir(join(dir, "users", OWNER), { recursive: true });
    await writeFile(join(dir, "users", OWNER, "items.json"), '[{"id":"recent"}]', "utf8");
    await writeFile(join(dir, "items.json"), '[{"id":"vieux"}]', "utf8");

    expect(await migrate()).toEqual({ status: "already-migrated" });
    expect(await readFile(join(dir, "users", OWNER, "items.json"), "utf8")).toContain("recent");
  });

  it("ne devine JAMAIS le propriétaire : sans la variable, elle ne touche à rien", async () => {
    await writeFile(join(dir, "items.json"), '[{"id":"i1"}]', "utf8");
    delete process.env.BRIEF_OWNER_USER_ID;

    const report = await migrate();

    expect(report.status).toBe("blocked");
    expect(await readdir(dir)).toEqual(["items.json"]);
  });

  it("refuse un BRIEF_OWNER_USER_ID qui n'est pas un UUID", async () => {
    await writeFile(join(dir, "items.json"), '[{"id":"i1"}]', "utf8");
    process.env.BRIEF_OWNER_USER_ID = "../../etc";

    expect((await migrate()).status).toBe("blocked");
    expect(await readdir(dir)).toEqual(["items.json"]);
  });

  it("migre les huit fichiers, et seulement ceux qui existent", async () => {
    const present = ["items.json", "projects.json", "push-subscriptions.json"];
    for (const f of present) await writeFile(join(dir, f), "[]", "utf8");
    // Un fichier étranger ne doit pas être emporté.
    await writeFile(join(dir, "autre-chose.json"), "[]", "utf8");

    const report = await migrate();

    expect(report.status).toBe("migrated");
    if (report.status !== "migrated") throw new Error("statut inattendu");
    expect(report.files.sort()).toEqual(present.sort());
    expect(report.userId).toBe(OWNER);
    expect(await readdir(join(dir, "users", OWNER))).toEqual(expect.arrayContaining(present));
    // Resté à la racine, intact.
    expect(await readFile(join(dir, "autre-chose.json"), "utf8")).toBe("[]");
  });
});
