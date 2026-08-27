import { nextOccurrence, occurrencesInRange } from "./rrule";
import { applyOverride, remoteDueToItem } from "./overrides";
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
 * L'occurrence BRUTE (RRULE) que la coche vient de terminer, quand l'UI ne la
 * fournit pas.
 *
 * Le cron des rappels avance `due` après CHAQUE envoi, fait ou non — cocher
 * une occurrence dont le rappel a déjà sonné enregistrerait alors le PROCHAIN
 * rendez-vous comme « fait » (constaté en prod le 2026-08-20 sur TOUTES les
 * récurrentes : Poster/Reposter 10 → lundi 24 au lieu du jeudi 20, Aller
 * courir → samedi 22 au lieu du mercredi 19). L'UI récente transmet
 * `completedAt` (l'occurrence effective affichée) ; en son absence, on prend
 * l'occurrence de la série la plus récente dont le JOUR est ≤ aujourd'hui —
 * c'est elle qui est affichée et qu'on coche. Le jour (pas l'heure) : une
 * occurrence du jour décalée en soirée par un override (ex. Poster 10 décalé
 * à 19:00) est cochée pendant la journée, avant son heure effective — la
 * comparer à `now` la raterait.
 *
 * ⚠️ Renvoie l'occurrence BRUTE (avant `applyOverride`) : la prochaine
 * occurrence doit se calculer sur la grille de la RRULE, pas sur une heure
 * décalée, sinon la série dérive d'une heure à chaque coche.
 */
function inferCompletedOccurrence(item: Item, now: Date): Date | null {
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
  const todayKey = `${y}-${m}-${d}`;

  const occurrences = occurrencesInRange(start, item.rrule, rangeStart, rangeEnd)
    .map((o) => ({ raw: o, eff: applyOverride(o, item.overrides, item.exdates) }))
    .filter((x): x is { raw: Date; eff: Date } => x.eff !== null)
    .filter((x) => {
      const p = zonedParts(x.eff);
      return `${p.y}-${p.m}-${p.d}` <= todayKey;
    })
    .sort((a, b) => a.eff.getTime() - b.eff.getTime());

  const chosen = occurrences[occurrences.length - 1];
  return chosen ? chosen.raw : null;
}

/**
 * L'occurrence BRUTE cochée à partir d'un `completedAt` EFFECTIF fourni par
 * l'UI (l'heure affichée, post-override). Si cette heure est la valeur d'un
 * override, on retrouve la clé brute correspondante ; sinon on considère
 * que `completedAt` EST déjà l'occurrence brute (cas sans décalage).
 */
function rawForCompletedAt(item: Item, completedAt: Date): Date | null {
  const t = completedAt.getTime();
  if (Number.isNaN(t)) return null;
  for (const [k, v] of Object.entries(item.overrides ?? {})) {
    const moved = new Date(remoteDueToItem(v));
    if (!Number.isNaN(moved.getTime()) && moved.getTime() === t) {
      const raw = new Date(remoteDueToItem(k));
      return Number.isNaN(raw.getTime()) ? null : raw;
    }
  }
  return completedAt;
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
    // L'occurrence PRÉCISE que cette coche termine. Priorité :
    //   1. `completedAt` fourni par l'UI (l'heure effective affichée) —
    //      ramenée à l'occurrence BRUTE de la RRULE via `rawForCompletedAt` ;
    //   2. l'occurrence de la série la plus récente (jour ≤ aujourd'hui),
    //      déduite par le serveur (`inferCompletedOccurrence`) — couvre les
    //      clients qui n'envoient pas le champ (vieux bundle PWA, liste
    //      desktop) ;
    //   3. `due` (comportement historique) — uniquement quand rien de sûr.
    // Le cron des rappels avance AUSSI `due` : sans cette résolution, cocher
    // une occurrence dont le rappel a déjà sonné enregistrerait le PROCHAIN
    // rendez-vous comme « fait » et laisserait l'occurrence du jour non
    // cochée (prod 2026-08-20, puis 2026-08-26 — Poster 10).
    const provided = completedAt && !Number.isNaN(new Date(completedAt).getTime())
      ? new Date(completedAt)
      : null;
    const checkedRaw =
      (provided ? rawForCompletedAt(item, provided) : null) ??
      inferCompletedOccurrence(item, now) ??
      due;
    // L'occurrence effective cochée (post-override) — c'est elle qui fait
    // foi pour « fait jusqu'à maintenant ».
    const checkedEffective =
      applyOverride(checkedRaw, item.overrides, item.exdates) ?? checkedRaw;
    // La prochaine occurrence se calcule depuis l'occurrence COCHÉE (jamais
    // depuis `due`, qui peut avoir été avancé par le cron des rappels — un
    // calcul depuis `due` sauterait l'occurrence du jour).
    const next = nextOccurrence(checkedRaw, item.rrule, now);
    if (next) {
      return {
        kind: "advanced",
        patch: {
          due: next.toISOString(),
          lastCompletedOccurrenceAt: checkedEffective.toISOString(),
        },
      };
    }
    // Série terminée ou règle non comprise : on retire la récurrence au lieu de
    // la laisser dériver silencieusement. Même choix que `reminders.ts`.
    return { kind: "done", patch: { doneAt: now.toISOString(), rrule: null } };
  }

  return { kind: "done", patch: { doneAt: now.toISOString() } };
}
