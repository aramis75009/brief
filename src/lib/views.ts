/**
 * Calculs des vues de la refonte v2 — Liste, Tableau, Chronologie, Calendrier,
 * Tableau de bord.
 *
 * Purs et testés, comme `desktopDashboard.ts` et `calendarLanes.ts` : les
 * composants n'y font que du rendu. C'est ce qui permet de vérifier « une
 * occurrence déplacée se range au bon jour » sans monter un DOM.
 *
 * ⚠️ Aucune méthode locale de `Date` (invariant `AGENTS.md`) : tout calcul de
 * jour passe par `zoned.ts`, qui travaille dans Europe/Paris. La production
 * tourne en UTC — un `getDay()` ici donnerait une grille décalée d'un jour en
 * prod et juste sur le Mac.
 */

import { makeBucketOf, type Bucket } from "./buckets";
import { effectiveDue, effectiveStart, statusOf, type TaskStatus } from "./status";
import { shiftDays, zonedParts, zonedTime, TIMEZONE, type CalendarDate } from "./zoned";
import type { Item, KanbanColumn } from "./types";

/* ---------------------------------------------------------------------------
 * Grille de jours — le socle commun de la Chronologie et du Calendrier.
 * ------------------------------------------------------------------------ */

export type DayCell = {
  date: CalendarDate;
  /** `2026-09-07` — clé stable, jamais un objet `Date` en clé de map. */
  key: string;
  /** `DIM`, `LUN`… en majuscules, comme le prototype. */
  dow: string;
  /** Le numéro du jour dans le mois. */
  num: string;
  weekend: boolean;
  isToday: boolean;
};

const DOW = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];

export function dayKey({ y, m, d }: CalendarDate): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * `count` jours consécutifs à partir de `offset` jours après aujourd'hui.
 *
 * `offset` négatif regarde en arrière : la chronologie du prototype démarre
 * quelques jours avant aujourd'hui pour que les tâches en retard aient une
 * barre visible plutôt qu'une barre collée au bord gauche.
 */
export function dayGrid(now: Date, offset: number, count: number): DayCell[] {
  const today = zonedParts(now);
  const todayKey = dayKey(today);
  const out: DayCell[] = [];
  for (let i = 0; i < count; i++) {
    const date = shiftDays(today, offset + i);
    // `weekdayOf` travaille sur le calendrier de Paris — pas `getDay()`.
    const wd = weekdayIndex(date);
    const key = dayKey(date);
    out.push({
      date,
      key,
      dow: DOW[wd],
      num: String(date.d),
      weekend: wd === 0 || wd === 6,
      isToday: key === todayKey,
    });
  }
  return out;
}

/** 0 = dimanche … 6 = samedi, dans le calendrier de Paris. */
function weekdayIndex({ y, m, d }: CalendarDate): number {
  return zonedParts(zonedTime(y, m, d, 12, 0)).weekday;
}

/** Le lundi de la semaine contenant `now`, dans Europe/Paris. */
export function mondayOf(now: Date): CalendarDate {
  const parts = zonedParts(now);
  return shiftDays(parts, -((parts.weekday + 6) % 7));
}

/** La grille de sept jours du calendrier hebdomadaire, lundi → dimanche. */
export function weekGrid(now: Date): DayCell[] {
  const monday = mondayOf(now);
  const todayKey = dayKey(zonedParts(now));
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDays(monday, i);
    const wd = weekdayIndex(date);
    const key = dayKey(date);
    return {
      date,
      key,
      dow: DOW[wd],
      num: String(date.d),
      weekend: wd === 0 || wd === 6,
      isToday: key === todayKey,
    };
  });
}

/* ---------------------------------------------------------------------------
 * Libellé d'échéance — le « Aujourd'hui – 8 sep » du prototype.
 * ------------------------------------------------------------------------ */

function monthShort(date: Date): string {
  return date
    .toLocaleDateString("fr-FR", { month: "short", timeZone: TIMEZONE })
    .replace(/\.$/, "");
}

function timeOf(date: Date): string {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
}

/**
 * Le nom d'un jour relatif à aujourd'hui, ou `null` si trop loin pour en
 * avoir un. Trois seulement : au-delà, « dans 4 jours » se calcule moins vite
 * qu'une date ne se lit.
 */
function relativeDayName(target: CalendarDate, today: CalendarDate): string | null {
  const key = dayKey(target);
  if (key === dayKey(today)) return "Aujourd'hui";
  if (key === dayKey(shiftDays(today, 1))) return "Demain";
  if (key === dayKey(shiftDays(today, -1))) return "Hier";
  return null;
}

/**
 * Le libellé d'échéance d'un item — une date, ou une PLAGE quand
 * `startDate` est posé et tombe un autre jour que `due`.
 *
 * Exemples : `Aujourd'hui 18:30`, `Demain`, `8 sept`, `9 – 11 sept`,
 * `Aujourd'hui – 8 sept`, `28 sept – 3 oct`.
 *
 * Le mois n'est écrit qu'une fois quand les deux bornes le partagent — sinon
 * « 9 sept – 11 sept » occupe une colonne de liste pour rien.
 */
