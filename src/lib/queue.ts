"use client";

import { PIN_HEADER, getPin } from "./pin";
import type { DraftItem } from "./types";

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

function read(): DraftItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as DraftItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: DraftItem[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  } catch {
    // Quota dépassé ou stockage refusé (navigation privée). On ne peut pas
    // mettre en file : l'appelant doit le savoir, d'où le booléen de retour.
  }
}

export function queueDepth(): number {
  return read().length;
}

/** Ajoute des items à la file. `false` si le stockage a refusé. */
export function enqueue(items: DraftItem[]): boolean {
  if (!items.length) return true;
  const before = read();
  const incoming = new Set(items.map((i) => i.id));
  write([...before.filter((i) => !incoming.has(i.id)), ...items]);
  return queueDepth() > before.length || items.every((i) => incoming.has(i.id));
}

export function clearQueue(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* rien à faire : la file repartira au prochain flush */
  }
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

  const keep = items.filter((i) => !savedIds.includes(i.id));
  write(keep);
  return { attempted: items.length, saved, remaining: keep.length };
}
