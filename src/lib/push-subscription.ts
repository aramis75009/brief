/**
 * Abonnements Web Push — la partie PURE : forme, validation, rien d'autre.
 *
 * Séparée du stockage le 2026-08-31 (pivot multi-utilisateur) : le stockage
 * est passé dans `store.ts`, qui écrit sous le répertoire d'UN compte. Ce
 * module ne touche ni au disque ni au réseau, donc il se teste sans fixture et
 * s'importe depuis n'importe où.
 */

export type PushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** ISO 8601. Sert à repérer les abonnements anciens, qu'iOS peut avoir périmés. */
  createdAt: string;
  userAgent?: string;
};

/** Garde de forme d'une ligne lue sur le disque. */
export function isRecord(value: unknown): value is PushSubscriptionRecord {
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
