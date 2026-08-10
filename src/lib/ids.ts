"use client";

/**
 * Identifiant d'un brouillon créé à la main dans la revue.
 *
 * ⚠️ Ce que remplace cette fonction : un compteur `let seq = 100` qui repartait
 * de 100 à CHAQUE rechargement de page. Or `/api/items` est idempotent par `id`
 * — un envoi qui réutilise un id écrase l'item existant au lieu d'en créer un.
 * Deux sessions successives produisaient donc le même `t101`, et la seconde
 * effaçait silencieusement la tâche de la première. Un identifiant doit être
 * unique dans le temps, pas seulement dans la session.
 */
export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Repli pour les contextes non sécurisés, où `randomUUID` n'existe pas.
  // L'horodatage porte l'unicité dans le temps, l'aléa celle dans la seconde.
  return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
