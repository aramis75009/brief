import type { Item } from "./types";

/**
 * Le type qu'un utilisateur choisit — Tâche / Rendez-vous / Idée — n'existe pas
 * comme un champ unique du modèle : c'est la combinaison de `kind`
 * (`"task"|"event"`, la NATURE de l'item) et `status` (`"idea"` prime sur tout,
 * une idée n'est jamais une tâche ni un rendez-vous). Avant ce fichier, chaque
 * écran recalculait `status === "idea" ? … : kind === "task" ? … : …` à sa
 * façon (`CaptureSheet`, `SearchScreen`, `IdeasScreen`, `TaskDetailScreen`) —
 * un seul endroit évite que deux écrans divergent sur ce qu'« être une idée »
 * veut dire.
 */
export type ItemType = "task" | "event" | "idea";

export function itemType(item: Pick<Item, "kind" | "status">): ItemType {
  if (item.status === "idea") return "idea";
  return item.kind;
}

export function typeLabel(t: ItemType): string {
  switch (t) {
    case "task":
      return "Tâche";
    case "event":
      return "Rendez-vous";
    case "idea":
      return "Idée";
  }
}

/** Couleurs du design system (`globals.css`) associées à un type. */
export function typeColors(t: ItemType): { bg: string; fg: string } {
  switch (t) {
    case "task":
      return { bg: "var(--color-task-100)", fg: "var(--color-task-700)" };
    case "event":
      return { bg: "var(--color-meet-100)", fg: "var(--color-meet-700)" };
    case "idea":
      return { bg: "var(--color-idea-100)", fg: "var(--color-idea-700)" };
  }
}
