import type { Point } from "./graph";

/**
 * Disposition du graphe mémorisée par appareil.
 *
 * Même esprit que `src/lib/queue.ts` : une préférence de vue vit hors de React,
 * dans localStorage. Pas côté serveur — c'est purement cosmétique, le graphe
 * est desktop-only, et « Ajuster » sait toujours recalculer une disposition
 * propre. Toute lecture/écriture est défensive (SSR, quota, mode privé, JSON
 * corrompu) : un échec de persistance ne doit jamais casser la vue.
 */

const KEY = "brief:graph-layout";

function isPoint(v: unknown): v is Point {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as Point).x === "number" &&
    typeof (v as Point).y === "number"
  );
}

/**
 * Positions mémorisées, élaguées aux `knownIds` — un nœud supprimé depuis la
 * dernière session ne doit pas laisser de position fantôme.
 */
export function loadGraphLayout(knownIds: Set<string>): Record<string, Point> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, Point> = {};
    for (const [id, p] of Object.entries(parsed)) {
      if (knownIds.has(id) && isPoint(p)) out[id] = { x: p.x, y: p.y };
    }
    return out;
  } catch {
    return {};
  }
}

export function saveGraphLayout(positions: Record<string, Point>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(positions));
  } catch {
    /* quota / mode privé : la disposition ne persiste pas, tant pis */
  }
}

export function clearGraphLayout(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* rien à faire */
  }
}
