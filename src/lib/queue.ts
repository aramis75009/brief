"use client";

import { PIN_HEADER, getPin } from "./pin";
import type { DraftItem, Item } from "./types";

/** Ce qui dort dans la file : un brouillon + l'instant où il y est entré. */
type QueuedItem = DraftItem & { pendingAt?: string };

/**
 * File d'attente locale — pour que rien de dicté ne se perde.
 *
 * ⚠️ NOM HONNÊTE : ce n'est pas de l'« envoi différé ». iOS ne donne pas de
 * Background Sync à une application web : rien ne s'exécute quand l'app est
 * fermée. C'est donc un « envoi à la prochaine ouverture ». Appeler ça
 * autrement ferait croire à une garantie qui n'existe pas.
 *
 * Ce que ça couvre quand même : le métro, un parking, une coupure au mauvais
 * moment. La note survit, elle repart dès que Brief est rouvert avec du réseau.
 *
 * ⚠️ Safari peut évincer le stockage d'un site. La file n'est donc PAS un
 * coffre-fort : elle est vidée le plus vite possible, sa profondeur est visible
 * à l'écran, et un item en file n'est jamais compté comme enregistré.
 */

const KEY = "brief:queue";
const MAX_ITEMS = 50;

function read(): QueuedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedItem[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  } catch {
    // Quota dépassé ou stockage refusé (navigation privée). On ne peut pas
    // mettre en file : l'appelant doit le savoir, d'où le booléen de retour.
  }
  // Toute écriture prévient l'interface, y compris celle qui a échoué : l'écran
  // doit refléter la file RÉELLE, pas celle qu'on croyait avoir écrite.
  bump();
}

/* ---------------------------------------------------------------------------
 * La file vue comme une source externe (`useSyncExternalStore`).
 *
 * C'est ce qu'elle est : localStorage vit hors de React. La brancher ainsi
 * supprime les appels manuels de resynchronisation après chaque enqueue ou
 * flush — un oubli aurait laissé l'écran Tâches affirmer que rien n'attend
 * alors qu'une dictée dormait encore en file.
 * ------------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
let snapshot: Item[] = [];
let snapshotVersion = -1;

/** Référence STABLE : un tableau neuf à chaque appel ferait boucler React. */
const EMPTY: Item[] = [];

function bump(): void {
  version++;
  for (const l of listeners) l();
}

export function subscribeQueue(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Instantané mémoïsé — recalculé seulement quand la file a bougé. */
export function queueSnapshot(): Item[] {
  if (snapshotVersion !== version) {
    snapshot = queuedItems();
    snapshotVersion = version;
  }
  return snapshot;
}

/** Rendu serveur : aucune file, et surtout la même référence à chaque appel. */
export function queueServerSnapshot(): Item[] {
  return EMPTY;
}

export function queueDepth(): number {
  return read().length;
}

/** Ajoute des items à la file. `false` si le stockage a refusé. */
export function enqueue(items: DraftItem[]): boolean {
  if (!items.length) return true;
  const before = read();
  const incoming = new Set(items.map((i) => i.id));
  const at = new Date().toISOString();
  write([
    ...before.filter((i) => !incoming.has(i.id)),
    ...items.map((i) => ({ ...i, pendingAt: at })),
  ]);
  return queueDepth() > before.length || items.every((i) => incoming.has(i.id));
}

/**
 * La file, présentée comme des items — pour que l'écran Tâches montre une note
 * dictée hors ligne AU LIEU de faire comme si elle n'existait pas.
 *
 * `pendingAt` est renseigné, ce qui suffit à l'interface pour la dessiner en
 * contour pointillé : visible, mais jamais confondue avec un item enregistré.
 * C'est la propriété qui compte — une note en attente peut encore être perdue.
 */
export function queuedItems(): Item[] {
  return read().map((d) => {
    const at = d.pendingAt ?? new Date(0).toISOString();
    return { ...d, createdAt: at, pendingAt: at, remindedAt: null, doneAt: null };
  });
}

export function clearQueue(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* rien à faire : la file repartira au prochain flush */
  }
  bump();
}

export type FlushResult = { attempted: number; saved: number; remaining: number };

/**
 * Vide la file vers le serveur.
 *
 * Ne retire QUE ce que le serveur confirme avoir enregistré. Un échec réseau
 * laisse la file intacte — c'est la propriété qui empêche de perdre une dictée
 * en croyant l'avoir envoyée.
 */
export async function flushQueue(): Promise<FlushResult> {
  const items = read();
  if (!items.length) return { attempted: 0, saved: 0, remaining: 0 };

  const pin = getPin();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (pin) headers.set(PIN_HEADER, pin);

  let saved = 0;
  let savedIds: string[] = [];

  try {
    const res = await fetch("/api/items", {
      method: "POST",
      headers,
      body: JSON.stringify({ items }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      results?: { ok: boolean; id: string }[];
      saved?: number;
    };
    if (!res.ok && res.status !== 207) throw new Error(String(res.status));

    savedIds = (data.results ?? []).filter((r) => r.ok).map((r) => r.id);
    saved = savedIds.length;
  } catch {
    // Réseau, serveur, timeout : on ne touche pas à la file.
    return { attempted: items.length, saved: 0, remaining: items.length };
  }

  const savedSet = new Set(savedIds);
  const keep = items.filter((i) => !savedSet.has(i.id));
  write(keep);
  return { attempted: items.length, saved, remaining: keep.length };
}
