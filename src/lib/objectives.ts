/**
 * Logique pure des objectifs — progression, regroupement, sélection.
 *
 * Testée sans DOM ni disque : c'est la seule couche qui change quand la
 * définition d'une « progression d'objectif » évolue.
 */

import type { Item, Objective, ObjectiveHorizon, Project } from "./types";

export const HORIZONS: ObjectiveHorizon[] = ["court", "moyen", "long"];

export const HORIZON_LABEL: Record<ObjectiveHorizon, string> = {
  court: "Court terme",
  moyen: "Moyen terme",
  long: "Long terme",
};

/** Ordre d'affichage des horizons — du plus proche au plus lointain. */
const HORIZON_ORDER: Record<ObjectiveHorizon, number> = { court: 0, moyen: 1, long: 2 };

/**
 * Progression d'un objectif : tâches liées terminées / total.
 *
 * Une tâche liée = `Item.objectiveId` pointe vers cet objectif. Les tâches
 * « idea » ou « archived » ne comptent pas — elles ne font pas partie du
 * plan de travail. Le dénominateur inclut les tâches faites ET à faire.
 */
export function objectiveProgress(
  objective: Objective,
  items: Item[],
): { done: number; total: number; pct: number } {
  const linked = items.filter(
    (it) => it.objectiveId === objective.id && it.kind === "task" && it.status !== "idea" && it.status !== "archived",
  );
  const done = linked.filter((it) => !!it.doneAt).length;
  const total = linked.length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/**
 * Tâches actives (non terminées) rattachées à un objectif — celles qui restent
 * à faire pour l'atteindre. Triées par échéance, les sans-échéance en dernier.
 */
export function openTasksFor(objective: Objective, items: Item[]): Item[] {
  return items.filter(
    (it) =>
      it.objectiveId === objective.id &&
      it.kind === "task" &&
      !it.doneAt &&
      it.status !== "idea" &&
      it.status !== "archived",
  );
}

/**
 * Objectifs visibles (non atteints) regroupés par projet puis par horizon,
 * dans l'ordre de lecture d'Aramis : projet, puis court → moyen → long.
 */
export function objectivesByProject(
  objectives: Objective[],
  projects: Project[],
  items: Item[],
): { project: Project; rows: { objective: Objective; progress: { done: number; total: number; pct: number } }[] }[] {
  const active = objectives.filter((o) => !o.achievedAt);
  const byProject = new Map<string, Objective[]>();
  for (const o of active) {
    const list = byProject.get(o.projectId) ?? [];
    list.push(o);
    byProject.set(o.projectId, list);
  }
  return projects
    .filter((p) => byProject.has(p.id))
    .map((p) => ({
      project: p,
      rows: byProject
        .get(p.id)!
        .sort((a, b) => HORIZON_ORDER[a.horizon] - HORIZON_ORDER[b.horizon])
        .map((objective) => ({ objective, progress: objectiveProgress(objective, items) })),
    }));
}

/**
 * Identifiant lisible pour un nouvel objectif : slug du titre, suffixé si
 * déjà pris. Même philosophie que `uniqueProjectId` — l'id reste humainement
 * lisible dans le graphe et les logs.
 */
export function uniqueObjectiveId(title: string, taken: Set<string>): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || `objectif-${Date.now().toString(36)}`;
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Le nœud « objectif » du graphe : l'id technique qui le différencie d'une
 * tâche. « obj:<id> » — impossible à confondre avec un Item.id existant,
 * stable pour les clés React.
 */
export function objectiveNodeId(objective: Objective): string {
  return `obj:${objective.id}`;
}

/**
 * Arêtes objectif : une tâche liée « mène à » son objectif. Ce sont les
 * mêmes arêtes que la vue des dépendances, mais dans l'autre sens —
 * de la tâche vers l'objectif, jamais stockées dans `dependsOn` (l'objectif
 * n'est pas un item).
 */
export function objectiveEdges(
  objectives: Objective[],
  items: Item[],
): { fromId: string; toId: string }[] {
  const activeIds = new Set(objectives.filter((o) => !o.achievedAt).map((o) => o.id));
  const edges: { fromId: string; toId: string }[] = [];
  for (const it of items) {
    if (!it.objectiveId || !activeIds.has(it.objectiveId)) continue;
    if (it.doneAt || it.kind !== "task") continue;
    edges.push({ fromId: it.id, toId: objectiveNodeId({ id: it.objectiveId } as Objective) });
  }
  return edges;
}
