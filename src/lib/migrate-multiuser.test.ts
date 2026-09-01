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

  it("n'écrase pas un fichier déjà présent chez le compte, mais archive quand même l'original", async () => {
    // Le scénario réel : un démarrage sans BRIEF_OWNER_USER_ID a laissé le
    // serveur monter, le cron CalDAV ou une connexion a créé `users/<owner>/`,
    // puis la variable est posée. Le fichier du compte est alors plus récent
    // que celui de la racine — l'écraser perdrait ce qui s'est fait entre-temps.
    await mkdir(join(dir, "users", OWNER), { recursive: true });
    await writeFile(join(dir, "users", OWNER, "items.json"), '[{"id":"recent"}]', "utf8");
    await writeFile(join(dir, "items.json"), '[{"id":"vieux"}]', "utf8");
    await writeFile(join(dir, "projects.json"), '[{"id":"p1"}]', "utf8");

    const report = await migrate();

    expect(report.status).toBe("migrated");
    if (report.status !== "migrated") throw new Error("statut inattendu");
    // `items.json` est conservé tel quel, `projects.json` est bien migré.
    expect(report.files).toEqual(["projects.json"]);
    expect(await readFile(join(dir, "users", OWNER, "items.json"), "utf8")).toContain("recent");
    expect(await readFile(join(dir, "users", OWNER, "projects.json"), "utf8")).toContain("p1");
    // L'original part quand même à l'archive : rien n'est jamais perdu.
    expect(await readFile(join(dir, "_pre-multiuser", "items.json"), "utf8")).toContain("vieux");
  });

  it("un démarrage bloqué ne condamne PAS la migration une fois la variable posée", async () => {
    // Le bug trouvé en revue : `already-migrated` se fiait à l'existence de
    // `users/<owner>/`, que n'importe quelle écriture crée. Un premier
    // démarrage sans la variable rendait donc la migration impossible POUR
    // TOUJOURS — avec un rassurant « rien à faire » dans le journal, et les
    // vraies données abandonnées à la racine.
    await writeFile(join(dir, "items.json"), '[{"id":"les-vraies-donnees"}]', "utf8");

    // 1er démarrage : pas de propriétaire désigné.
    delete process.env.BRIEF_OWNER_USER_ID;
    expect((await migrate()).status).toBe("blocked");

    // Le serveur a démarré quand même : le cron crée le répertoire du compte.
    await mkdir(join(dir, "users", OWNER), { recursive: true });
    await writeFile(join(dir, "users", OWNER, "caldav-last-sync.json"), "{}", "utf8");

    // 2e démarrage, variable posée : la migration DOIT avoir lieu.
    process.env.BRIEF_OWNER_USER_ID = OWNER;
    const report = await migrate();

    expect(report.status).toBe("migrated");
    expect(await readFile(join(dir, "users", OWNER, "items.json"), "utf8")).toContain(
      "les-vraies-donnees",
    );
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

  it("migre les neuf fichiers de compte, et seulement ceux qui existent", async () => {
    const present = ["items.json", "projects.json", "caldav-agenda-snapshot.json"];
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

  it("emporte les enregistrements vocaux, qui ne sont pas du JSON", async () => {
    // Les dictées sont référencées par `item.audioId` ; laissées à la racine,
    // la fiche tâche affiche un lecteur qui rend 404. Rien ne le signale.
    await writeFile(join(dir, "items.json"), '[{"id":"i1","audioId":"audio_abc"}]', "utf8");
    await mkdir(join(dir, "audio"), { recursive: true });
    await writeFile(join(dir, "audio", "audio_abc.webm"), "son", "utf8");

    const report = await migrate();

    if (report.status !== "migrated") throw new Error("statut inattendu");
    expect(report.audioFiles).toBe(1);
    expect(await readFile(join(dir, "users", OWNER, "audio", "audio_abc.webm"), "utf8")).toBe(
      "son",
    );
  });

  it("ne prend PAS pour neuf un répertoire qui n'a plus que des dictées", async () => {
    // Depuis le pivot, plus rien n'écrit dans `<dataDir>/audio/` : son existence
    // prouve à elle seule des données d'avant. Sans ce test, `fresh-install`
    // abandonnait les enregistrements à la racine, définitivement.
    await mkdir(join(dir, "audio"), { recursive: true });
    await writeFile(join(dir, "audio", "audio_abc.webm"), "son", "utf8");

    const report = await migrate();

    expect(report.status).toBe("migrated");
    if (report.status !== "migrated") throw new Error("statut inattendu");
    expect(report.files).toEqual([]);
    expect(report.audioFiles).toBe(1);
    expect(await readFile(join(dir, "users", OWNER, "audio", "audio_abc.webm"), "utf8")).toBe(
      "son",
    );
  });

  it("ne remplace pas une dictée déjà présente chez le compte", async () => {
    await mkdir(join(dir, "audio"), { recursive: true });
    await mkdir(join(dir, "users", OWNER, "audio"), { recursive: true });
    await writeFile(join(dir, "audio", "audio_abc.webm"), "ancien", "utf8");
    await writeFile(join(dir, "users", OWNER, "audio", "audio_abc.webm"), "récent", "utf8");

    const report = await migrate();

    if (report.status !== "migrated") throw new Error("statut inattendu");
    expect(report.audioFiles).toBe(0);
    expect(await readFile(join(dir, "users", OWNER, "audio", "audio_abc.webm"), "utf8")).toBe(
      "récent",
    );
    // L'ancien n'est pas supprimé pour autant : il reste là où il était.
    expect(await readFile(join(dir, "audio", "audio_abc.webm"), "utf8")).toBe("ancien");
    // ...mais il est RENDU, parce que plus aucun démarrage ne le reprendra :
    // l'archive créée juste après est la sentinelle d'idempotence.
    expect(report.audioSkipped).toEqual(["audio_abc.webm"]);
  });

  it("range sous l'identifiant EN MINUSCULES, quelle que soit la graphie de la variable", async () => {
    // Le piège de la casse. `BRIEF_OWNER_USER_ID` est saisi à la main sur le
    // VPS ; en majuscules, il passait la validation et la migration écrivait
    // dans `users/A1B2…/` pendant que les routes lisaient `users/a1b2…/` — deux
    // répertoires sur l'ext4 du VPS, un seul sur le macOS de développement.
    // Brief vide, données déjà archivées, aucune erreur.
    process.env.BRIEF_OWNER_USER_ID = OWNER.toUpperCase();
    await writeFile(join(dir, "items.json"), '[{"id":"i1"}]', "utf8");

    const report = await migrate();

    if (report.status !== "migrated") throw new Error("statut inattendu");
    expect(report.userId).toBe(OWNER);
    expect(await readFile(join(dir, "users", OWNER, "items.json"), "utf8")).toContain("i1");
    expect(await readdir(join(dir, "users"))).toEqual([OWNER]);
  });
});
