/**
 * Graphe des dépendances — la logique pure derrière la vue « Graphe ».
 *
 * Rien ici ne connaît React ni le DOM : on calcule un statut, un ensemble
 * visible, des colonnes et des positions. C'est ce qui rend la vue testable
 * sans monter un canvas.
 *
 * ⚠️ **Trois statuts, pas quatre.** Le prototype Claude Design en décrivait
 * quatre (prête / bientôt / bloquée / terminée), le quatrième reposant sur un
 * état « en cours » par tâche. Le modèle Brief n'a que `doneAt` : une tâche est
 * à faire ou faite. Décision du 2026-08-24 (voir DECISIONS.md) — on reste à
 * deux statuts stockés, donc trois statuts dérivés, et l'orange « bientôt »
 * n'existe pas. Quand de vrais statuts arriveront, c'est `graphStatus` qui
 * changera, et elle seule.
 */

import type { Item } from "./types";

/** Statut d'une tâche dans le graphe, dérivé de `doneAt` et de ses prédécesseurs. */
export type GraphStatus = "ready" | "blocked" | "done";

/** Position d'un nœud dans le repère du monde (avant pan/zoom). */
export type Point = { x: number; y: number };

/** Gabarit d'un nœud et espacement entre nœuds, en pixels du monde. */
export type GraphMetrics = {
  /** Largeur d'un nœud. */
  W: number;
  /** Hauteur d'un nœud. */
  H: number;
  /** Espace horizontal entre deux colonnes. */
  GAP: number;
  /** Espace vertical entre deux nœuds d'une même colonne. */
  VGAP: number;
};

/** Une arête du graphe : `from` doit être terminée avant `to`. */
export type GraphEdge = { from: Item; to: Item };

export const COMPACT: GraphMetrics = { W: 214, H: 92, GAP: 92, VGAP: 26 };
export const CONFORTABLE: GraphMetrics = { W: 248, H: 104, GAP: 100, VGAP: 26 };

/** Marge du coin haut-gauche du monde — laisse respirer le premier nœud. */
const ORIGIN: Point = { x: 30, y: 26 };

/** Index par id, pour résoudre les `dependsOn` sans balayer la liste à chaque fois. */
export function indexById(items: Item[]): Map<string, Item> {
  return new Map(items.map((it) => [it.id, it]));
}

/**
 * Statut d'une tâche.
 *
 * Terminée si `doneAt`. Sinon bloquée dès qu'un prédécesseur **connu** n'est
 * pas terminé — un `dependsOn` qui pointe vers un id absent de `byId` (item
 * supprimé, ou simplement filtré hors de la vue) est ignoré plutôt que traité
 * comme bloquant : une dépendance qu'on ne sait pas lire ne doit pas bloquer
 * une tâche pour toujours.
 */
export function graphStatus(item: Item, byId: Map<string, Item>): GraphStatus {
  if (item.doneAt) return "done";
  const deps = (item.dependsOn ?? []).map((id) => byId.get(id)).filter((d): d is Item => !!d);
  return deps.some((d) => !d.doneAt) ? "blocked" : "ready";
}

/**
 * Les tâches candidates au graphe : des tâches ACTIVES, jamais des
 * rendez-vous ni des tâches terminées.
 *
 * Une tâche cochée (`doneAt`) n'a plus rien à faire dans le graphe — elle
 * n'attend plus rien et plus rien ne l'attend ; la montrer ferait s'y perdre
 * entre tâches actives et faites. Le graphe ne parle que de chaînes « fais
 * ceci avant cela » encore en cours.
 */
export function graphTasks(items: Item[]): Item[] {
  return items.filter((it) => it.kind === "task" && !it.doneAt);
}

/**
 * Ce que la vue affiche, une fois les filtres appliqués.
 *
 * `projectFilter` vide = tous les projets (un filtre qui ne filtre rien plutôt
 * qu'un écran vide). `blockedOnly` garde les tâches bloquées **et toute leur
 * ascendance** : montrer un blocage sans montrer ce qui bloque n'apprendrait
 * rien. L'ascendance est reprise dans la liste complète, pas dans la liste déjà
 * filtrée par projet — c'est souvent une tâche d'un autre projet qui bloque.
 */
export function visibleTasks(
  all: Item[],
  { projectFilter, blockedOnly }: { projectFilter: string[]; blockedOnly: boolean },
): Item[] {
  const tasks = graphTasks(all);
  const byId = indexById(tasks);
  const byProject = projectFilter.length === 0
    ? tasks
    : tasks.filter((t) => projectFilter.includes(t.projectId));

  if (!blockedOnly) return byProject;

  const keep = new Set<string>();
  const walk = (task: Item | undefined, seen: Set<string>) => {
    if (!task || seen.has(task.id)) return;
    seen.add(task.id);
    keep.add(task.id);
    (task.dependsOn ?? []).forEach((id) => walk(byId.get(id), seen));
  };
  byProject.forEach((t) => {
    if (graphStatus(t, byId) === "blocked") walk(t, new Set());
  });
  return tasks.filter((t) => keep.has(t.id));
}

