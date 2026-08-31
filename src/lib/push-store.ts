import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isRecord, type PushSubscriptionRecord } from "./push-subscription";

/**
 * Stockage des abonnements push — ⚠️ MODULE EN SURSIS.
 *
 * Le 2026-08-31, le pivot multi-utilisateur a déplacé ce stockage dans
 * `store.ts`, sous le répertoire d'UN compte. Ce fichier ne subsiste que le
 * temps de porter ses appelants ; il lit encore le fichier GLOBAL, partagé par
 * tous les comptes. Il est supprimé à la tâche 8 du plan
 * `docs/superpowers/plans/2026-08-31-multi-user-lot1-cloisonnement.md`.
 *
 * La partie pure (`parseSubscription`, `PushSubscriptionRecord`) vit désormais
 * dans `push-subscription.ts` et est ré-exportée ici pour ne pas casser les
 * appelants pendant la transition.
 */

export { parseSubscription, type PushSubscriptionRecord } from "./push-subscription";

const DATA_DIR = process.env.BRIEF_DATA_DIR || join(process.cwd(), ".data");
const FILE = join(DATA_DIR, "push-subscriptions.json");

export async function readSubscriptions(): Promise<PushSubscriptionRecord[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord);
  } catch {
    // Fichier absent, illisible ou JSON cassé : aucun abonnement connu. Pas
    // d'exception — l'absence d'abonnement est un état normal, pas une panne.
    return [];
  }
}

async function writeAll(list: PushSubscriptionRecord[]): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

/** Enregistre ou remplace l'abonnement identifié par son endpoint. */
export async function saveSubscription(
  sub: Omit<PushSubscriptionRecord, "createdAt">,
): Promise<void> {
  const list = await readSubscriptions();
  const next = list.filter((s) => s.endpoint !== sub.endpoint);
  next.push({ ...sub, createdAt: new Date().toISOString() });
  await writeAll(next);
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const list = await readSubscriptions();
  await writeAll(list.filter((s) => s.endpoint !== endpoint));
}
