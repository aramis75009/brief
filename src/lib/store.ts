import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SEED_PROJECTS } from "./projects";
import { normalizeSettings, type Settings } from "./settings";
import type { Item, KanbanBoard, Objective, Project, Tag } from "./types";

/**
 * Stockage de Brief — fichiers JSON sur le disque du serveur.
 *
 * Ce n'est pas un pis-aller : Brief a exactement un utilisateur, quelques
 * milliers d'items au grand maximum, et tourne sur un VPS avec un disque
 * persistant. Une base relationnelle ajouterait un service à superviser, à
 * sauvegarder et à migrer pour zéro gain mesurable à cette échelle. Le jour où
 * ça change — plusieurs utilisateurs, ou des requêtes que JSON ne sait pas
 * faire — tout est derrière les fonctions exportées ci-dessous.
 *
 * DEUX PROPRIÉTÉS QUE CE MODULE DOIT GARANTIR, parce que le cron des rappels et
 * les routes HTTP écrivent le même fichier en même temps :
 *
 *   1. ÉCRITURE ATOMIQUE. On écrit dans un fichier temporaire puis on renomme.
 *      `rename` est atomique sur un même système de fichiers : un lecteur voit
 *      soit l'ancien contenu complet, soit le nouveau, jamais un JSON tronqué.
 *      Sans ça, une coupure au mauvais moment détruit l'organisation entière.
 *
 *   2. SÉRIALISATION DES ÉCRITURES. Une file d'attente en mémoire évite que
 *      deux lecture-modification-écriture concurrentes ne s'écrasent l'une
 *      l'autre. Vrai tant qu'il n'y a qu'un processus — c'est le cas, et le
 *      jour où ça ne l'est plus, il faudra un verrou de fichier.
 */

const DATA_DIR = process.env.BRIEF_DATA_DIR || join(process.cwd(), ".data");

/** File d'écriture : chaque opération attend la précédente. */
let writeChain: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  // La chaîne ne doit jamais rester rejetée, sinon toutes les écritures
  // suivantes échoueraient en cascade sur une erreur déjà traitée.
  writeChain = next.catch(() => undefined);
  return next;
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, name), "utf8")) as T;
  } catch {
    // Fichier absent ou JSON illisible : on repart du défaut. L'absence de
    // données est un état normal au premier démarrage, pas une panne.
    return fallback;
  }
}

async function writeJson(name: string, value: unknown): Promise<void> {
  const path = join(DATA_DIR, name);
  const tmp = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await rename(tmp, path);
}

/* --- Projets ------------------------------------------------------------- */

/**
 * Les projets stockés, ou la liste d'amorçage au PREMIER démarrage seulement.
 *
 * ⚠️ Le sentinelle `null` n'est pas une coquetterie : il distingue « le fichier
 * n'existe pas encore » de « l'utilisateur a supprimé tous ses projets ». Avec
 * un tableau vide comme défaut, ces deux cas étaient confondus, et supprimer le
 * dernier projet depuis les Réglages faisait RÉAPPARAÎTRE la liste d'amorçage
 * au rechargement suivant.
 */
export async function readProjects(): Promise<Project[]> {
  const stored = await readJson<Project[] | null>("projects.json", null);
  if (stored === null) return SEED_PROJECTS;
  return stored.filter((p) => !p.archived);
}

export async function writeProjects(projects: Project[]): Promise<void> {
  return serialize(() => writeJson("projects.json", projects));
}

/* --- Board Kanban -------------------------------------------------------- */

const SEED_BOARD: KanbanBoard = {
  columns: [
    { id: "col-todo", name: "À faire", order: 0 },
    { id: "col-doing", name: "En cours", order: 1 },
    { id: "col-done", name: "Fait", order: 2 },
  ],
  updatedAt: new Date().toISOString(),
};

export async function readBoard(): Promise<KanbanBoard> {
  const stored = await readJson<KanbanBoard | null>("boards.json", null);
  if (stored === null) return SEED_BOARD;
  return stored;
}

export async function writeBoard(board: KanbanBoard): Promise<void> {
  return serialize(() => writeJson("boards.json", board));
}

/* --- Réglages ------------------------------------------------------------ */

/**
 * Les réglages stockés, ramenés à une forme utilisable.
 *
 * ⚠️ Le défaut n'est PAS un objet vide : c'est `DEFAULT_SETTINGS`, tout à ON.
 * Un `settings.json` absent est un état normal (premier démarrage, volume neuf,
 * restauration partielle) — le lire comme « tout éteint » couperait la synchro
 * calendrier et le récap du matin sans un seul message d'erreur. Voir l'en-tête
 * de `settings.ts`.
 */
