import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SEED_PROJECTS } from "./projects";
import { isRecord, type PushSubscriptionRecord } from "./push-subscription";
import { normalizeSettings, type Settings } from "./settings";
import type { Item, KanbanBoard, Objective, Project, Tag } from "./types";

/**
 * Stockage de Brief — fichiers JSON sur le disque du serveur, UN JEU PAR
 * COMPTE.
 *
 * Ce n'est pas un pis-aller : Brief a quelques comptes, quelques milliers
 * d'items par compte au grand maximum, et tourne sur un VPS avec un disque
 * persistant. Une base relationnelle ajouterait un service à superviser, à
 * sauvegarder et à migrer pour zéro gain mesurable à cette échelle. Le jour où
 * ça change — beaucoup d'utilisateurs, ou des requêtes que JSON ne sait pas
 * faire — tout est derrière le type `Store` ci-dessous.
 *
 * TROIS PROPRIÉTÉS QUE CE MODULE DOIT GARANTIR, parce que le cron des rappels
 * et les routes HTTP écrivent les mêmes fichiers en même temps :
 *
 *   1. ÉCRITURE ATOMIQUE. On écrit dans un fichier temporaire puis on renomme.
 *      `rename` est atomique sur un même système de fichiers : un lecteur voit
 *      soit l'ancien contenu complet, soit le nouveau, jamais un JSON tronqué.
 *      Sans ça, une coupure au mauvais moment détruit l'organisation entière.
 *
 *   2. SÉRIALISATION DES ÉCRITURES, PAR COMPTE. Une file d'attente en mémoire
 *      évite que deux lecture-modification-écriture concurrentes ne s'écrasent
 *      l'une l'autre. Elle est indexée par compte depuis le 2026-08-31 : la
 *      garantie d'origine est conservée à l'identique pour un même compte — ce
 *      dont `updateObjectivesAtomically` dépend, puisqu'il lit `items.json` ET
 *      `objectives.json` dans la même séquence — sans qu'un passage de cron
 *      lent chez un utilisateur ne bloque la requête interactive d'un autre.
 *      Vrai tant qu'il n'y a qu'un processus — c'est le cas, et le jour où ça
 *      ne l'est plus, il faudra un verrou de fichier.
 *
 *   3. CLOISONNEMENT. Les fichiers d'un compte vivent sous
 *      `BRIEF_DATA_DIR/users/<userId>/`. Rien dans ce module ne permet
 *      d'atteindre le répertoire d'un autre compte : `storeForUser` est le seul
 *      constructeur, et il valide son argument.
 *
 * ⚠️ CE MODULE N'EXPORTE AUCUNE FONCTION GLOBALE, et ce n'est pas un oubli.
 * Jusqu'au 2026-08-31 il exportait 18 fonctions lisant un jeu de fichiers
 * unique. En rétablir une seule rouvrirait un chemin où une route lit des
 * données qui n'appartiennent à personne — sans erreur, sans test rouge : le
 * fichier serait simplement absent et la route rendrait une liste vide.
 * C'est la suppression de ces exports qui a PROUVÉ que tous les appelants
 * étaient portés : le typecheck les a tous nommés.
 */

const DATA_DIR = process.env.BRIEF_DATA_DIR || join(process.cwd(), ".data");

/**
 * Un `sub` de JWT Supabase.
 *
 * ⚠️ Le `userId` entre dans un CHEMIN DE FICHIER — c'est nouveau depuis le
 * 2026-08-31, aucun chemin n'était dynamique avant. Un identifiant non validé
 * donnerait une traversée de répertoire (`../../etc`). Le JWT est signé par
 * Supabase, donc le risque est faible ; la garde coûte trois lignes et son
 * absence ne lève aucune erreur.
 */
