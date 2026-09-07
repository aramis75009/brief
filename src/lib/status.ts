/**
 * Statut d'une tâche — **dérivé, jamais stocké**.
 *
 * Le prototype Claude Design montre « Dans les délais / À risque / En retard »
 * comme une colonne de données, à la façon d'Asana. Stocké, ce champ pourrit :
 * il faudrait le remettre à jour à la main sur chaque tâche, et une tâche
 * marquée « Dans les délais » dont l'échéance est passée hier s'afficherait en
 * vert. Calculé, il est juste en permanence et ne coûte aucune maintenance.
 *
 * ⚠️ Aucune méthode locale de `Date` ici (invariant `AGENTS.md`) : uniquement
 * des comparaisons d'instants, qui ne dépendent d'aucun fuseau. La production
 * tourne en UTC, le calcul doit rendre la même chose que sur le Mac d'Aramis.
 */

import { applyOverride } from "./overrides";
import { nextOccurrence } from "./rrule";
import type { Item, Project } from "./types";

/**
 * Les quatre états. `done` en fait partie : sans lui, chaque appelant devrait
 * tester `doneAt` avant d'appeler, et l'un d'eux finirait par l'oublier —
 * affichant « En retard » en rouge sur une tâche cochée.
 */
export type TaskStatus = "done" | "late" | "atrisk" | "ontrack";

const HOUR = 3_600_000;
/** Fenêtre « À risque » quand la tâche est bloquée par une dépendance. */
const BLOCKED_WINDOW_MS = 48 * HOUR;
/** Fenêtre « À risque » quand il reste des sous-tâches. */
const SUBTASK_WINDOW_MS = 24 * HOUR;

/**
 * L'échéance RÉELLE d'un item, override d'occurrence appliqué.
 *
 * Pour une série récurrente, `due` pointe la prochaine occurrence — mais si
 * Aramis l'a déplacée dans l'app Calendrier, c'est l'override qui fait foi
 * (décision du 2026-08-18 : le calendrier gagne). Comparer `due` brut à
 * maintenant afficherait « En retard » sur une séance repoussée à demain.
 *
 * Renvoie `null` quand l'item n'a pas d'échéance, quand elle est illisible, ou
 * quand l'occurrence a été supprimée (EXDATE).
 */
export function effectiveDue(item: Item): Date | null {
  if (!item.due) return null;
  const due = new Date(item.due);
  if (Number.isNaN(due.getTime())) return null;
  if (!item.rrule) return due;
  return applyOverride(due, item.overrides, item.exdates);
}

/**
 * Borne basse de la plage, override compris. `null` = l'item n'a qu'une
 * échéance — la très grande majorité, et il ne faut surtout pas en inventer
 * une (une plage fausse ne se voit pas, une plage absente si).
 */
export function effectiveStart(item: Item): Date | null {
  if (!item.startDate) return null;
  const start = new Date(item.startDate);
  return Number.isNaN(start.getTime()) ? null : start;
}

/**
 * Le statut d'un item à l'instant `now`.
 *
 * `byId` sert à lire l'état des dépendances ; l'omettre revient à considérer
 * la tâche non bloquée, ce qui est le bon repli — on n'invente pas un risque
 * faute d'information.
 */
export function statusOf(
  item: Item,
  now: Date,
  byId?: Map<string, Item>,
): TaskStatus {
  if (item.doneAt) return "done";

  const due = effectiveDue(item);
  if (!due) return "ontrack";

  const delta = due.getTime() - now.getTime();
  if (delta < 0) return "late";

  const blocked =
    !!byId &&
    (item.dependsOn ?? []).some((id) => {
      const dep = byId.get(id);
      return !!dep && !dep.doneAt;
    });
  if (blocked && delta <= BLOCKED_WINDOW_MS) return "atrisk";

  const subtasksLeft = (item.subtasks ?? []).some((s) => !s.done);
  if (subtasksLeft && delta <= SUBTASK_WINDOW_MS) return "atrisk";

  return "ontrack";
}

/** Le libellé français d'un statut, tel qu'il s'affiche dans les pastilles. */
export const STATUS_LABEL: Record<TaskStatus, string> = {
  done: "Terminé",
  late: "En retard",
  atrisk: "À risque",
  ontrack: "Dans les délais",
};

/* ---------------------------------------------------------------------------
 * Priorité — l'échelle de Brief, pas celle du prototype.
 *
 * `Priority = 1|2|3|4` avec **1 = la plus haute** (RFC 5545). Le prototype n'a
 * que trois libellés ; en écraser quatre sur trois créerait une seconde échelle
 * et le bug d'inversion que `types.ts` interdit explicitement. On affiche donc
 * quatre libellés.
 * ------------------------------------------------------------------------ */

export const PRIORITY_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "Urgente",
  2: "Élevée",
  3: "Moyenne",
  4: "Faible",
};

/* ---------------------------------------------------------------------------
 * Santé d'un portefeuille — le pire statut de ses projets.
 *
 * Un portefeuille n'a pas d'état propre : il n'agrège que des projets, qui
 * n'agrègent que des tâches. Prendre le PIRE (et non la moyenne) est
 * délibéré : un portefeuille dont une seule tâche est en retard n'est pas
 * « globalement dans les délais », il a quelque chose qui traîne.
 * ------------------------------------------------------------------------ */

export type PortfolioHealth = "late" | "atrisk" | "ontrack";

export function healthOf(
  items: Item[],
  now: Date,
  byId?: Map<string, Item>,
): PortfolioHealth {
  let atrisk = false;
  for (const it of items) {
    const st = statusOf(it, now, byId);
    if (st === "late") return "late";
    if (st === "atrisk") atrisk = true;
  }
  return atrisk ? "atrisk" : "ontrack";
}

export const HEALTH_LABEL: Record<PortfolioHealth, string> = {
  late: "En retard",
  atrisk: "À risque",
  ontrack: "Dans les délais",
};

/**
 * Progression d'un ensemble de tâches, en pourcentage entier.
 *
 * Les rendez-vous et les tâches archivées ou en idée sont exclus par
 * l'appelant, pas ici : ce calcul ne connaît que « fait / pas fait ».
 * Un ensemble vide vaut 0 %, jamais 100 % — « rien à faire » et « tout est
 * fait » ne sont pas la même nouvelle.
 */
export function progressPct(items: Item[]): number {
  if (items.length === 0) return 0;
  const done = items.filter((it) => it.doneAt).length;
  return Math.round((done / items.length) * 100);
}

/**
 * La prochaine occurrence d'une série, ou l'échéance simple — utilisée par les
 * vues temporelles pour placer une tâche récurrente sur la grille sans
 * ré-implémenter `rrule.ts`.
 */
export function upcomingDue(item: Item, now: Date): Date | null {
  const due = effectiveDue(item);
  if (!due) return null;
  if (!item.rrule || due.getTime() >= now.getTime()) return due;
  const anchor = item.seriesAnchor ? new Date(item.seriesAnchor) : due;
  if (Number.isNaN(anchor.getTime())) return due;
  return nextOccurrence(anchor, item.rrule, now) ?? due;
}

/** Les projets d'un portefeuille, dans l'ordre où le portefeuille les liste. */
export function portfolioProjects(
  projectIds: string[],
  projects: Project[],
): Project[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  return projectIds
    .map((id) => byId.get(id))
    .filter((p): p is Project => !!p && !p.archived);
}
