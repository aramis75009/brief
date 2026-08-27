/**
 * Arithmétique de calendrier dans un fuseau fixe.
 *
 * ⚠️ RÈGLE DU MODULE, ET DE TOUS CEUX QUI L'UTILISENT : ne jamais appeler
 * `getFullYear()`, `getMonth()`, `getDate()`, `getDay()`, `getHours()`,
 * `setDate()`, `setMonth()` ni `setHours()` sur un `Date`. Ces méthodes lisent
 * et écrivent dans le fuseau de la MACHINE.
 *
 * Pourquoi ça compte ici plus qu'ailleurs : les conteneurs de production n'ont
 * pas de `TZ` posé, ils tournent en UTC, alors que le développement se fait sur
 * une machine française. Une échéance calculée avec ces méthodes est donc juste
 * en local et fausse en production, **sans aucun signal**. C'est le bug trouvé
 * le 2026-08-14 : « demain » sonnait à 11 h au lieu de 9 h sur le VPS, et la
 * suite de tests était verte sur le Mac.
 *
 * Ce module est la seule porte d'entrée autorisée. `src/lib/due.ts` et
 * `src/lib/rrule.ts` passent par lui.
 *
 * Le fuseau est fixe : Brief a un utilisateur, dans un pays. Le jour où ça
 * change, ça change ici et nulle part ailleurs.
 */

export const TIMEZONE = "Europe/Paris";

export type CalendarDate = { y: number; m: number; d: number };

/**
 * Décalage de `TIMEZONE` pour un instant donné, en minutes. Gère l'heure d'été.
 *
 * On formate le même instant dans le fuseau cible et en UTC, puis on mesure
 * l'écart : plus fiable qu'une table de règles de changement d'heure à
 * maintenir à la main. Les deux chaînes sont analysées de la même façon, donc
 * le résultat ne dépend pas du fuseau de la machine.
 */
export function offsetMinutes(date: Date): number {
  const asUtc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const asLocal = new Date(date.toLocaleString("en-US", { timeZone: TIMEZONE }));
  return Math.round((asLocal.getTime() - asUtc.getTime()) / 60_000);
}

const PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Composantes du calendrier d'un instant, lues DANS `TIMEZONE`. */
export function zonedParts(date: Date): CalendarDate & {
  weekday: number;
  hour: number;
  minute: number;
} {
  // Garde-fou : une date invalide (NaN) faisait planter formatToParts →
  // RangeError → crash de TOUTE l'app au rendu (constaté en prod le
  // 2026-08-19 : un DTSTART CalDAV flottant non converti). Une date
  // invalide ne doit jamais faire tomber l'interface ; elle renvoie une
  // valeur sentinelle que les appelants traitent comme « aucune date ».
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return { y: 0, m: 0, d: 0, weekday: -1, hour: -1, minute: -1 };
  }
  const f: Record<string, string> = {};
  for (const p of PARTS.formatToParts(date)) f[p.type] = p.value;

  const y = Number(f.year);
  const m = Number(f.month);
  const d = Number(f.day);

  return {
    y,
    m,
    d,
    weekday: weekdayOf({ y, m, d }),
    // ⚠️ `hour12: false` rend « 24 » à minuit sur certains moteurs, jamais « 0 ».
    hour: Number(f.hour) % 24,
    minute: Number(f.minute),
  };
}

/** Jour de la semaine d'une date calendaire (dimanche = 0), comme `getDay()`. */
export function weekdayOf({ y, m, d }: CalendarDate): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * L'instant correspondant à une date et une heure exprimées dans `TIMEZONE`.
 *
 * Deux passes, parce que le décalage à appliquer dépend de l'instant qu'on
 * cherche justement à calculer. La première approximation suffit toute l'année
 * sauf pendant les deux bascules d'heure d'été, que la seconde rattrape.
 */
export function zonedTime(y: number, m: number, d: number, hour: number, minute: number): Date {
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const approx = new Date(guess - offsetMinutes(new Date(guess)) * 60_000);
  return new Date(guess - offsetMinutes(approx) * 60_000);
}

/** Décale une date calendaire de `days` jours. */
export function shiftDays({ y, m, d }: CalendarDate, days: number): CalendarDate {
  const proxy = new Date(Date.UTC(y, m - 1, d + days));
  return { y: proxy.getUTCFullYear(), m: proxy.getUTCMonth() + 1, d: proxy.getUTCDate() };
}

/**
 * Décale une date calendaire de `months` mois.
 *
 * Le débordement est celui de JavaScript et c'est voulu : le 31 janvier + 1
 * mois donne le 3 mars, pas le 28 février. Changer ça relève d'une décision
 * produit sur la récurrence mensuelle, pas d'un correctif de fuseau.
 */
export function shiftMonths({ y, m, d }: CalendarDate, months: number): CalendarDate {
  const proxy = new Date(Date.UTC(y, m - 1 + months, d));
  return { y: proxy.getUTCFullYear(), m: proxy.getUTCMonth() + 1, d: proxy.getUTCDate() };
}

/** Dernier jour du mois d'une date calendaire. */
export function lastDayOfMonth({ y, m }: CalendarDate): number {
  // Le jour 0 du mois suivant est le dernier jour du mois courant.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
