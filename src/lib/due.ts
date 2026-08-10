/**
 * Résolution des échéances.
 *
 * ⚠️ C'EST LE CHANTIER QUE LE PIVOT A DÉPLACÉ. Avant, Brief envoyait
 * « avant vendredi » tel quel à un service tiers qui se chargeait du calcul.
 * Ce service n'existe plus : c'est Brief qui doit produire une date absolue
 * avec fuseau, parce que c'est elle que le planificateur de rappels
 * interrogera pour décider de la seconde exacte d'envoi.
 *
 * Deux chemins, un seul format de sortie :
 *   1. le LLM reçoit `now` et rend directement une date ISO absolue ;
 *   2. l'écran Revue propose des libellés courts, résolus ici.
 *
 * Le fuseau est fixé à Europe/Paris : Brief a un utilisateur, dans un pays.
 * Le jour où ça change, ça change ici et nulle part ailleurs.
 */

export const TIMEZONE = "Europe/Paris";

/** Heure par défaut d'une échéance sans heure explicite. */
const DEFAULT_HOUR = 9;
const EVENING_HOUR = 19;

/** Décalage d'Europe/Paris pour une date donnée, en minutes. Gère l'heure d'été. */
function offsetMinutes(date: Date): number {
  // On formate la même instant dans le fuseau cible et en UTC, puis on mesure
  // l'écart. Plus fiable qu'une table de règles DST à maintenir à la main.
  const asUtc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const asLocal = new Date(date.toLocaleString("en-US", { timeZone: TIMEZONE }));
  return Math.round((asLocal.getTime() - asUtc.getTime()) / 60_000);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Formate en ISO 8601 avec le décalage explicite, ex. `2026-08-12T14:00:00+02:00`. */
export function toIsoWithOffset(date: Date): string {
  const off = offsetMinutes(date);
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const local = new Date(date.getTime() + off * 60_000);
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/**
 * Une date ISO décrit-elle un jour qui existe vraiment ?
 *
 * ⚠️ `new Date("2026-02-31")` ne renvoie PAS une date invalide : JavaScript
 * fait déborder le mois et rend le 3 mars. Une date impossible inventée par le
 * modèle devient donc une date plausible et fausse, sans aucun signal. On
 * valide les composantes du calendrier avant de faire confiance à l'objet Date.
 */
export function isRealCalendarDate(iso: string): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1) return false;
  // Le jour 0 du mois suivant est le dernier jour du mois courant.
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Jour de la semaine en français → index ISO (lundi = 1). */
const WEEKDAYS: Record<string, number> = {
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 7,
};

function atHour(base: Date, hour: number): Date {
  const d = new Date(base);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function nextWeekday(from: Date, target: number): Date {
  const current = from.getDay() === 0 ? 7 : from.getDay();
  let delta = target - current;
  if (delta <= 0) delta += 7;
  const d = new Date(from);
  d.setDate(d.getDate() + delta);
  return atHour(d, DEFAULT_HOUR);
}

/**
 * Résout un libellé français court en date absolue.
 *
 * Renvoie `null` pour une chaîne vide **et** pour un libellé non reconnu — un
 * libellé qu'on ne sait pas lire ne doit jamais devenir une date approximative
 * silencieuse. L'appelant affiche « pas d'échéance » et l'utilisateur corrige.
 */
export function resolveDue(
  label: string,
  now: Date = new Date(),
): { due: string; allDay: boolean } | null {
  const text = label.trim().toLowerCase();
  if (!text) return null;

  // Une date déjà absolue traverse sans être retouchée — après vérification
  // que le jour existe (cf. isRealCalendarDate).
  const raw = label.trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    if (!isRealCalendarDate(raw)) return null;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return { due: toIsoWithOffset(parsed), allDay: false };
    }
    return null;
  }

  // Heure explicite : « demain 14h », « vendredi 9h30 ».
  const hourMatch = text.match(/(\d{1,2})\s*h\s*(\d{2})?/);
  const explicitHour = hourMatch ? Number(hourMatch[1]) : null;
  const explicitMinute = hourMatch?.[2] ? Number(hourMatch[2]) : 0;

  const applyHour = (d: Date): Date => {
    if (explicitHour === null) return d;
    const out = new Date(d);
    out.setHours(explicitHour, explicitMinute, 0, 0);
    return out;
  };

  const today = atHour(now, DEFAULT_HOUR);

  if (text.startsWith("aujourd")) return done(applyHour(today), explicitHour !== null);
  if (text.startsWith("ce soir")) return done(atHour(now, EVENING_HOUR), true);

  if (text.startsWith("après-demain") || text.startsWith("apres-demain")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return done(applyHour(d), explicitHour !== null);
  }
  if (text.startsWith("demain")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return done(applyHour(d), explicitHour !== null);
  }
  if (text.startsWith("semaine prochaine")) {
    return done(nextWeekday(now, 1), false);
  }
  if (text.startsWith("fin de mois")) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return done(atHour(d, DEFAULT_HOUR), false);
  }

  for (const [name, index] of Object.entries(WEEKDAYS)) {
    if (text.includes(name)) return done(applyHour(nextWeekday(now, index)), explicitHour !== null);
  }

  return null;
}

function done(date: Date, hasHour: boolean): { due: string; allDay: boolean } {
  return { due: toIsoWithOffset(date), allDay: !hasHour };
}

/** Rend une date absolue lisible en français, pour l'affichage. */
export function formatDue(due: string | null, allDay: boolean): string {
  if (!due) return "Pas d'échéance";
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return "Échéance illisible";

  const day = date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TIMEZONE,
  });
  if (allDay) return day;

  const time = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
  return `${day} · ${time}`;
}
