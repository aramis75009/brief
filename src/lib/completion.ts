import { nextOccurrence } from "./rrule";
import type { Item } from "./types";

/**
 * Ce que produit la coche « fait » sur un item.
 *
 * Pourquoi une fonction pure plutôt que la logique dans la route : cocher une
 * tâche récurrente ne la termine pas, ça la fait AVANCER. Se tromper là-dessus
 * éteint une répétition sans que rien ne le signale — l'item ne revient jamais
 * et personne ne s'en aperçoit avant d'avoir oublié de sortir les poubelles
 * trois semaines de suite. C'est testable ici, ça ne l'était pas dans un
 * gestionnaire HTTP.
 *
 * Le comportement est aligné sur le planificateur de rappels (`reminders.ts`),
 * qui avance déjà les récurrences après un envoi et retire la règle quand la
 * série est épuisée. Deux chemins mènent au même endroit : ils doivent traiter
 * la récurrence de la même façon.
 */
export type CompletionOutcome = {
  /**
   * `advanced` : récurrence repoussée, l'item reste ouvert.
   * `done` : terminé, `doneAt` posé.
   * `reopened` : décoché.
   */
  kind: "advanced" | "done" | "reopened";
  patch: Partial<Item>;
};

export function completionPatch(item: Item, done: boolean, now: Date): CompletionOutcome {
  if (!done) {
    // On ne rembobine pas l'échéance d'une récurrence avancée : rien
    // n'enregistre d'où elle venait, et deviner produirait une fausse date.
    return { kind: "reopened", patch: { doneAt: null } };
  }

  const due = item.due ? new Date(item.due) : null;
  const usable = due && !Number.isNaN(due.getTime());

  if (item.rrule && usable) {
    const next = nextOccurrence(due, item.rrule, now);
    if (next) {
      // `remindedAt` est laissé tel quel : `pendingReminders` compare
      // `remindedAt >= due`, et la nouvelle échéance lui est postérieure. Le
      // prochain rappel sonnera donc, et on garde la trace du dernier envoi.
      //
      // `lastCompletedOccurrenceAt` = l'ancien `due`, l'instant que cette
      // coche vient de terminer. C'est ce que `buildDayAgenda` compare pour
      // savoir si l'occurrence du jour est faite — jamais `due` lui-même,
      // que le cron des rappels avance aussi sans que rien n'ait été fait.
      return {
        kind: "advanced",
        patch: { due: next.toISOString(), lastCompletedOccurrenceAt: due.toISOString() },
      };
    }
    // Série terminée ou règle non comprise : on retire la récurrence au lieu de
    // la laisser dériver silencieusement. Même choix que `reminders.ts`.
    return { kind: "done", patch: { doneAt: now.toISOString(), rrule: null } };
  }

  return { kind: "done", patch: { doneAt: now.toISOString() } };
}