export function rangeLabel(item: Item, now: Date): string {
  const due = effectiveDue(item);
  if (!due) return "Pas d'échéance";

  const today = zonedParts(now);
  const dueParts = zonedParts(due);
  const start = effectiveStart(item);
  const startParts = start ? zonedParts(start) : null;

  // Pas de plage : une seule date, avec l'heure si le créneau en a une.
  if (!startParts || dayKey(startParts) === dayKey(dueParts)) {
    const name = relativeDayName(dueParts, today);
    const time = item.allDay ? "" : ` ${timeOf(due)}`;
    return name ? `${name}${time}` : `${dueParts.d} ${monthShort(due)}${time}`;
  }

  // Une plage inversée est une donnée cassée, pas une plage : on n'affiche
  // que l'échéance plutôt qu'un « 11 – 9 sept » que personne ne sait lire.
  if (start && start.getTime() > due.getTime()) {
    const name = relativeDayName(dueParts, today);
    return name ?? `${dueParts.d} ${monthShort(due)}`;
  }

  const sameMonth = startParts.y === dueParts.y && startParts.m === dueParts.m;
  const startName = relativeDayName(startParts, today);
  const left = startName ?? (sameMonth ? String(startParts.d) : `${startParts.d} ${monthShort(start!)}`);
  const right = `${dueParts.d} ${monthShort(due)}`;
  return `${left} – ${right}`;
}

/* ---------------------------------------------------------------------------
 * Groupement de la Liste et du Tableau — une seule donnée, deux rendus.
 *
 * Dans un PROJET, on groupe par colonne Kanban : glisser une carte dans le
 * Tableau déplace la ligne dans la Liste, sans code supplémentaire. Hors
 * projet (« Mes tâches »), on groupe par temps — les `buckets` qui servent
 * déjà `/api/overview`, pour qu'aucun second « cette semaine » ne diverge.
 * ------------------------------------------------------------------------ */

export type GroupMode = "column" | "time";

export type ItemGroup = {
  key: string;
  label: string;
  items: Item[];
};

const TIME_GROUPS: { key: Bucket; label: string }[] = [
  { key: "overdue", label: "En retard" },
  { key: "today", label: "Aujourd'hui" },
  { key: "week", label: "Cette semaine" },
  { key: "later", label: "Plus tard" },
  { key: "none", label: "Sans échéance" },
];

/** La clé de groupe « pas encore rangée » du mode colonne. */
export const UNPLACED = "unplaced";

/**
 * Groupe les items pour la Liste et le Tableau.
 *
 * Les groupes VIDES sont conservés en mode colonne (une colonne Kanban vide
 * doit rester une cible de dépôt) et retirés en mode temps (un « Plus tard »
 * vide n'est qu'un titre qui pousse le reste vers le bas).
 */
export function groupItems(
  items: Item[],
  mode: GroupMode,
  columns: KanbanColumn[],
  now: Date,
): ItemGroup[] {
  if (mode === "column") {
    const ordered = [...columns].sort((a, b) => a.order - b.order);
    const groups = ordered.map((c) => ({
      key: c.id,
      label: c.name,
      items: items.filter((it) => it.columnId === c.id),
    }));
    const known = new Set(ordered.map((c) => c.id));
    // Une carte dont la colonne a été supprimée ailleurs ne doit pas
    // disparaître de l'écran : elle retombe dans « Non placées ».
    const unplaced = items.filter((it) => !it.columnId || !known.has(it.columnId));
    return unplaced.length > 0
      ? [...groups, { key: UNPLACED, label: "Non placées", items: unplaced }]
      : groups;
  }

  const bucketOf = makeBucketOf(now);
  return TIME_GROUPS.map(({ key, label }) => ({
    key,
    label,
    items: items.filter((it) => bucketOf(it.due) === key),
  })).filter((g) => g.items.length > 0);
}

/* ---------------------------------------------------------------------------
 * Chronologie — barres et flèches de dépendance.
 * ------------------------------------------------------------------------ */

export type TimelineRow = {
  item: Item;
  /** Index de la colonne de départ dans la grille. */
  startIndex: number;
  /** Nombre de colonnes couvertes, toujours ≥ 1. */
  span: number;
  /** La barre est coupée au bord — la plage sort de la fenêtre affichée. */
  clippedStart: boolean;
  clippedEnd: boolean;
};

/**
 * Place chaque item sur la grille de jours.
 *
 * Un item sans `startDate` occupe UNE colonne, celle de son échéance : c'est
 * le cas de la très grande majorité, et lui donner une largeur arbitraire
 * dessinerait un planning qu'Aramis n'a jamais saisi.
 *
 * Un item dont la plage ne croise pas du tout la fenêtre est absent du
 * résultat — pas rendu à `startIndex: 0`, ce qui l'empilerait au bord gauche
 * en prétendant qu'il commence aujourd'hui.
 */
