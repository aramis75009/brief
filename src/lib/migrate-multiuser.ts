import "server-only";
import { access, copyFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { USER_ID_PATTERN } from "./store";

/**
 * Migration unique : les fichiers globaux d'avant le 2026-08-31 deviennent le
 * Brief du compte propriétaire.
 *
 * Jusqu'à cette date, Brief écrivait un seul jeu de fichiers pour tout le
 * monde. Le pivot multi-utilisateur les déplace sous `users/<userId>/` ; sans
 * cette migration, Aramis rouvrirait un Brief vide après le déploiement, et ses
 * vraies données resteraient sur le disque sans que rien ne les lise.
 *
 * TROIS PROPRIÉTÉS :
 *
 *   1. IDEMPOTENTE. Rejouer un démarrage ne refait rien — un conteneur
 *      redémarre, et deux fois plutôt qu'une le jour d'un déploiement.
 *
 *   2. NON DESTRUCTIVE. Les originaux partent dans `_pre-multiuser/`, jamais à
 *      la corbeille. `deploy/backup.sh` les emporte comme le reste.
 *
 *   3. ELLE NE DEVINE JAMAIS. Sans `BRIEF_OWNER_USER_ID`, elle s'arrête et le
 *      dit. Un Brief vide se voit au premier écran ; des données attribuées au
 *      mauvais compte, non — et la synchro CalDAV les propagerait au calendrier
 *      Apple de quelqu'un d'autre avant que personne ne s'en aperçoive.
 */

/** Les fichiers qu'un compte possède. Tout le reste de `BRIEF_DATA_DIR` est étranger. */
const MIGRATED_FILES = [
  "items.json",
  "projects.json",
  "boards.json",
  "tags.json",
  "objectives.json",
  "settings.json",
  "push-subscriptions.json",
  "caldav-last-sync.json",
] as const;

/** Où les originaux sont mis de côté — jamais supprimés. */
const ARCHIVE_DIR = "_pre-multiuser";

export type MigrationReport =
  | { status: "already-migrated" }
  | { status: "fresh-install" }
  | { status: "blocked"; reason: string }
  | { status: "migrated"; userId: string; files: string[] };

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function migrateToMultiUser(): Promise<MigrationReport> {
  // Lu ici et non au chargement du module : `instrumentation.ts` importe ce
  // fichier dynamiquement, et les tests changent le répertoire à chaque cas.
  const dataDir = process.env.BRIEF_DATA_DIR || join(process.cwd(), ".data");
  const owner = process.env.BRIEF_OWNER_USER_ID;

  // 1. Déjà migré ? Le répertoire du propriétaire fait foi.
  //
  // ⚠️ Ce test passe AVANT celui des fichiers globaux, délibérément : une
  // restauration partielle peut laisser réapparaître un vieux jeu global à côté
  // d'un compte déjà peuplé. Copier par-dessus perdrait tout ce qui a été fait
  // depuis la migration.
  if (owner && USER_ID_PATTERN.test(owner) && (await exists(join(dataDir, "users", owner)))) {
    return { status: "already-migrated" };
  }

  // 2. Rien à migrer ? Installation neuve, cas le plus courant en développement.
  const present: string[] = [];
  for (const name of MIGRATED_FILES) {
    if (await exists(join(dataDir, name))) present.push(name);
  }
  if (!present.length) return { status: "fresh-install" };

  // 3. Des données existent, mais on ne sait pas à qui elles sont.
  if (!owner || !USER_ID_PATTERN.test(owner)) {
    return {
      status: "blocked",
      reason:
        "BRIEF_OWNER_USER_ID est absent ou n'est pas un UUID, alors que des données " +
        "d'avant le multi-utilisateur existent. Rien n'a été déplacé : poser la variable " +
        "avec l'identifiant Supabase du propriétaire, puis redémarrer.",
    };
  }

  // 4. Copier vers le compte, puis archiver les originaux.
  //
  // Copie AVANT déplacement, dans cet ordre : si le processus s'arrête entre
  // les deux, les données existent à deux endroits — jamais à zéro.
  const userDir = join(dataDir, "users", owner);
  await mkdir(userDir, { recursive: true });
  for (const name of present) {
    await copyFile(join(dataDir, name), join(userDir, name));
  }

  const archiveDir = join(dataDir, ARCHIVE_DIR);
  await mkdir(archiveDir, { recursive: true });
  for (const name of present) {
    await rename(join(dataDir, name), join(archiveDir, name));
  }

  return { status: "migrated", userId: owner, files: present };
}
