/**
 * Calculs de vue pour la version desktop de Brief.
 *
 * Purs, testés, et alignés sur les mêmes définitions que `/api/overview`
 * (`src/lib/buckets.ts`) — jamais une seconde notion d'« en retard » ou
 * « cette semaine » qui pourrait diverger de la Vision déjà servie par le
 * serveur. Aucune méthode locale de `Date` : tout passe par `src/lib/zoned.ts`.
 */

import { makeBucketOf } from "./buckets";
import { shiftDays, zonedParts, zonedTime, type CalendarDate } from "./zoned";
import type { Item, Priority, Project } from "./types";

function isActive(it: Item): boolean {
  return it.status !== "idea" && it.status !== "archived";
}

/** Lundi de la semaine calendaire contenant `now`, dans Europe/Paris. */
export function mondayOf(now: Date): CalendarDate {
  const parts = zonedParts(now);
  const offset = (parts.weekday + 6) % 7; // lundi=0 … dimanche=6
  return shiftDays(parts, -offset);
}

/** Items actifs, non faits, dont l'échéance est avant aujourd'hui minuit Paris — triés du plus ancien au plus récent. */
export function overdueItems(items: Item[], now: Date): Item[] {
  const bucketOf = makeBucketOf(now);
  return items
    .filter((it) => isActive(it) && !it.doneAt && bucketOf(it.due) === "overdue")
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
}

/**
 * Faites/total par projet sur la semaine calendaire en cours (lundi→dimanche,
 * Europe/Paris) — les projets les plus chargés d'abord, `limit` au maximum.
 * Un projet sans item cette semaine n'apparaît pas.
 */
export function weekProgressByProject(
  items: Item[],
  projects: Project[],
  now: Date,
  limit = 3,
): { project: Project; done: number; total: number }[] {
  const monday = mondayOf(now);
  const nextMonday = shiftDays(monday, 7);
  const start = zonedTime(monday.y, monday.m, monday.d, 0, 0);
  const end = zonedTime(nextMonday.y, nextMonday.m, nextMonday.d, 0, 0);
  const weekItems = items.filter((it) => {
    if (!it.due) return false;
    // Inclure les items actifs ET les récurrentes cochées (doneAt=null mais
    // lastCompletedOccurrenceAt posé par le cron). Les récurrentes n'ont
    // jamais doneAt — le cron avance due à la prochaine occurrence.
    const isActiveItem = !it.doneAt && it.status !== "idea" && it.status !== "archived";
    const isCompletedRecurring = !it.doneAt && !!it.lastCompletedOccurrenceAt;
    if (!isActiveItem && !isCompletedRecurring) return false;
    const d = new Date(it.due);
    return !Number.isNaN(d.getTime()) && d >= start && d < end;
  });
  return projects
    .map((project) => {
      const mine = weekItems.filter((it) => it.projectId === project.id);
      const done = mine.filter((it) => {
        if (it.doneAt) return true;
        // Récurrente cochée : lastCompletedOccurrenceAt dans la semaine ?
        if (it.lastCompletedOccurrenceAt) {
          const cd = new Date(it.lastCompletedOccurrenceAt);
          return !Number.isNaN(cd.getTime()) && cd >= start && cd < end;
        }
        return false;
      }).length;
      return { project, done, total: mine.length };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/**
 * Id de l'item le moins urgent (priorité numériquement la plus haute — 4 avant
 * 1, RFC 5545) parmi une liste — sert à choisir quoi repousser pour « Alléger
 * mon mur ». À égalité de priorité, l'échéance la plus tardive gagne : c'est
 * celle qui peut le plus se permettre d'attendre un jour de plus.
 */
export function leastUrgentId(
  items: { id: string; priority: Priority; due: string | null }[],
): string | null {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (b.due ?? "").localeCompare(a.due ?? "");
  });
  return sorted[0].id;
}

export type TaskFilterKey = "all" | "today" | "overdue" | "done";

export const TASK_FILTERS: { key: TaskFilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "today", label: "Aujourd’hui" },
  { key: "overdue", label: "En retard" },
  { key: "done", label: "Faites" },
];

/** Tâches (jamais les RDV) filtrées pour l'écran Tâches du desktop. */
export function filterTasks(items: Item[], filter: TaskFilterKey, now: Date): Item[] {
  const bucketOf = makeBucketOf(now);
  const tasks = items.filter((it) => it.kind === "task" && isActive(it));
  switch (filter) {
    case "today":
      return tasks.filter((it) => !it.doneAt && bucketOf(it.due) === "today");
    case "overdue":
      return tasks.filter((it) => !it.doneAt && bucketOf(it.due) === "overdue");
    case "done":
      return tasks.filter((it) => !!it.doneAt);
    default:
      return tasks.filter((it) => !it.doneAt);
  }
}

/** Regroupe une liste d'items par projet, dans l'ordre des `projects`. Un projet sans ligne n'apparaît pas. */
export function groupByProject(
  items: Item[],
  projects: Project[],
): { project: Project; rows: Item[] }[] {
  return projects
    .map((project) => ({ project, rows: items.filter((it) => it.projectId === project.id) }))
    .filter((group) => group.rows.length > 0);
}

/** Répartition des tâches ouvertes par priorité — pour la carte « Par priorité ». */
export function priorityBreakdown(
  items: Item[],
): { priority: Priority; count: number; pct: number }[] {
  const open = items.filter((it) => it.kind === "task" && isActive(it) && !it.doneAt);
  const total = open.length || 1;
  return ([1, 2, 3, 4] as const).map((priority) => {
    const count = open.filter((it) => it.priority === priority).length;
    return { priority, count, pct: Math.round((count / total) * 100) };
  });
}
