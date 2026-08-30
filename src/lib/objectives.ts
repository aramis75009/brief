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

/**
 * Dépendances effectives d'un objectif, résolues :
 *   - les items qui pointent dessus par `objectiveId` (lien implicite)
 *   - les entrées de `objective.dependsOn` : ids d'items, et ids d'objectifs
 *     préfixés `obj:`
 *
 * Dédupliqué, ordre stable (liens implicites d'abord, puis explicites). Une
 * entrée qui ne résout rien (item/objectif inexistant, auto-référence) est
 * ignorée — une dépendance qu'on ne sait pas lire ne doit rien bloquer.
 */
export function effectiveDeps(
  objective: Objective,
  items: Item[],
  objectives: Objective[],
): { itemIds: string[]; objectiveIds: string[] } {
  const itemById = new Map(items.map((it) => [it.id, it]));
  const objById = new Map(objectives.map((o) => [o.id, o]));

  const itemIds: string[] = [];
  const objectiveIds: string[] = [];
  const seenItems = new Set<string>();
  const seenObjs = new Set<string>();

  for (const it of items) {
    if (it.objectiveId === objective.id && !seenItems.has(it.id)) {
      seenItems.add(it.id);
      itemIds.push(it.id);
    }
  }
  for (const raw of objective.dependsOn ?? []) {
    if (raw.startsWith("obj:")) {
      const id = raw.slice(4);
      if (id !== objective.id && objById.has(id) && !seenObjs.has(id)) {
        seenObjs.add(id);
        objectiveIds.push(id);
      }
    } else if (itemById.has(raw) && !seenItems.has(raw)) {
      seenItems.add(raw);
      itemIds.push(raw);
    }
  }
  return { itemIds, objectiveIds };
}

/**
 * Un objectif est « satisfait » quand il a au moins une dépendance effective
 * ET que toutes sont accomplies : les tâches-dépendances ont `doneAt`, les
 * objectifs-dépendances ont `achievedAt`.
 *
 * Une tâche récurrente (`rrule`) ne compte jamais comme accomplie : elle
 * avance, elle ne se termine pas (voir `completion.ts`). Un objectif ne peut
 * donc pas se clore sur une habitude — il faut une tâche ponctuelle.
 */
export function objectiveSatisfied(
  objective: Objective,
  items: Item[],
  objectives: Objective[],
): boolean {
  const { itemIds, objectiveIds } = effectiveDeps(objective, items, objectives);
  if (itemIds.length === 0 && objectiveIds.length === 0) return false;

  const itemById = new Map(items.map((it) => [it.id, it]));
  const objById = new Map(objectives.map((o) => [o.id, o]));

  for (const id of itemIds) {
    const it = itemById.get(id);
    if (!it || it.rrule || !it.doneAt) return false;
  }
  for (const id of objectiveIds) {
    const o = objById.get(id);
    if (!o || !o.achievedAt) return false;
  }
  return true;
}

/**
 * Recalcule `achievedAt` des objectifs « auto » d'après l'état courant :
 *   - actif + satisfait + pas `achievedManually`        → `achievedAt = nowIso`
 *   - `achievedAt` posé + pas `achievedManually` + plus satisfait → `achievedAt = null`
 *   - `achievedManually`                                → intact
 *
 * Renvoie un NOUVEAU tableau ; les objets non modifiés sont gardés par
 * identité (les consommateurs peuvent comparer par référence). Itère jusqu'à
 * point fixe : atteindre un objectif amont peut clore l'objectif aval dans la
 * même passe.
 */
export function reconcileObjectives(
  items: Item[],
  objectives: Objective[],
  nowIso: string,
): Objective[] {
  let current = objectives;
  for (let pass = 0; pass <= objectives.length; pass++) {
    let changed = false;
    const next = current.map((o) => {
      if (o.achievedManually) return o;
      const sat = objectiveSatisfied(o, items, current);
      if (sat && !o.achievedAt) {
        changed = true;
        return { ...o, achievedAt: nowIso };
      }
      if (!sat && o.achievedAt) {
        changed = true;
        return { ...o, achievedAt: null };
      }
      return o;
    });
    current = next;
    if (!changed) break;
  }
  return current;
}