/** Les arêtes dont les DEUX extrémités sont visibles — une flèche vers le vide n'a pas de sens. */
export function graphEdges(list: Item[]): GraphEdge[] {
  const byId = indexById(list);
  const edges: GraphEdge[] = [];
  list.forEach((to) => {
    (to.dependsOn ?? []).forEach((id) => {
      const from = byId.get(id);
      if (from) edges.push({ from, to });
    });
  });
  return edges;
}

/**
 * Profondeur de chaque tâche = longueur du plus long chemin de dépendances qui
 * y mène. C'est ce qui donne les colonnes : profondeur 0 à gauche (rien ne les
 * précède), puis un cran vers la droite à chaque maillon.
 *
 * ⚠️ **Tolérant aux cycles.** `dependsOn` n'est contraint nulle part : rien
 * n'empêche A → B → A. Un parcours naïf récurserait à l'infini et ferait
 * tomber tout l'écran. `guard` coupe la récursion sur un cycle en renvoyant 0
 * pour l'arête qui reboucle : le cycle s'affiche à plat plutôt que de faire
 * planter la vue.
 */
export function depths(list: Item[]): Map<string, number> {
  const inSet = indexById(list);
  const depth = new Map<string, number>();

  const calc = (task: Item, guard: Set<string>): number => {
    const memo = depth.get(task.id);
    if (memo !== undefined) return memo;
    if (guard.has(task.id)) return 0;
    guard.add(task.id);
    let d = 0;
    (task.dependsOn ?? []).forEach((id) => {
      const parent = inSet.get(id);
      if (parent) d = Math.max(d, calc(parent, guard) + 1);
    });
    guard.delete(task.id);
    depth.set(task.id, d);
    return d;
  };

  list.forEach((t) => calc(t, new Set()));
  return depth;
}

/**
 * Positionne les nœuds de gauche à droite : une colonne par profondeur.
 *
 * Dans une colonne, les tâches sont rangées par la hauteur moyenne de leurs
 * prédécesseurs (barycentre). C'est ce qui garde les arêtes lisibles : sans ce
 * tri, deux chaînes parallèles s'entrecroisent pour rien. Les tâches sans
 * prédécesseur visible tombent en bas de leur colonne.
 *
 * `pinned` écrase le calcul pour les nœuds que l'utilisateur a déplacés à la
 * main — sa disposition gagne toujours sur la nôtre.
 */
export function layoutGraph(
  list: Item[],
  metrics: GraphMetrics = COMPACT,
  pinned: Record<string, Point> = {},
): Map<string, Point> {
  const { W, H, GAP, VGAP } = metrics;
  const depth = depths(list);

  const columns: Item[][] = [];
  list.forEach((t) => {
    const d = depth.get(t.id) ?? 0;
    (columns[d] ??= []).push(t);
  });

  const pos = new Map<string, Point>();
  columns.forEach((column, d) => {
    if (d > 0) {
      const barycentre = (t: Item) => {
        const ys = (t.dependsOn ?? [])
          .map((id) => pos.get(id))
          .filter((p): p is Point => !!p)
          .map((p) => p.y);
        // Sans prédécesseur placé, on tombe en bas de la colonne.
        return ys.length ? ys.reduce((s, y) => s + y, 0) / ys.length : Number.POSITIVE_INFINITY;
      };
      column.sort((a, b) => barycentre(a) - barycentre(b));
    }
    column.forEach((t, i) => {
      pos.set(t.id, { x: ORIGIN.x + d * (W + GAP), y: ORIGIN.y + i * (H + VGAP) });
    });
  });

  Object.entries(pinned).forEach(([id, p]) => {
    if (pos.has(id)) pos.set(id, p);
  });
  return pos;
}

/** Rectangle englobant tous les nœuds — sert à cadrer la vue (« Ajuster »). */
export function boundingBox(
  list: Item[],
  pos: Map<string, Point>,
  metrics: GraphMetrics = COMPACT,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const points = list.map((t) => pos.get(t.id)).filter((p): p is Point => !!p);
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs) + metrics.W,
    maxY: Math.max(...ys) + metrics.H,
  };
}

/** Les tâches que celle-ci débloquera une fois terminée. */
export function unlocks(item: Item, all: Item[]): Item[] {
  return graphTasks(all).filter((t) => (t.dependsOn ?? []).includes(item.id));
}