export const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tout ce qu'un compte possède. Obtenu par `storeForUser`, jamais construit à la main. */
export type Store = {
  readProjects(): Promise<Project[]>;
  writeProjects(projects: Project[]): Promise<void>;
  readBoard(): Promise<KanbanBoard>;
  writeBoard(board: KanbanBoard): Promise<void>;
  updateBoardAtomically(fn: (board: KanbanBoard) => KanbanBoard): Promise<KanbanBoard>;
  readSettings(): Promise<Settings>;
  updateSettingsAtomically(fn: (settings: Settings) => Settings): Promise<Settings>;
  readTags(): Promise<Tag[]>;
  writeTags(tags: Tag[]): Promise<void>;
  readObjectives(): Promise<Objective[]>;
  writeObjectives(objectives: Objective[]): Promise<void>;
  updateObjectivesAtomically(
    fn: (objectives: Objective[], items: Item[]) => Objective[] | null,
  ): Promise<Objective[]>;
  readItems(): Promise<Item[]>;
  saveItems(items: Item[]): Promise<void>;
  patchItem(id: string, patch: Partial<Item>): Promise<Item | null>;
  deleteItem(id: string): Promise<boolean>;
  updateItemsAtomically(
    fn: (items: Item[]) => { id: string; patch: Partial<Item> }[],
  ): Promise<Item[]>;
  patchItems(patches: { id: string; patch: Partial<Item> }[]): Promise<number>;
  readSubscriptions(): Promise<PushSubscriptionRecord[]>;
  saveSubscription(sub: Omit<PushSubscriptionRecord, "createdAt">): Promise<void>;
  removeSubscription(endpoint: string): Promise<void>;
  /**
   * Accès JSON générique, RELATIF au répertoire du compte.
   *
   * ⚠️ Réservé à `caldav.ts`, qui persiste deux fichiers dont les formats lui
   * appartiennent (`SyncState`, `AgendaSnapshot`). Les typer ici forcerait
   * `store.ts` à importer `caldav.ts`, qui importe déjà `store.ts` — un cycle.
   *
   * Le cloisonnement tient : `name` est validé et résolu sous le répertoire du
   * compte, il ne peut pas en sortir. Ne pas s'en servir pour du code neuf :
   * une donnée qui mérite d'exister mérite une méthode nommée.
   */
  readUserJson<T>(name: string, fallback: T): Promise<T>;
  writeUserJson(name: string, value: unknown): Promise<void>;
  /**
   * Le répertoire des enregistrements vocaux du compte.
   *
   * Les fichiers audio ne sont pas du JSON : les routes `/api/audio` les
   * écrivent et les servent directement. Le store ne fait que dire OÙ — mais
   * il le dit, plutôt que de laisser chaque route recomposer un chemin depuis
   * `BRIEF_DATA_DIR`. C'est ce qu'elles faisaient jusqu'au 2026-08-31, et
   * n'importe quel compte pouvait alors lire les dictées d'un autre.
   */
  audioDir(): string;
};

/** Un nom de fichier de données, sans chemin. Interdit toute remontée (`..`). */
const DATA_FILE_PATTERN = /^[a-z0-9-]+\.json$/;

/* --- Primitives disque ---------------------------------------------------- */

async function readJsonAt<T>(dir: string, name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(join(dir, name), "utf8")) as T;
  } catch {
    // Fichier absent ou JSON illisible : on repart du défaut. L'absence de
    // données est un état normal au premier démarrage, pas une panne.
    return fallback;
  }
}

async function writeJsonAt(dir: string, name: string, value: unknown): Promise<void> {
  const path = join(dir, name);
  const tmp = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await rename(tmp, path);
}

/**
 * Les files d'écriture, une par compte. Chaque opération attend la précédente
 * du MÊME compte, jamais celle d'un autre.
 */
const writeChains = new Map<string, Promise<unknown>>();

function serializeFor<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = writeChains.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  // La chaîne ne doit jamais rester rejetée, sinon toutes les écritures
  // suivantes échoueraient en cascade sur une erreur déjà traitée.
  writeChains.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

