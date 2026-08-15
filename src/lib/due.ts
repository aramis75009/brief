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
 * ⚠️ Toute l'arithmétique de calendrier passe par `src/lib/zoned.ts`, jamais
 * par les méthodes locales de `Date`. La raison y est expliquée en tête : ces
 * méthodes lisent le fuseau de la machine, et la production tourne en UTC.
 */

import {
  TIMEZONE,
  lastDayOfMonth,
  offsetMinutes,
  shiftDays,
  zonedParts,
  zonedTime,
} from "./zoned";

export { TIMEZONE };

/** Heure par défaut d'une échéance sans heure explicite. */
const DEFAULT_HOUR = 9;
const EVENING_HOUR = 19;

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

/** Le jour calendaire de `base` dans `TIMEZONE`, à l'heure demandée. */
function atHour(base: Date, hour: number, minute = 0): Date {
  const { y, m, d } = zonedParts(base);
  return zonedTime(y, m, d, hour, minute);
}

/** `days` jours après le jour calendaire de `base`, à l'heure par défaut. */
function atDayOffset(base: Date, days: number): Date {
  const { y, m, d } = shiftDays(zonedParts(base), days);
  return zonedTime(y, m, d, DEFAULT_HOUR, 0);
}

function nextWeekday(from: Date, target: number): Date {
  const parts = zonedParts(from);
  const current = parts.weekday === 0 ? 7 : parts.weekday;
  let delta = target - current;
  if (delta <= 0) delta += 7;
  const next = shiftDays(parts, delta);
  return zonedTime(next.y, next.m, next.d, DEFAULT_HOUR, 0);
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
    return atHour(d, explicitHour, explicitMinute);
  };

  const today = atHour(now, DEFAULT_HOUR);

  if (text.startsWith("aujourd")) return done(applyHour(today), explicitHour !== null);
  if (text.startsWith("ce soir")) return done(atHour(now, EVENING_HOUR), true);

  if (text.startsWith("après-demain") || text.startsWith("apres-demain")) {
    return done(applyHour(atDayOffset(now, 2)), explicitHour !== null);
  }
  if (text.startsWith("demain")) {
    return done(applyHour(atDayOffset(now, 1)), explicitHour !== null);
  }
  if (text.startsWith("semaine prochaine")) {
    return done(nextWeekday(now, 1), false);
  }
  if (text.startsWith("fin de mois")) {
    const { y, m } = zonedParts(now);
    return done(zonedTime(y, m, lastDayOfMonth({ y, m, d: 1 }), DEFAULT_HOUR, 0), false);
  }

  for (const [name, index] of Object.entries(WEEKDAYS)) {
    if (text.includes(name)) return done(applyHour(nextWeekday(now, index)), explicitHour !== null);
  }

  return null;
}

function done(date: Date, hasHour: boolean): { due: string; allDay: boolean } {
  return { due: toIsoWithOffset(date), allDay: !hasHour };
}

/** Rend une date absolue lisible en français, pour l'affichage standard. */
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

export type RelativeDueInfo = {
  label: string;
  tone: "overdue" | "today" | "tomorrow" | "future" | "none";
  color: string;
  bg: string;
};

/**
 * Formatage naturel et dynamique avec sémantique de couleur pour les listes de tâches.
 */
export function formatRelativeDue(due: string | null, allDay: boolean, now: Date = new Date()): RelativeDueInfo {
  if (!due) {
    return {
      label: "Pas d'échéance",
      tone: "none",
      color: "var(--color-ink-3)",
      bg: "transparent",
    };
  }

  const date = new Date(due);
  if (Number.isNaN(date.getTime())) {
    return {
      label: "Échéance illisible",
      tone: "none",
      color: "var(--color-ink-3)",
      bg: "transparent",
    };
  }

  const nowParts = zonedParts(now);
  const dueParts = zonedParts(date);

  const startOfToday = zonedTime(nowParts.y, nowParts.m, nowParts.d, 0, 0);
  const startOfDueDay = zonedTime(dueParts.y, dueParts.m, dueParts.d, 0, 0);

  // Différence en jours calendaires
  const diffDays = Math.round((startOfDueDay.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));

  const timeStr = allDay
    ? ""
    : ` · ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE })}`;

  if (diffDays < 0) {
    const overdueLabel = diffDays === -1 ? "Hier" : `Il y a ${Math.abs(diffDays)} j`;
    return {
      label: `${overdueLabel}${timeStr}`,
      tone: "overdue",
      color: "var(--color-error)",
      bg: "var(--color-action-lo)",
    };
  }

  if (diffDays === 0) {
    return {
      label: `Aujourd'hui${timeStr}`,
      tone: "today",
      color: "var(--color-action)",
      bg: "var(--color-action-lo)",
    };
  }

  if (diffDays === 1) {
    return {
      label: `Demain${timeStr}`,
      tone: "tomorrow",
      color: "var(--color-warn)",
      bg: "var(--color-p4)",
    };
  }

  if (diffDays === 2) {
    return {
      label: `Après-demain${timeStr}`,
      tone: "future",
      color: "var(--color-ink-2)",
      bg: "var(--color-page)",
    };
  }

  if (diffDays > 2 && diffDays < 7) {
    const weekday = date.toLocaleDateString("fr-FR", { weekday: "long", timeZone: TIMEZONE });
    const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return {
      label: `${capitalized}${timeStr}`,
      tone: "future",
      color: "var(--color-ink-2)",
      bg: "var(--color-page)",
    };
  }

  // Au-delà de 7 jours
  const formatted = date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TIMEZONE,
  });

  return {
    label: `${formatted}${timeStr}`,
    tone: "future",
    color: "var(--color-ink-2)",
    bg: "var(--color-page)",
  };
}
