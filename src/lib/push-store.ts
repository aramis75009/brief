import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Stockage des abonnements push.
 *
 * ⚠️ ÉTAT TRANSITOIRE. Un fichier JSON, pas une base. Ça tient parce que Brief
 * a exactement un utilisateur et que la cible est un VPS avec un disque
 * persistant. Ce module disparaît quand Postgres arrive (tâche T3) : garder
 * l'API `readSubscriptions` / `saveSubscription` / `removeSubscription`
 * inchangée pour que la bascule ne touche que ce fichier.
 *
 * ⚠️ SUR VERCEL, CE STOCKAGE NE SURVIT PAS. Le système de fichiers d'une
 * fonction est éphémère et en lecture seule hors /tmp. Un abonnement enregistré
 * peut avoir disparu à l'appel suivant. C'est pourquoi /api/push/test accepte
 * un abonnement explicite dans le corps : le pic S1 doit pouvoir tourner avant
 * que le VPS existe.
 */

export type PushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** ISO 8601. Sert à repérer les abonnements anciens, qu'iOS peut avoir périmés. */
  createdAt: string;
  userAgent?: string;
};

const DATA_DIR = process.env.BRIEF_DATA_DIR || join(process.cwd(), ".data");
const FILE = join(DATA_DIR, "push-subscriptions.json");

function isRecord(value: unknown): value is PushSubscriptionRecord {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const keys = v.keys as Record<string, unknown> | undefined;
  return (
    typeof v.endpoint === "string" &&
    v.endpoint.length > 0 &&
    typeof keys === "object" &&
    keys !== null &&
    typeof keys.p256dh === "string" &&
    typeof keys.auth === "string"
  );
}

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

/** Longueur en octets d'une chaîne base64url, sans la décoder réellement. */
function base64urlByteLength(value: string): number {
  try {
    return Buffer.from(value, "base64url").length;
  } catch {
    return -1;
  }
}

/**
 * Parse un abonnement venu du navigateur. Renvoie un motif de rejet plutôt que
 * `null` : sans lui, une clé malformée ne se manifeste qu'au moment de l'envoi,
 * c'est-à-dire des heures plus tard, quand un rappel ne sonne pas. La règle du
 * projet est de faire échouer là où l'utilisateur peut encore agir.
 *
 * Tailles imposées par le chiffrement Web Push (RFC 8291) : la clé publique
 * P-256 non compressée fait 65 octets, le secret d'authentification 16.
 */
export function parseSubscription(
  input: unknown,
): { ok: true; sub: PushSubscriptionRecord } | { ok: false; reason: string } {
  if (typeof input !== "object" || input === null) {
    return { ok: false, reason: "Abonnement absent ou illisible." };
  }
  const v = input as Record<string, unknown>;
  const keys = v.keys as Record<string, unknown> | undefined;

  if (typeof v.endpoint !== "string" || !v.endpoint) {
    return { ok: false, reason: "`endpoint` est requis." };
  }
  if (!/^https:\/\//.test(v.endpoint)) {
    return { ok: false, reason: "`endpoint` doit être une URL https." };
  }
  if (typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
    return { ok: false, reason: "`keys.p256dh` et `keys.auth` sont requis." };
  }
  if (base64urlByteLength(keys.p256dh) !== 65) {
    return { ok: false, reason: "`keys.p256dh` doit faire 65 octets une fois décodée." };
  }
  if (base64urlByteLength(keys.auth) !== 16) {
    return { ok: false, reason: "`keys.auth` doit faire 16 octets une fois décodée." };
  }

  return {
    ok: true,
    sub: {
      endpoint: v.endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      createdAt: new Date().toISOString(),
    },
  };
}
