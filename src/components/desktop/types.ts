/**
 * La navigation desktop, en DEUX axes depuis la refonte v2.
 *
 * Avant, un seul axe : sept destinations à plat, dont « Calendrier » et
 * « Kanban » qui n'étaient que deux façons de regarder les mêmes tâches. Les
 * séparer permet de dire « les tâches du projet X, vues en calendrier » sans
 * multiplier les destinations — c'est le modèle du prototype, et celui d'Asana.
 */

/** OÙ on est. */
export type NavKey =
  | "accueil"
  | "inbox"
  | "mytasks"
  | "project"
  | "portfolios"
  | "graphe"
  | "réglages";

/** COMMENT on le regarde. N'a de sens que pour `mytasks` et `project`. */
export type ViewKey = "list" | "board" | "timeline" | "calendar" | "dashboard" | "files";

/**
 * Les vues disponibles selon l'endroit.
 *
 * La Chronologie n'existe QUE dans un projet : hors projet, elle empilerait
 * des barres de huit projets sans rapport sur une même grille — un planning
 * illisible qui ne dit rien de vrai.
 */
export const VIEWS_FOR: Record<"mytasks" | "project", { key: ViewKey; label: string }[]> = {
  mytasks: [
    { key: "list", label: "Liste" },
    { key: "board", label: "Tableau" },
    { key: "calendar", label: "Calendrier" },
    { key: "dashboard", label: "Tableau de bord" },
    { key: "files", label: "Fichiers" },
  ],
  project: [
    { key: "list", label: "Liste" },
    { key: "board", label: "Tableau" },
    { key: "timeline", label: "Chronologie" },
    { key: "calendar", label: "Calendrier" },
    { key: "dashboard", label: "Tableau de bord" },
    { key: "files", label: "Fichiers" },
  ],
};

/** Les deux endroits qui portent des onglets de vue. */
export function hasViews(nav: NavKey): nav is "mytasks" | "project" {
  return nav === "mytasks" || nav === "project";
}
