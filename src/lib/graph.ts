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
 * Composantes connexes du graphe, liens pris dans les DEUX sens.
 *
 * Deux tâches sont dans la même composante dès qu'un chemin de dépendances les
 * relie, peu importe la direction : c'est ce qui définit une « chaîne » qu'on
 * veut voir d'un bloc. Ordre déterministe — les plus grosses composantes
 * d'abord, puis par identifiant — pour qu'un même graphe se dessine toujours
 * pareil d'un rendu à l'autre.
 */
export function connectedComponents(list: Item[]): Item[][] {
  const byId = indexById(list);
  const neighbours = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    (neighbours.get(a) ?? neighbours.set(a, new Set()).get(a)!).add(b);
  };
  list.forEach((t) => {
    if (!neighbours.has(t.id)) neighbours.set(t.id, new Set());
    (t.dependsOn ?? []).forEach((id) => {
      if (!byId.has(id)) return;
      link(t.id, id);
      link(id, t.id);
    });
  });

  const seen = new Set<string>();
  const components: Item[][] = [];
  list.forEach((start) => {
    if (seen.has(start.id)) return;
    const stack = [start.id];
    const members: Item[] = [];
    seen.add(start.id);
    while (stack.length) {
      const id = stack.pop()!;
      const item = byId.get(id);
      if (item) members.push(item);
      (neighbours.get(id) ?? new Set()).forEach((n) => {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      });
    }
    components.push(members);
  });

  return components.sort((a, b) => {
    if (a.length !== b.length) return b.length - a.length;
    return a[0].id.localeCompare(b[0].id);
  });
}

/**
 * Ajouter « `dependentId` dépend de `dependencyId` » refermerait-il une boucle ?
 *
 * `dependsOn` n'est contraint nulle part et `depths()` ne fait que survivre aux
 * cycles : elle les aplatit. Le geste de tirage de lien, lui, peut les EMPÊCHER,
 * et c'est le seul endroit où on le sait avant qu'ils existent. Une boucle
 * A → B → A rendrait les deux tâches bloquées pour toujours, chacune attendant
 * l'autre — un blocage que rien dans l'interface ne pourrait expliquer.
 *
 * Vrai aussi pour un lien d'une tâche vers elle-même.
 */
export function wouldCreateCycle(dependentId: string, dependencyId: string, list: Item[]): boolean {
  if (dependentId === dependencyId) return true;
  const byId = indexById(list);
  // Le nouveau lien va dependency → dependent. Il boucle si dependent mène
  // déjà à dependency, c'est-à-dire si dependent est un ancêtre de dependency.
  const seen = new Set<string>();
  const stack = [dependencyId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === dependentId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const item = byId.get(id);
    (item?.dependsOn ?? []).forEach((parent) => {
      if (byId.has(parent)) stack.push(parent);
    });
  }
  return false;
}

/** Écart vertical entre deux chaînes, et entre les chaînes et la grille d'isolées. */
const bandGap = (m: GraphMetrics) => m.H + m.VGAP * 2;

/**
 * Combien de colonnes pour la grille des tâches isolées.
 *
 * Un peu plus large que haut : un écran est large, et une grille 8×5 se balaie
 * mieux qu'une 6×6. Jamais moins de 3 colonnes, sinon on retombe sur la
 * colonne interminable qu'on cherche à éviter.
 */
function orphanColumns(count: number): number {
  return Math.max(3, Math.ceil(Math.sqrt(count * 1.6)));
}

/**
 * Positionne les nœuds : une bande par chaîne, puis une grille pour les isolées.
 *
 * **Pourquoi ce n'est plus « une colonne par profondeur » (refonte 2026-08-25).**
 * La version précédente posait chaque nœud à la colonne de sa profondeur. Une
 * tâche sans dépendance a une profondeur de 0, donc TOUTES les tâches isolées
 * atterrissaient dans la colonne 0, empilées. Sur un jeu réel de 42 tâches dont
 * une poignée seulement sont liées, ça donnait une colonne de plusieurs milliers
 * de pixels de haut et des chaînes noyées dedans : le reproche « 42 tâches
 * empilées verticalement, aucune connexion visible ».
 *
 * Désormais chaque composante connexe est disposée pour elle-même — colonnes par
 * profondeur LOCALE, tri par barycentre dans la colonne — et les composantes
 * sont empilées en bandes. Les tâches vraiment isolées (aucun lien, ni entrant
 * ni sortant) ne méritent pas une bande chacune : elles vont dans une grille
 * compacte sous les chaînes. Les chaînes, qui sont le sujet de la vue, passent
 * devant ; les isolées restent du contexte.
 *
 * Dans une colonne, les tâches sont rangées par la hauteur moyenne de leurs
 * prédécesseurs (barycentre) : sans ce tri, deux chaînes parallèles
 * s'entrecroisent pour rien.
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
  const pos = new Map<string, Point>();

  const components = connectedComponents(list);
  const chains = components.filter((c) => c.length > 1);
  const orphans = components.filter((c) => c.length === 1).map((c) => c[0]);

  let cursorY = ORIGIN.y;

  // --- Les chaînes, une bande chacune -------------------------------------
  chains.forEach((component) => {
    const depth = depths(component);
    const columns: Item[][] = [];
    component.forEach((t) => {
      const d = depth.get(t.id) ?? 0;
      (columns[d] ??= []).push(t);
    });

    let rows = 0;
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
        column.sort((a, b) => barycentre(a) - barycentre(b) || a.id.localeCompare(b.id));
      }
      column.forEach((t, i) => {
        pos.set(t.id, { x: ORIGIN.x + d * (W + GAP), y: cursorY + i * (H + VGAP) });
      });
      rows = Math.max(rows, column.length);
    });

    cursorY += rows * (H + VGAP) + bandGap(metrics);
  });

  // --- Les isolées, en grille ---------------------------------------------
  if (orphans.length > 0) {
    const cols = orphanColumns(orphans.length);
    orphans.forEach((t, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      pos.set(t.id, {
        x: ORIGIN.x + col * (W + GAP),
        y: cursorY + row * (H + VGAP),
      });
    });
  }

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
