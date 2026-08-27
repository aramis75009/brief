/**
 * Récurrence — calcul de la prochaine occurrence.
 *
 * PORTÉE VOLONTAIREMENT LIMITÉE. Ce n'est pas une implémentation de la
 * RFC 5545 : c'est le sous-ensemble que le prompt de structuration peut
 * réellement produire, à savoir `FREQ` (DAILY, WEEKLY, MONTHLY, YEARLY),
 * `INTERVAL`, `BYDAY`, `COUNT` et `UNTIL`. Une règle qui sort de ce cadre est
 * signalée par `null` plutôt que silencieusement mal interprétée.
 *
 * Pourquoi ne pas prendre une bibliothèque : les moteurs RRULE complets pèsent
 * lourd, gèrent des cas que Brief n'émet jamais, et masqueraient justement les
 * règles hors périmètre au lieu de les refuser. Ici, ce qui n'est pas compris
 * est visible.
 */

import { type CalendarDate, shiftDays, shiftMonths, weekdayOf, zonedParts, zonedTime } from "./zoned";

const DAY_CODES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export type ParsedRrule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  byDay: number[];
  count: number | null;
  until: Date | null;
};

export function parseRrule(rrule: string): ParsedRrule | null {
  const parts = new Map<string, string>();
  for (const chunk of rrule.split(";")) {
    const [k, v] = chunk.split("=");
    if (k && v) parts.set(k.trim().toUpperCase(), v.trim());
  }

  const freq = parts.get("FREQ")?.toUpperCase();
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") {
    return null;
  }

  const interval = Number(parts.get("INTERVAL") ?? 1);
  if (!Number.isInteger(interval) || interval < 1) return null;

  const byDay = (parts.get("BYDAY") ?? "")
    .split(",")
    .map((c) => DAY_CODES[c.trim().toUpperCase().slice(-2)])
    .filter((d): d is number => d !== undefined);

  const rawCount = parts.get("COUNT");
  const count = rawCount ? Number(rawCount) : null;
  if (count !== null && (!Number.isInteger(count) || count < 1)) return null;

  const rawUntil = parts.get("UNTIL");
  let until: Date | null = null;
  if (rawUntil) {
    // Format RFC : 20260815T090000Z, ou une date ISO si le modèle s'égare.
    const iso = /^\d{8}T\d{6}Z?$/.test(rawUntil)
      ? `${rawUntil.slice(0, 4)}-${rawUntil.slice(4, 6)}-${rawUntil.slice(6, 8)}T` +
        `${rawUntil.slice(9, 11)}:${rawUntil.slice(11, 13)}:${rawUntil.slice(13, 15)}Z`
      : rawUntil;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return null;
    until = parsed;
  }

  return { freq, interval, byDay, count, until };
}

/**
 * Prochaine occurrence STRICTEMENT après `from`, en conservant l'heure de `start`.
 *
 * Renvoie `null` quand la série est terminée (`UNTIL` dépassé) ou quand la règle
 * n'est pas comprise — dans les deux cas l'appelant arrête d'y toucher, ce qui
 * est le comportement sûr : mieux vaut une récurrence qui s'arrête et se voit
 * qu'une récurrence qui dérive.
 *
 * `COUNT` n'est pas décrémenté ici : c'est l'appelant qui suit le nombre
 * d'occurrences déjà envoyées, ce module ne garde aucun état.
 */
export function nextOccurrence(start: Date, rrule: string, from: Date = start): Date | null {
  const rule = parseRrule(rrule);
  if (!rule) return null;

  // ⚠️ Toute l'avance se fait sur le CALENDRIER d'Europe/Paris, pas avec les
  // méthodes locales de `Date` : voir l'avertissement en tête de `zoned.ts`.
  // Une récurrence hebdomadaire dont l'heure tombe entre minuit et 2 h à Paris
  // change de jour de la semaine en UTC — le rappel partait alors le mauvais
  // jour, chaque semaine, en production seulement.
  const origin = zonedParts(start);
  const { hour, minute } = origin;
  let cal: CalendarDate = { y: origin.y, m: origin.m, d: origin.d };

  // On avance depuis `start` pour rester aligné sur l'heure d'origine, jamais
  // depuis `from` : sinon un rappel envoyé en retard décalerait toute la série.
  // Conserver l'heure LOCALE de Paris fait aussi qu'une série de 9 h reste à
  // 9 h en traversant le changement d'heure, au lieu de glisser à 8 h ou 10 h.
  let candidate = zonedTime(cal.y, cal.m, cal.d, hour, minute);
  let guard = 0;
  const LIMIT = 1000;

  while (candidate <= from) {
    guard += 1;
    if (guard > LIMIT) return null;

    if (rule.freq === "WEEKLY" && rule.byDay.length) {
      // Jour suivant de la liste, en respectant l'intervalle de semaines.
      const sorted = [...rule.byDay].sort((a, b) => a - b);
      const currentDay = weekdayOf(cal);
      const nextDay = sorted.find((d) => d > currentDay);
      cal =
        nextDay !== undefined
          ? shiftDays(cal, nextDay - currentDay)
          : shiftDays(cal, 7 * rule.interval - (currentDay - sorted[0]));
    } else if (rule.freq === "DAILY") {
      cal = shiftDays(cal, rule.interval);
    } else if (rule.freq === "WEEKLY") {
      cal = shiftDays(cal, 7 * rule.interval);
    } else if (rule.freq === "MONTHLY") {
      cal = shiftMonths(cal, rule.interval);
    } else {
      cal = shiftMonths(cal, 12 * rule.interval);
    }

    candidate = zonedTime(cal.y, cal.m, cal.d, hour, minute);
  }

  if (rule.until && candidate > rule.until) return null;
  return candidate;
}

