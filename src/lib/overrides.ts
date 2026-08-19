/**
 * Overrides d'occurrences récurrentes — fonctions PURES, partageables entre
 * le serveur (caldav.ts, agenda.ts, reminders.ts) et le client (HomeScreen).
 *
 * Pourquoi ce module séparé : `caldav.ts` porte `import "server-only"` (il
 * touche au réseau et au store), mais l'écran d'accueil — un composant
 * client — doit afficher l'heure RÉELLE d'une occurrence, y compris quand
 * Aramis l'a décalée dans l'app Calendrier. Les conversions de dates et
 * l'application des overrides sont pures : elles vivent ici, sans effet de
 * bord, et les modules serveur les ré-exportent.
 */

/** `20260818T090000Z` — l'instant en UTC, format iCalendar. */
export function icalUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** `20260819T140000Z` → `2026-08-19T14:00:00Z` ; `20260819` → `2026-08-19T09:00:00+02:00` (allDay Brief). */
export function remoteDueToItem(dtstart: string): string {
  const utc = dtstart.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utc) {
    return `${utc[1]}-${utc[2]}-${utc[3]}T${utc[4]}:${utc[5]}:${utc[6]}Z`;
  }
  // DTSTART « flottant » (sans Z) : heure LOCALE du calendrier, à traiter
  // comme une heure de Paris — sinon `new Date()` reçoit une chaîne
  // illisible et l'item entier fait planter le rendu (RangeError
  // formatToParts, constaté en prod le 2026-08-19).
  const floating = dtstart.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (floating) {
    const [, y, mo, d, h, mi, s] = floating.map(Number);
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}+02:00`;
  }
  const day = dtstart.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (day) {
    return `${day[1]}-${day[2]}-${day[3]}T09:00:00+02:00`;
  }
  return dtstart;
}

/**
 * L'heure réelle d'une occurrence d'une série, en tenant compte d'un
 * éventuel override (occurrence décalée dans l'app Calendrier).
 *
 * `occurrence` est l'occurrence calculée par la RRULE (UTC RFC 5545,
 * `YYYYMMDDTHHMMSSZ`) ; `overrides` mappe `RECURRENCE-ID` → nouveau DTSTART.
 * Renvoie l'ISO 8601 de l'occurrence (décalée ou non), ou `null` si
 * l'occurrence a été SUPPRIMÉE (EXDATE) — l'appelant ne doit alors ni
 * l'afficher ni sonner pour elle.
 */
export function applyOverride(
  occurrence: Date,
  overrides: Record<string, string> | undefined,
  exdates: string[] | undefined,
): Date | null {
  const ical = icalUtc(occurrence);
  if (exdates?.includes(ical)) return null;
  const moved = overrides?.[ical];
  if (moved) {
    const parsed = new Date(remoteDueToItem(moved));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return occurrence;
}
