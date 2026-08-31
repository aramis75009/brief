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