/* --- Normalisations ------------------------------------------------------- */

const SEED_BOARD: KanbanBoard = {
  columns: [
    { id: "col-todo", name: "À faire", order: 0 },
    { id: "col-doing", name: "En cours", order: 1 },
    { id: "col-done", name: "Fait", order: 2 },
  ],
  updatedAt: new Date().toISOString(),
};

function normalizeObjective(o: Objective): Objective {
  return {
    ...o,
    dependsOn: Array.isArray(o.dependsOn) ? o.dependsOn : [],
    // ⚠️ Avant cette branche, le SEUL moyen d'atteindre un objectif était le
    // bouton « Atteint » (geste manuel). Un objectif historique a donc
    // `achievedAt` posé et `achievedManually` absent : sans ce défaut à `true`,
    // `reconcileObjectives` le rouvrirait en masse au premier GET après déploiement.
    achievedManually:
      typeof o.achievedManually === "boolean" ? o.achievedManually : o.achievedAt != null,
  };
}

/**
 * Normalise les items lus depuis le disque, en mémoire, SANS réécrire le
 * fichier (une donnée invalide ne doit pas être perdue tant que l'origine
 * n'est pas réparée).
 *
 * Garde-fou du 2026-08-19 : un `due` illisible (ex. `20260820T140000`, DTSTART
 * CalDAV flottant écrit tel quel) fait planter le rendu React (RangeError dans
 * `formatToParts`, via `zonedParts`). Règle du projet : une date illisible
 * devient « pas d'échéance » — jamais une date approximative.
 */
function normalizeItem(it: Item): Item {
  if (typeof it.due === "string") {
    const t = new Date(it.due).getTime();
    if (!Number.isFinite(t)) {
      console.warn(
        `[store] date invalide neutralisée (due=${JSON.stringify(it.due)}) sur l'item ${it.id} — traitée comme sans échéance`,
      );
      return { ...it, due: null };
    }
  }
  // Garantir les nouveaux champs Kanban — pas de réécriture du fichier,
  // normalisation en mémoire seulement (comme pour `due`).
  return {
    ...it,
    tags: Array.isArray(it.tags) ? it.tags : [],
    dependsOn: Array.isArray(it.dependsOn) ? it.dependsOn : [],
    columnId: it.columnId ?? null,
    // Même règle que `due` appliquée à un nombre : un `"3"` (chaîne) ou un
    // `NaN` venu d'un `items.json` édité à la main atteindrait le comparateur
    // de `kanban.ts` et rendrait l'ordre de la colonne non spécifié — sans
    // qu'aucune erreur ne soit levée.
    //
    // Le test est le MÊME que celui des deux chemins d'écriture (`coerce`,
    // `sanitizePatch`) : entier ≥ 0. Un `Number.isFinite` seul laissait passer
    // `-3` et `2.5`, que ni l'API ni l'UI ne peuvent produire — la
    // normalisation était plus faible que ce que son commentaire promettait.
    columnOrder:
      Number.isInteger(it.columnOrder) && (it.columnOrder as number) >= 0
        ? it.columnOrder
        : undefined,
    objectiveId: it.objectiveId ?? null,
  };
}

/**
 * Refuse tout nom de fichier qui pourrait sortir du répertoire du compte.
 *
 * Sans ce garde, `readUserJson("../<autre-compte>/items.json")` traverserait le
 * cloisonnement — et c'est le seul point du module où un nom de fichier vient
 * d'un appelant plutôt que d'une constante.
 */
function assertDataFileName(name: string): void {
  if (!DATA_FILE_PATTERN.test(name)) {
    throw new Error(`Nom de fichier de données invalide : ${JSON.stringify(name)}`);
  }
}

/* --- La fabrique ---------------------------------------------------------- */

