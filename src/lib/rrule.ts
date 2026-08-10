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

  const candidate = new Date(start);
  // On avance depuis `start` pour rester aligné sur l'heure d'origine, jamais
  // depuis `from` : sinon un rappel envoyé en retard décalerait toute la série.
  let guard = 0;
  const LIMIT = 1000;

  while (candidate <= from) {
    guard += 1;
    if (guard > LIMIT) return null;

    if (rule.freq === "WEEKLY" && rule.byDay.length) {
      // Jour suivant de la liste, en respectant l'intervalle de semaines.
      const sorted = [...rule.byDay].sort((a, b) => a - b);
      const currentDay = candidate.getDay();
      const nextDay = sorted.find((d) => d > currentDay);
      if (nextDay !== undefined) {
        candidate.setDate(candidate.getDate() + (nextDay - currentDay));
      } else {
        const jumpToFirst = 7 * rule.interval - (currentDay - sorted[0]);
        candidate.setDate(candidate.getDate() + jumpToFirst);
      }
    } else if (rule.freq === "DAILY") {
      candidate.setDate(candidate.getDate() + rule.interval);
    } else if (rule.freq === "WEEKLY") {
      candidate.setDate(candidate.getDate() + 7 * rule.interval);
    } else if (rule.freq === "MONTHLY") {
      candidate.setMonth(candidate.getMonth() + rule.interval);
    } else {
      candidate.setFullYear(candidate.getFullYear() + rule.interval);
    }
  }

  if (rule.until && candidate > rule.until) return null;
  return candidate;
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