/** Une occurrence en moins d'une période complète (`FREQ`×`INTERVAL`) avant `cal`. */
function stepBack(cal: CalendarDate, rule: ParsedRrule): CalendarDate {
  if (rule.freq === "DAILY") return shiftDays(cal, -rule.interval);
  if (rule.freq === "WEEKLY") return shiftDays(cal, -7 * rule.interval);
  if (rule.freq === "MONTHLY") return shiftMonths(cal, -rule.interval);
  return shiftMonths(cal, -12 * rule.interval);
}

/**
 * Toutes les occurrences d'une règle dans `[rangeStart, rangeEnd)`, heure de
 * départ conservée. Sert à l'affichage (semaine de l'agenda) : contrairement
 * à `nextOccurrence`, qui avance une seule fois pour le planificateur de
 * rappels, une vue calendrier doit montrer TOUTES les occurrences de la
 * fenêtre visible — une série hebdomadaire du lundi et jeudi doit apparaître
 * les DEUX jours dans la même semaine, pas une seule fois.
 *
 * ⚠️ `start` n'est PAS le début de la série : pour un item Brief récurrent,
 * c'est l'occurrence COURANTE, et `reminders.ts` l'avance dès l'ENVOI du
 * rappel — pas seulement quand la tâche est cochée. `start` peut donc déjà
 * pointer après la fenêtre demandée (on regarde un jour dont le rappel est
 * déjà parti). On recule d'abord jusqu'à couvrir `rangeStart`, PUIS on avance
 * — sinon une série dont l'ancre a sauté au samedi ne montrerait plus jamais
 * son occurrence du mercredi qu'on est justement en train de regarder.
 *
 * `start` (ou son ancre reculée) compte même pour une règle non comprise ou
 * déjà expirée (`UNTIL` dépassé) : mieux vaut montrer l'occurrence telle que
 * le calendrier la connaît que la faire disparaître sur un doute
 * d'interprétation RFC 5545 — même principe que `isRealCalendarDate` ailleurs
 * dans Brief. Bornée : le recul ne dépasse jamais 10 ans, l'avance jamais 60
 * occurrences — une vue calendrier n'en affiche jamais plus, et ça protège
 * contre une règle malformée qui boucherait.
 */
export function occurrencesInRange(start: Date, rrule: string, rangeStart: Date, rangeEnd: Date): Date[] {
  const rule = parseRrule(rrule);
  if (!rule) return start >= rangeStart && start < rangeEnd ? [start] : [];

  // Dédoublonné par horodatage : `start` et l'ancre reculée ci-dessous
  // peuvent coïncider (cas simple, comportement historique), et le recul
  // peut aussi sortir entièrement de la fenêtre pour une période longue
  // (YEARLY) — `start` reste alors le seul point sûr, on le garde toujours
  // s'il est dans la fenêtre, indépendamment de ce que le recul trouve.
  const out = new Map<number, Date>();
  if (start >= rangeStart && start < rangeEnd) out.set(start.getTime(), start);

  const origin = zonedParts(start);
  const { hour, minute } = origin;
  let cal: CalendarDate = { y: origin.y, m: origin.m, d: origin.d };
  let anchor = zonedTime(cal.y, cal.m, cal.d, hour, minute);

  for (let i = 0; i < 520 && anchor > rangeStart; i++) {
    cal = stepBack(cal, rule);
    anchor = zonedTime(cal.y, cal.m, cal.d, hour, minute);
  }
  if (anchor >= rangeStart && anchor < rangeEnd) out.set(anchor.getTime(), anchor);

  let candidate = anchor;
  for (let i = 0; i < 60; i++) {
    const next = nextOccurrence(anchor, rrule, candidate);
    if (!next || next >= rangeEnd) break;
    if (next >= rangeStart) out.set(next.getTime(), next);
    candidate = next;
  }
  return [...out.keys()].sort((a, b) => a - b).map((t) => out.get(t)!);
}

/** Décrit la règle en français, pour l'affichage. `null` si non comprise. */
export function describeRrule(rrule: string): string | null {
  const rule = parseRrule(rrule);
  if (!rule) return null;

  const names = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const every = rule.interval > 1 ? `toutes les ${rule.interval} ` : "";

  if (rule.freq === "WEEKLY" && rule.byDay.length) {
    const days = rule.byDay.map((d) => `${names[d]}s`).join(", ");
    return rule.interval > 1 ? `${every}semaines le ${days}` : `tous les ${days}`;
  }
  if (rule.freq === "DAILY") return rule.interval > 1 ? `${every}jours` : "tous les jours";
  if (rule.freq === "WEEKLY") return rule.interval > 1 ? `${every}semaines` : "toutes les semaines";
  if (rule.freq === "MONTHLY") return rule.interval > 1 ? `${every}mois` : "tous les mois";
  return rule.interval > 1 ? `${every}ans` : "tous les ans";
}
