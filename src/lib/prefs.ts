/**
 * Préférences utilisateur — versionnées dans `users/<id>/prefs.json`.
 *
 * Scope actuel (07/09) : la barre d'outils de l'écran « Mes tâches ».
 * On n'invente pas un centre de réglages pour une option ; une option va
 * dans ce store dès qu'elle a besoin de voyager entre les appareils d'un
 * même compte (pas la peine de persister pour un truc purement local).
 *
 * L'écriture est `PATCH` (morceau par morceau) : on ne demande pas le
 * fichier complet à chaque saisie de toggle, on n'envoie que la clé qui
 * change. Le merge est shallow.
 */

export type TasksSort = "urgency" | "due" | "priority" | "project";
export type TasksGroupBy = "time" | "project";

export interface TasksToolbarPrefs {
  /** Tâches terminées (`doneAt` posé) masquées du rendu. Défaut : `true`. */
  doneHidden: boolean;
  /** Mode de tri pour la vue Liste. Défaut : `"urgency"`. */
  sort: TasksSort;
  /** Regroupement dans la vue Liste. Défaut : `"time"` (par date). */
  groupBy: TasksGroupBy;
}

export interface UserPrefs {
  tasksToolbar: TasksToolbarPrefs;
}

/** Préférences par défaut — premier rendu, et fichier absent / corrompu. */
export const DEFAULT_PREFS: UserPrefs = {
  tasksToolbar: {
    doneHidden: true,
    sort: "urgency",
    groupBy: "time",
  },
};

/**
 * Merge shallow d'un patch de prefs — seul `tasksToolbar` est supporté
 * pour l'instant, donc le merge est en pratique superficiel.
 *
 * On valide la forme (clés inconnues ignorées, types respectés) pour
 * qu'un client bogué ne casse pas un fichier de préférences.
 */
export function mergePrefs(base: UserPrefs, patch: unknown): UserPrefs {
  if (!patch || typeof patch !== "object") return base;
  const p = patch as Record<string, unknown>;
  const tt = (p.tasksToolbar && typeof p.tasksToolbar === "object"
    ? (p.tasksToolbar as Record<string, unknown>)
    : {});
  const baseTT = base.tasksToolbar;
  return {
    tasksToolbar: {
      doneHidden:
        typeof tt.doneHidden === "boolean" ? tt.doneHidden : baseTT.doneHidden,
      sort:
        tt.sort === "urgency" || tt.sort === "due" || tt.sort === "priority" || tt.sort === "project"
          ? tt.sort
          : baseTT.sort,
      groupBy:
        tt.groupBy === "time" || tt.groupBy === "project" ? tt.groupBy : baseTT.groupBy,
    },
  };
}