import "server-only";
import { access, copyFile, mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { normalizeUserId, USER_ID_PATTERN } from "./store";

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
  "caldav-agenda-snapshot.json",
] as const;

/** Où les originaux sont mis de côté — jamais supprimés. */
const ARCHIVE_DIR = "_pre-multiuser";

export type MigrationReport =
  | { status: "already-migrated" }
  | { status: "fresh-install" }
  | { status: "blocked"; reason: string }
  | {
      status: "migrated";
      userId: string;
      files: string[];
      audioFiles: number;
      /** Les dictées laissées à la racine faute de place libre. Voir `migrateAudio`. */
      audioSkipped: string[];
    };

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Déplace `<dataDir>/audio/` vers le répertoire audio du compte.
 *
 * Fichier par fichier, et jamais par-dessus un existant : si le compte a déjà
 * un enregistrement du même nom, c'est le sien qui gagne.
 *
 * ⚠️ Un fichier ainsi sauté reste à la racine — et il y RESTERA : l'archive
 * créée juste après est la sentinelle d'idempotence, donc aucun démarrage
 * ultérieur ne repassera. Plus rien ne peut alors le servir, `/api/audio/<id>`
 * ne lisant que `store.audioDir()`. C'est acceptable (le fichier du compte est
 * le plus récent, et l'original n'est pas détruit) mais ça ne doit pas être
 * MUET : le compte est rendu à part et le journal le dit.
 */
async function migrateAudio(
  dataDir: string,
  targetDir: string,
): Promise<{ moved: number; skipped: string[] }> {
  const sourceDir = join(dataDir, "audio");
  if (!(await exists(sourceDir))) return { moved: 0, skipped: [] };

  await mkdir(targetDir, { recursive: true });
  let moved = 0;
  const skipped: string[] = [];
  for (const name of await readdir(sourceDir)) {
    const target = join(targetDir, name);
    if (await exists(target)) {
      skipped.push(name);
      continue;
    }
    await rename(join(sourceDir, name), target);
    moved += 1;
  }
  return { moved, skipped };
}

export async function migrateToMultiUser(): Promise<MigrationReport> {
  // Lu ici et non au chargement du module : `instrumentation.ts` importe ce
  // fichier dynamiquement, et les tests changent le répertoire à chaque cas.
  const dataDir = process.env.BRIEF_DATA_DIR || join(process.cwd(), ".data");
  const owner = process.env.BRIEF_OWNER_USER_ID;

  // 1. Déjà migré ? Le répertoire d'ARCHIVE fait foi — lui seul.
  //
  // ⚠️ NE PAS se fier à l'existence de `users/<owner>/` : ce répertoire est
  // créé par la première écriture venue. Un démarrage sans
  // `BRIEF_OWNER_USER_ID` laisse le serveur monter (par conception) ; dans la
  // minute, le cron CalDAV ou une simple connexion crée `users/<uuid>/`. Poser
  // la variable ensuite et redémarrer aurait alors rendu `already-migrated`, et
  // les vraies données seraient restées à la racine POUR TOUJOURS, jamais
  // archivées, jamais lues — avec un rassurant « rien à faire » dans le
  // journal. `_pre-multiuser/` n'est écrit que par cette fonction : c'est la
  // seule preuve qu'elle a réellement tourné.
  if (await exists(join(dataDir, ARCHIVE_DIR))) {
    return { status: "already-migrated" };
  }

  // 2. Rien à migrer ? Installation neuve, cas le plus courant en développement.
  //
  // ⚠️ Les enregistrements vocaux comptent. Depuis le pivot, plus rien n'écrit
  // dans `<dataDir>/audio/` : ce répertoire ne peut exister QUE s'il date
  // d'avant. Sans ce test, un `.data` qui n'aurait plus que des dictées (JSON
  // restaurés à la main, purge partielle) passerait pour neuf, et les
  // enregistrements resteraient à la racine — plus aucune fiche tâche ne
  // saurait les jouer.
  const present: string[] = [];
  for (const name of MIGRATED_FILES) {
    if (await exists(join(dataDir, name))) present.push(name);
  }
  const hasAudio = await exists(join(dataDir, "audio"));
  if (!present.length && !hasAudio) return { status: "fresh-install" };

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
  //
  // ⚠️ On n'ÉCRASE JAMAIS un fichier déjà présent chez le compte. Le cas se
  // produit si quelque chose a écrit avant la migration (démarrage sans
  // `BRIEF_OWNER_USER_ID`, puis variable posée) : le fichier du compte est
  // alors plus récent que celui de la racine, et le remplacer perdrait ce qui
  // a été fait entre-temps. L'original part quand même à l'archive, où il
  // reste consultable.
  // La MÊME normalisation que `storeForUser`, sans quoi un `BRIEF_OWNER_USER_ID`
  // saisi en majuscules ferait migrer vers `users/A1B2…/` pendant que les
  // routes liraient `users/a1b2…/`. Voir `normalizeUserId`.
  const ownerId = normalizeUserId(owner);
  const userDir = join(dataDir, "users", ownerId);
  await mkdir(userDir, { recursive: true });
  const copied: string[] = [];
  for (const name of present) {
    if (await exists(join(userDir, name))) {
      console.warn(
        `[migration] ${name} existe déjà pour le compte ${ownerId} — conservé tel quel, ` +
          `la version d'avant le multi-utilisateur part dans ${ARCHIVE_DIR}/.`,
      );
      continue;
    }
    await copyFile(join(dataDir, name), join(userDir, name));
    copied.push(name);
  }

  // 5. Les enregistrements vocaux, qui ne sont pas du JSON.
  //
  // Ceux-ci sont DÉPLACÉS, pas copiés : un fichier audio pèse jusqu'à 25 Mo et
  // en doubler le volume sur le disque du VPS n'apporte rien. Un `rename` ne
  // perd rien — la propriété « non destructive » est tenue.
  const movedAudio = await migrateAudio(dataDir, join(userDir, "audio"));

  const archiveDir = join(dataDir, ARCHIVE_DIR);
  await mkdir(archiveDir, { recursive: true });
  for (const name of present) {
    await rename(join(dataDir, name), join(archiveDir, name));
  }

  return {
    status: "migrated",
    userId: ownerId,
    files: copied,
    audioFiles: movedAudio.moved,
    audioSkipped: movedAudio.skipped,
  };
}