export function timelineRows(items: Item[], days: DayCell[], _now: Date): TimelineRow[] {
  if (days.length === 0) return [];
  const index = new Map(days.map((d, i) => [d.key, i]));
  const first = days[0].key;
  const last = days[days.length - 1].key;

  const rows: TimelineRow[] = [];
  for (const item of items) {
    const due = effectiveDue(item);
    if (!due) continue;
    const start = effectiveStart(item);
    const dueKey = dayKey(zonedParts(due));
    // Une plage inversée est une donnée cassée : on retombe sur l'échéance
    // seule plutôt que de dessiner une barre de largeur négative.
    const startKey =
      start && start.getTime() <= due.getTime() ? dayKey(zonedParts(start)) : dueKey;

    if (dueKey < first || startKey > last) continue;

    const clippedStart = startKey < first;
    const clippedEnd = dueKey > last;
    const from = clippedStart ? 0 : index.get(startKey);
    const to = clippedEnd ? days.length - 1 : index.get(dueKey);
    if (from === undefined || to === undefined) continue;

    rows.push({ item, startIndex: from, span: Math.max(1, to - from + 1), clippedStart, clippedEnd });
  }
  return rows;
}

export type TimelineDep = {
  /** Index de LIGNE (pas de colonne) du prédécesseur et du successeur. */
  fromRow: number;
  toRow: number;
  /** Colonne de fin du prédécesseur, colonne de début du successeur. */
  fromCol: number;
  toCol: number;
};

/**
 * Les flèches « A avant B » entre deux barres visibles.
 *
 * Une dépendance dont l'une des deux extrémités n'est pas dans la fenêtre est
 * omise : une flèche qui part de nulle part se lit comme une erreur de rendu.
 */
export function timelineDeps(rows: TimelineRow[]): TimelineDep[] {
  const rowOf = new Map(rows.map((r, i) => [r.item.id, i]));
  const out: TimelineDep[] = [];
  rows.forEach((row, toRow) => {
    for (const depId of row.item.dependsOn ?? []) {
      const fromRow = rowOf.get(depId);
      if (fromRow === undefined) continue;
      const from = rows[fromRow];
      out.push({
        fromRow,
        toRow,
        fromCol: from.startIndex + from.span,
        toCol: row.startIndex,
      });
    }
  });
  return out;
}

/* ---------------------------------------------------------------------------
 * Tableau de bord — les chiffres du prototype.
 * ------------------------------------------------------------------------ */

export type DashboardStats = {
  total: number;
  done: number;
  late: number;
  atrisk: number;
  ontrack: number;
  /** Répartition par groupe (colonne ou temps) — les barres verticales. */
  byGroup: { key: string; label: string; count: number }[];
  /** Les quatre parts du donut, dans l'ordre de dessin. */
  donut: { status: TaskStatus; count: number; pct: number }[];
  /** Tâches terminées par jour sur `days` jours, la dernière = aujourd'hui. */
  completion: number[];
};

export function dashboardStats(
  items: Item[],
  groups: ItemGroup[],
  now: Date,
  completionDays = 14,
): DashboardStats {
  const byId = new Map(items.map((it) => [it.id, it]));
  const counts: Record<TaskStatus, number> = { done: 0, late: 0, atrisk: 0, ontrack: 0 };
  for (const it of items) counts[statusOf(it, now, byId)] += 1;

  const total = items.length;
  // Un total nul donne 0 % partout, jamais NaN — un donut `NaN deg` disparaît
  // silencieusement au lieu d'afficher un cercle vide.
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  const today = zonedParts(now);
  const completion = Array.from({ length: completionDays }, (_, i) => {
    const key = dayKey(shiftDays(today, i - (completionDays - 1)));
    return items.filter((it) => it.doneAt && dayKey(zonedParts(new Date(it.doneAt))) === key).length;
  });

  return {
    total,
    done: counts.done,
    late: counts.late,
    atrisk: counts.atrisk,
    ontrack: counts.ontrack,
    byGroup: groups.map((g) => ({ key: g.key, label: g.label, count: g.items.length })),
    donut: (["ontrack", "atrisk", "late", "done"] as TaskStatus[]).map((status) => ({
      status,
      count: counts[status],
      pct: pct(counts[status]),
    })),
    completion,
  };
}

/**
 * Le `conic-gradient` du donut, construit à partir des parts.
 *
 * Les degrés sont CUMULÉS puis arrondis à la fin, jamais arrondis part par
 * part : quatre arrondis indépendants laissent un liseré blanc de quelques
 * degrés à la jointure, visible sur fond clair.
 */
export function donutGradient(
  donut: DashboardStats["donut"],
  colorOf: (status: TaskStatus) => string,
  emptyColor: string,
): string {
  const total = donut.reduce((n, d) => n + d.count, 0);
  if (total === 0) return emptyColor;
  let acc = 0;
  const stops = donut
    .filter((d) => d.count > 0)
    .map((d) => {
      const from = (acc / total) * 360;
      acc += d.count;
      const to = (acc / total) * 360;
      return `${colorOf(d.status)} ${from.toFixed(2)}deg ${to.toFixed(2)}deg`;
    });
  return `conic-gradient(${stops.join(",")})`;
}
