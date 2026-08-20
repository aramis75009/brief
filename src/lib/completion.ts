import { nextOccurrence, occurrencesInRange } from "./rrule";
import { applyOverride } from "./overrides";
import { shiftDays, zonedParts, zonedTime } from "./zoned";
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

/**
 * L'occurrence que la coche vient de terminer, quand l'UI ne la fournit pas.
 *
 * Le cron des rappels avance `due` après CHAQUE envoi, fait ou non — cocher
 * une occurrence dont le rappel a déjà sonné enregistrerait alors le PROCHAIN
 * rendez-vous comme « fait » (constaté en prod le 2026-08-20 sur TOUTES les
 * récurrentes : Poster/Reposter 10 → lundi 24 au lieu du jeudi 20, Aller
 * courir → samedi 22 au lieu du mercredi 19). L'UI récente transmet
 * `completedAt` (l'occurrence effective affichée) ; en son absence, on prend
 * l'occurrence de la série la plus récente avant la coche — c'est elle qui
 * est affichée et qu'on coche. `null` si rien de sûr (série non comprise,
 * aucune occurrence dans la fenêtre) : l'appelant retombe alors sur `due`.
 */
function inferCompletedOccurrence(item: Item, now: Date): string | null {
  if (!item.rrule || !item.due) return null;
  const start = item.seriesAnchor ? new Date(item.seriesAnchor) : new Date(item.due);
  if (Number.isNaN(start.getTime())) return null;

  // Fenêtre de 4 jours avant la coche : l'occurrence affichée et cochée est
  // toujours la plus récente de la série (règle zoned.ts : jamais les méthodes
  // locales de Date, la production tourne en UTC).
  const { y, m, d } = zonedParts(now);
  const back4 = shiftDays({ y, m, d }, -4);
  const rangeStart = zonedTime(back4.y, back4.m, back4.d, 0, 0);
  const nextDay = shiftDays({ y, m, d }, 1);
  const rangeEnd = zonedTime(nextDay.y, nextDay.m, nextDay.d, 0, 0);

  const occurrences = occurrencesInRange(start, item.rrule, rangeStart, rangeEnd)
    .map((o) => applyOverride(o, item.overrides, item.exdates))
    .filter((o): o is Date => o !== null && o.getTime() <= now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  const chosen = occurrences[occurrences.length - 1];
  return chosen ? chosen.toISOString() : null;
}

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
      // terminer : l'occurrence PRÉCISE cochée. Priorité :
      //   1. `completedAt` fourni par l'UI (l'occurrence effective affichée —
      //      chemin normal depuis le nouveau bundle) ;
      //   2. l'occurrence de la série la plus récente avant la coche,
      //      déduite par le serveur (`inferCompletedOccurrence`) — couvre les
      //      clients qui n'envoient pas le champ (vieux bundle en cache PWA) ;
      //   3. `due` (comportement historique) — uniquement quand rien de sûr.
      // Le cron des rappels avance AUSSI `due` : lui seul aurait fait
      // enregistrer le PROCHAIN rendez-vous comme « fait » et laissé
      // l'occurrence du jour non cochée (prod 2026-08-20).
      const provided =
        completedAt && !Number.isNaN(new Date(completedAt).getTime())
          ? new Date(completedAt).toISOString()
          : null;
      const completed = provided ?? inferCompletedOccurrence(item, now) ?? due.toISOString();
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
