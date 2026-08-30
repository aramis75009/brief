import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Les réglages sur le disque.
 *
 * Le point qui compte n'est pas « ça relit ce qu'on a écrit » : c'est qu'un
 * fichier ABSENT ou ILLISIBLE rende `{ caldavSync: true, digest: true }`. Un
 * défaut à OFF couperait la synchro calendrier et le récap du matin au premier
 * déploiement sur un volume neuf, en silence.
 *
 * `store.ts` lit `BRIEF_DATA_DIR` au chargement du module : chaque cas
 * réimporte le module avec son propre dossier temporaire.
 */

let dir: string;

async function freshStore() {
  process.env.BRIEF_DATA_DIR = dir;
  // `vi.resetModules()` plutôt qu'un import avec query string : la query fait
  // perdre l'extension `.ts` au transformeur, qui refuse alors la syntaxe
  // `import { x, type Y }` de `store.ts`.
  vi.resetModules();
  return import("./store");
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "brief-settings-"));
});

afterEach(async () => {
  delete process.env.BRIEF_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("readSettings", () => {
  it("rend tout à ON quand settings.json n'existe pas", async () => {
    const { readSettings } = await freshStore();
    expect(await readSettings()).toEqual({ caldavSync: true, digest: true });
  });

  it("rend tout à ON quand le fichier est illisible", async () => {
    await writeFile(join(dir, "settings.json"), "{ pas du json", "utf8");
    const { readSettings } = await freshStore();
    expect(await readSettings()).toEqual({ caldavSync: true, digest: true });
  });

  it("relit ce qui a été écrit", async () => {
    await writeFile(
      join(dir, "settings.json"),
      JSON.stringify({ caldavSync: false, digest: true }),
      "utf8",
    );
    const { readSettings } = await freshStore();
    expect(await readSettings()).toEqual({ caldavSync: false, digest: true });
  });
});

describe("updateSettingsAtomically", () => {
  it("écrit le fichier quand un réglage change", async () => {
    const { updateSettingsAtomically, readSettings } = await freshStore();
    const next = await updateSettingsAtomically((s) => ({ ...s, digest: false }));
    expect(next).toEqual({ caldavSync: true, digest: false });
    expect(await readSettings()).toEqual({ caldavSync: true, digest: false });
  });

  it("n'écrit RIEN quand la fonction rend la même référence", async () => {
    const { updateSettingsAtomically } = await freshStore();
    await updateSettingsAtomically((s) => s);
    // Aucune écriture : le fichier ne doit toujours pas exister.
    await expect(readFile(join(dir, "settings.json"), "utf8")).rejects.toThrow();
  });

  it("sérialise deux écritures concurrentes sans en perdre une", async () => {
    const { updateSettingsAtomically, readSettings } = await freshStore();
    await Promise.all([
      updateSettingsAtomically((s) => ({ ...s, caldavSync: false })),
      updateSettingsAtomically((s) => ({ ...s, digest: false })),
    ]);
    expect(await readSettings()).toEqual({ caldavSync: false, digest: false });
  });
});
