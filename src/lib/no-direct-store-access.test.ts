import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Le cloisonnement repose sur UNE règle : une route obtient son store de
 * `requireStore()`, jamais en fabriquant un `storeForUser` avec un identifiant
 * qu'elle a choisi elle-même.
 *
 * Ce test la rend mécanique. Sans lui, la règle vit dans la documentation, et
 * une route ajoutée dans six mois la violerait sans que rien ne le signale :
 * le code compile, les tests passent, et un compte lit les données d'un autre.
 *
 * Les CRONS ont le droit d'appeler `storeForUser` — ils n'ont pas de session et
 * itèrent sur tous les comptes. D'où la liste d'exceptions, volontairement
 * courte : y ajouter une ligne doit demander un effort et se voir en revue.
 */
const ALLOWED = [
  join("src", "app", "api", "cron", "reminders", "route.ts"),
  join("src", "app", "api", "cron", "caldav-sync", "route.ts"),
];

async function routeFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await routeFiles(full)));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("cloisonnement des routes", () => {
  it("aucune route ne fabrique un store elle-même", async () => {
    const offenders: string[] = [];

    for (const file of await routeFiles(join("src", "app", "api"))) {
      if (ALLOWED.includes(file)) continue;
      if ((await readFile(file, "utf8")).includes("storeForUser")) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });

  it("aucune route ne LIT `process.env.BRIEF_DATA_DIR`", async () => {
    // La classe d'oubli que le premier test ne voit PAS, trouvée en revue le
    // 2026-08-31 : les deux routes `/api/audio` ne touchaient pas au store du
    // tout — elles lisaient `join(BRIEF_DATA_DIR, "audio")` directement. Elles
    // passaient donc l'invariant ci-dessus tout en laissant n'importe quel
    // compte autorisé servir la dictée d'un autre.
    //
    // Une route ne doit jamais savoir où vit `BRIEF_DATA_DIR` : c'est le rôle
    // du store, et lui seul sait à quel compte le chemin appartient.
    const offenders: string[] = [];

    for (const file of await routeFiles(join("src", "app", "api"))) {
      // On cherche la LECTURE de la variable, pas son nom : un commentaire qui
      // explique pourquoi il ne faut pas la lire n'est pas une infraction.
      if ((await readFile(file, "utf8")).includes("process.env.BRIEF_DATA_DIR")) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("la liste d'exceptions ne contient que des crons, et ils existent", async () => {
    // Une exception qui pointe vers un fichier disparu ne protège plus rien —
    // et masquerait une route renommée qui, elle, aurait le droit de tricher.
    const all = await routeFiles(join("src", "app", "api"));
    for (const allowed of ALLOWED) {
      expect(all).toContain(allowed);
      expect(allowed).toContain(join("api", "cron"));
    }
  });
});