export async function readSettings(): Promise<Settings> {
  return normalizeSettings(await readJson<unknown>("settings.json", null));
}

/**
 * Lecture-modification-écriture ATOMIQUE des réglages, même patron que
 * `updateObjectivesAtomically` : `fn` reçoit les réglages normalisés et rend
 * les nouveaux — ou la même référence pour ne rien écrire.
 */
export async function updateSettingsAtomically(
  fn: (settings: Settings) => Settings,
): Promise<Settings> {
  return serialize(async () => {
    const settings = normalizeSettings(await readJson<unknown>("settings.json", null));
    const next = fn(settings);
    if (next !== settings) await writeJson("settings.json", next);
    return next;
  });
}

/* --- Tags ---------------------------------------------------------------- */

export async function readTags(): Promise<Tag[]> {
  return readJson<Tag[]>("tags.json", []);
}

export async function writeTags(tags: Tag[]): Promise<void> {
  return serialize(() => writeJson("tags.json", tags));
}

/* --- Objectifs ------------------------------------------------------------- */

/**
 * Les objectifs stockés, ou une liste vide au premier démarrage. Un objectif
 * n'est pas un item : il survit à ses tâches, les orchestre — rien à semer.
 */
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

export async function readObjectives(): Promise<Objective[]> {
  const stored = await readJson<Objective[]>("objectives.json", []);
  // Normalisation en mémoire sans réécrire le fichier — même principe que
  // `normalizeItem` : une donnée absente ne doit pas obliger à migrer le disque.
  return stored.map(normalizeObjective);
}

export async function writeObjectives(objectives: Objective[]): Promise<void> {
  return serialize(() => writeJson("objectives.json", objectives));
}

/**
 * Lecture-modification-écriture ATOMIQUE des objectifs : `fn` reçoit les
 * objectifs (normalisés) et les items du moment, renvoie le nouveau tableau —
 * ou `null` pour ne rien écrire. Toute la séquence tient dans la file
 * sérialisée, donc deux mutations concurrentes ne s'écrasent pas (une route
 * qui écrivait puis re-réconciliait en deux temps laissait une fenêtre).
 */
export async function updateObjectivesAtomically(
  fn: (objectives: Objective[], items: Item[]) => Objective[] | null,
): Promise<Objective[]> {
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
}

/* --- Items --------------------------------------------------------------- */

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
    objectiveId: it.objectiveId ?? null,
  };
}

export async function readItems(): Promise<Item[]> {
  const items = await readJson<Item[]>("items.json", []);
  return items.map(normalizeItem);
}

/**
 * Ajoute ou remplace des items.
 *
 * L'`id` vient de l'appelant et est réutilisé tel quel : un second envoi du
 * même brouillon écrase au lieu de dupliquer. C'est ce qui rend le double-clic
 * et le rejeu d'une file d'attente hors-ligne inoffensifs, sans aucune logique
 * de déduplication à maintenir.
 */
export async function saveItems(items: Item[]): Promise<void> {
  return serialize(async () => {
    const existing = await readItems();
    const incoming = new Set(items.map((i) => i.id));
    await writeJson("items.json", [...existing.filter((i) => !incoming.has(i.id)), ...items]);
  });
}

export async function patchItem(id: string, patch: Partial<Item>): Promise<Item | null> {
  return serialize(async () => {
    const items = await readItems();
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) return null;
    const next = { ...items[index], ...patch, id };
    items[index] = next;
    await writeJson("items.json", items);
    return next;
  });
}

export async function deleteItem(id: string): Promise<boolean> {
  return serialize(async () => {
    const items = await readItems();
    const next = items.filter((i) => i.id !== id);
    if (next.length === items.length) return false;
    await writeJson("items.json", next);
    return true;
  });
}

/**
 * Applique une modification à plusieurs items en UNE seule écriture.
 *
 * Le planificateur en a besoin : marquer dix rappels comme envoyés par dix
 * appels séparés, c'est dix cycles lecture-écriture et autant d'occasions de
 * réenvoyer un rappel déjà parti si le processus s'arrête au milieu.
 */
export async function patchItems(
  patches: { id: string; patch: Partial<Item> }[],
): Promise<number> {
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
}
