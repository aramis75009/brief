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

export function completionPatch(
  item: Item,
  done: boolean,
  now: Date,
  completedAt?: string | null,
): CompletionOutcome {
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
      // `lastCompletedOccurrenceAt` = l'instant que cette coche vient de
      // terminer : l'occurrence PRÉCISE cochée (`completedAt`), pas `due`
      // aveugle. Le cron des rappels avance AUSSI `due` après chaque envoi,
      // fait ou non — cocher une occurrence dont le rappel a déjà sonné
      // enregistrerait alors le PROCHAIN rendez-vous comme « fait » et
      // l'occurrence du jour réapparaîtrait non cochée (constaté en prod le
      // 2026-08-20 : « Reposter/Poster 10 articles », rappel de 18:30 sonné,
      // `due` avancé au lundi, coche du jeudi → « Repoussé au lundi » et
      // case toujours vide). L'UI, qui affiche l'occurrence effective du jour,
      // la fournit ; en son absence, retomber sur `due` (comportement
      // historique).
      const completed =
        completedAt && !Number.isNaN(new Date(completedAt).getTime())
          ? new Date(completedAt).toISOString()
          : due.toISOString();
      return {
        kind: "advanced",
        patch: { due: next.toISOString(), lastCompletedOccurrenceAt: completed },
      };
    }
    // Série terminée ou règle non comprise : on retire la récurrence au lieu de
    // la laisser dériver silencieusement. Même choix que `reminders.ts`.
    return { kind: "done", patch: { doneAt: now.toISOString(), rrule: null } };
  }

  return { kind: "done", patch: { doneAt: now.toISOString() } };
}
