/**
 * Mapping projet Brief → nom du calendrier iCloud de destination.
 *
 * Client-safe (pas de `server-only`) : dupliqué depuis `caldav.ts` pour
 * permettre à l'écran Réglages d'afficher le calendrier Apple associé à
 * chaque projet. Le mapping change rarement (dernière fois le 18/08).
 * Si `caldav.ts` a un mapping différent (via `BRIEF_CALDAV_MAPPING` env),
 * le serveur reste la vérité — ce fichier n'est que pour l'affichage.
 */
export const CALENDAR_MAPPING: Record<string, string> = {
  "frip-trend": "Vinted Frip&Trend",
  "my-flip": "My Flip",
  perso: "Personnel",
  sport: "Sport",
  webacademie: "Web@académie",
  ia: "IA",
  fake: "Fake",
  permis: "Permis",
};

export function calendarForProjectName(projectId: string | null | undefined): string {
  if (!projectId) return "Personnel";
  return CALENDAR_MAPPING[projectId] ?? "Personnel";
}