/**
 * Construit les 23 méthodes d'un `Store` sur un répertoire donné.
 *
 * `key` indexe la file d'écriture : deux stores construits sur le même
 * répertoire DOIVENT partager leur file, sinon la sérialisation ne garantit
 * plus rien.
 */
function makeStore(dir: string, key: string): Store {
  const readJson = <T>(name: string, fallback: T) => readJsonAt<T>(dir, name, fallback);
  const writeJson = (name: string, value: unknown) => writeJsonAt(dir, name, value);
  const serialize = <T>(fn: () => Promise<T>) => serializeFor(key, fn);

  /**
   * Les items du compte. Extrait pour que `updateObjectivesAtomically` puisse
   * les lire sans passer par l'objet public.
   */
  const readItems = async (): Promise<Item[]> => {
    const items = await readJson<Item[]>("items.json", []);
    return items.map(normalizeItem);
  };

  return {
    /* --- Projets --------------------------------------------------------- */

    /**
     * Les projets stockés, ou la liste d'amorçage au PREMIER démarrage seulement.
     *
     * ⚠️ Le sentinelle `null` n'est pas une coquetterie : il distingue « le fichier
     * n'existe pas encore » de « l'utilisateur a supprimé tous ses projets ». Avec
     * un tableau vide comme défaut, ces deux cas étaient confondus, et supprimer le
     * dernier projet depuis les Réglages faisait RÉAPPARAÎTRE la liste d'amorçage
     * au rechargement suivant.
     */
    async readProjects() {
      const stored = await readJson<Project[] | null>("projects.json", null);
      if (stored === null) return SEED_PROJECTS;
      return stored.filter((p) => !p.archived);
    },

    writeProjects(projects) {
      return serialize(() => writeJson("projects.json", projects));
    },

    /* --- Board Kanban ---------------------------------------------------- */

    async readBoard() {
      const stored = await readJson<KanbanBoard | null>("boards.json", null);
      if (stored === null) return SEED_BOARD;
      return stored;
    },

    writeBoard(board) {
      return serialize(() => writeJson("boards.json", board));
    },

    /**
     * Lecture-modification-écriture ATOMIQUE du board : `fn` reçoit le board du
     * moment et rend le nouveau — ou la même référence pour ne rien écrire.
     *
     * `writeBoard` ne sérialise que l'écriture : `readBoard()` puis mutation puis
     * `writeBoard()` laisse une fenêtre où deux modifications concurrentes perdent
     * l'une des deux. C'était théorique tant que `reorder` n'avait aucun appelant ;
     * le glisser-déposer des colonnes en fait un geste rapide et répété.
     */
    updateBoardAtomically(fn) {
      return serialize(async () => {
        const stored = await readJson<KanbanBoard | null>("boards.json", null);
        const board = stored === null ? SEED_BOARD : stored;
        const next = fn(board);
        if (next !== board) await writeJson("boards.json", next);
        return next;
      });
    },

    /* --- Réglages -------------------------------------------------------- */

    /**
     * Les réglages stockés, ramenés à une forme utilisable.
     *
     * ⚠️ Le défaut n'est PAS un objet vide : c'est `DEFAULT_SETTINGS`, tout à ON.
     * Un `settings.json` absent est un état normal (premier démarrage, volume neuf,
     * restauration partielle) — le lire comme « tout éteint » couperait la synchro
     * calendrier et le récap du matin sans un seul message d'erreur. Voir l'en-tête
     * de `settings.ts`.
     */
    async readSettings() {
      return normalizeSettings(await readJson<unknown>("settings.json", null));
    },

    updateSettingsAtomically(fn) {
      return serialize(async () => {
        const settings = normalizeSettings(await readJson<unknown>("settings.json", null));
        const next = fn(settings);
        if (next !== settings) await writeJson("settings.json", next);
        return next;
      });
    },

    /* --- Tags ------------------------------------------------------------ */

    readTags() {
      return readJson<Tag[]>("tags.json", []);
    },

    writeTags(tags) {
      return serialize(() => writeJson("tags.json", tags));
    },

    /* --- Objectifs ------------------------------------------------------- */

    /**
     * Les objectifs stockés, ou une liste vide au premier démarrage. Un objectif
     * n'est pas un item : il survit à ses tâches, les orchestre — rien à semer.
     */
    async readObjectives() {
      const stored = await readJson<Objective[]>("objectives.json", []);
      // Normalisation en mémoire sans réécrire le fichier — même principe que
      // `normalizeItem` : une donnée absente ne doit pas obliger à migrer le disque.
      return stored.map(normalizeObjective);
    },

    writeObjectives(objectives) {
      return serialize(() => writeJson("objectives.json", objectives));
    },

    /**
     * Lecture-modification-écriture ATOMIQUE des objectifs : `fn` reçoit les
     * objectifs (normalisés) et les items du moment, renvoie le nouveau tableau —
     * ou `null` pour ne rien écrire. Toute la séquence tient dans la file
     * sérialisée, donc deux mutations concurrentes ne s'écrasent pas (une route
     * qui écrivait puis re-réconciliait en deux temps laissait une fenêtre).
     */
    updateObjectivesAtomically(fn) {
      return serialize(async () => {
        const [rawObjs, items] = await Promise.all([
          readJson<Objective[]>("objectives.json", []),
          readItems(),
        ]);
        const objectives = rawObjs.map(normalizeObjective);
        const next = fn(objectives, items);
        if (next && next !== objectives) await writeJson("objectives.json", next);
        return next ?? objectives;
      });
    },

    /* --- Items ----------------------------------------------------------- */

    readItems,

    /**
     * Ajoute ou remplace des items.
     *
     * L'`id` vient de l'appelant et est réutilisé tel quel : un second envoi du
     * même brouillon écrase au lieu de dupliquer. C'est ce qui rend le double-clic
     * et le rejeu d'une file d'attente hors-ligne inoffensifs, sans aucune logique
     * de déduplication à maintenir.
     */
    saveItems(items) {
      return serialize(async () => {
        const existing = await readItems();
        const incoming = new Set(items.map((i) => i.id));
        await writeJson("items.json", [...existing.filter((i) => !incoming.has(i.id)), ...items]);
      });
    },

    patchItem(id, patch) {
      return serialize(async () => {
        const items = await readItems();
        const index = items.findIndex((i) => i.id === id);
        if (index === -1) return null;
        const next = { ...items[index], ...patch, id };
        items[index] = next;
        await writeJson("items.json", items);
        return next;
      });
    },

    deleteItem(id) {
      return serialize(async () => {
        const items = await readItems();
        const next = items.filter((i) => i.id !== id);
        if (next.length === items.length) return false;
        await writeJson("items.json", next);
        return true;
      });
    },

    /**
     * Lecture-modification-écriture ATOMIQUE des items : `fn` reçoit tous les items
     * du moment et rend la liste des patches à appliquer — ou un tableau vide pour
     * ne rien écrire.
     *
     * Ce que `patchItems` seul ne suffit pas à garantir : il relit bien dans la
     * file, mais le CALCUL des patches se ferait avant, hors file, sur un état
     * périmé. Pour un déplacement de carte Kanban — qui renumérote jusqu'à deux
     * colonnes entières à partir de ce qu'il a lu — ça produit un ordre faux sans
     * qu'aucune requête n'échoue.
     */
    updateItemsAtomically(fn) {
      return serialize(async () => {
        const items = await readItems();
        const patches = fn(items);
        if (!patches.length) return items;
        const byId = new Map(patches.map((p) => [p.id, p.patch]));
        const next = items.map((item) => {
          const patch = byId.get(item.id);
          return patch ? { ...item, ...patch, id: item.id } : item;
        });
        await writeJson("items.json", next);
        return next;
      });
    },

    /**
     * Applique une modification à plusieurs items en UNE seule écriture.
     *
     * Le planificateur en a besoin : marquer dix rappels comme envoyés par dix
     * appels séparés, c'est dix cycles lecture-écriture et autant d'occasions de
     * réenvoyer un rappel déjà parti si le processus s'arrête au milieu.
     */
    async patchItems(patches) {
      if (!patches.length) return 0;
      return serialize(async () => {
        const items = await readItems();
        const byId = new Map(patches.map((p) => [p.id, p.patch]));
        let touched = 0;
        const next = items.map((item) => {
          const patch = byId.get(item.id);
          if (!patch) return item;
          touched += 1;
          return { ...item, ...patch, id: item.id };
        });
        if (touched) await writeJson("items.json", next);
        return touched;
      });
    },

    /* --- Abonnements push ------------------------------------------------ */

    async readSubscriptions() {
      const parsed = await readJson<unknown>("push-subscriptions.json", []);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isRecord);
    },

    /**
     * Enregistre ou remplace l'abonnement identifié par son endpoint.
     *
     * ⚠️ Passe par la file sérialisée, ce que l'ancien `push-store.ts` ne faisait
     * pas : un abonnement enregistré pendant qu'un passage de cron purgeait un
     * endpoint expiré pouvait être perdu, sans erreur.
     */
    saveSubscription(sub) {
      return serialize(async () => {
        const list = await readJsonAt<unknown>(dir, "push-subscriptions.json", []);
        const current = Array.isArray(list) ? list.filter(isRecord) : [];
        const next = current.filter((s) => s.endpoint !== sub.endpoint);
        next.push({ ...sub, createdAt: new Date().toISOString() });
        await writeJson("push-subscriptions.json", next);
      });
    },

    removeSubscription(endpoint) {
      return serialize(async () => {
        const list = await readJsonAt<unknown>(dir, "push-subscriptions.json", []);
        const current = Array.isArray(list) ? list.filter(isRecord) : [];
        await writeJson(
          "push-subscriptions.json",
          current.filter((s) => s.endpoint !== endpoint),
        );
      });
    },

    /* --- Accès générique (CalDAV) ---------------------------------------- */

    /**
     * ⚠️ Par compte, comme tout le reste : partagé, le garde-fou de fréquence
     * CalDAV d'un utilisateur ferait sauter la synchro de tous les autres
     * pendant 15 minutes — sans rien signaler.
     */
    // `async` des deux côtés, pour que le garde REJETTE au lieu de lever
    // synchroniquement : un appelant qui fait `.catch()` sans `await` ne doit
    // pas voir passer l'exception à côté de sa gestion d'erreur.
    async readUserJson<T>(name: string, fallback: T): Promise<T> {
      assertDataFileName(name);
      return readJson<T>(name, fallback);
    },

    async writeUserJson(name, value) {
      assertDataFileName(name);
      return serialize(() => writeJson(name, value));
    },

    /* --- Enregistrements vocaux ------------------------------------------ */

    audioDir() {
      return join(dir, "audio");
    },
  };
}

/** Les stores déjà construits — un objet stable par compte. */
const stores = new Map<string, Store>();

/**
 * Le store d'UN compte. Seul constructeur public.
 *
 * ⚠️ Réservé aux crons et à la migration. Une route obtient son store par
 * `requireStore()` (`guard.ts`) : elle ne choisit jamais l'identifiant
 * elle-même. `src/lib/no-direct-store-access.test.ts` fige cette règle.
 */
export function storeForUser(userId: string): Store {
  if (!USER_ID_PATTERN.test(userId)) {
    throw new Error(
      `Identifiant de compte invalide : ${JSON.stringify(userId)} n'est pas un UUID.`,
    );
  }
  const existing = stores.get(userId);
  if (existing) return existing;
  const store = makeStore(join(DATA_DIR, "users", userId), userId);
  stores.set(userId, store);
  return store;
}
