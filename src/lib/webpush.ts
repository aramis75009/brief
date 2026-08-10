import "server-only";
import webpush from "web-push";
import { removeSubscription, type PushSubscriptionRecord } from "./push-store";

/**
 * Envoi Web Push — le chemin critique de la notification.
 *
 * C'est ce module qui remplace CalDAV : un serveur allumé décide de la seconde
 * exacte où la notification part, au lieu de dépendre du rythme de
 * synchronisation d'iOS (15 min minimum pour un compte CalDAV tiers).
 */

export type PushPayload = {
  title: string;
  body?: string;
  /** Deux notifications de même `tag` se remplacent au lieu de s'empiler. */
  tag?: string;
  url?: string;
  id?: string;
};

export type SendOutcome =
  | { ok: true; endpoint: string }
  | { ok: false; endpoint: string; status: number | null; error: string; gone: boolean };

let configured = false;

/**
 * Configure VAPID à la première utilisation. Lève si les clés manquent : une
 * notification qui ne part pas doit être une erreur bruyante, jamais un silence.
 */
function configure(): void {
  if (configured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:aramis.begnene@gmail.com";

  if (!publicKey || !privateKey) {
    throw new Error(
      "Clés VAPID absentes : NEXT_PUBLIC_VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY sont requises.",
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/**
 * Envoie à un abonnement. Ne lève pas : renvoie l'issue pour que l'appelant
 * décide. Un abonnement périmé (404/410) est purgé du stockage — iOS révoque
 * les abonnements, notamment après réinstallation de la PWA, et un abonnement
 * mort qu'on garde fait échouer tous les envois suivants en silence.
 */
export async function sendPush(
  sub: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<SendOutcome> {
  configure();

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
      // TTL : au-delà, le service de push abandonne au lieu de livrer un rappel
      // périmé. Une heure — une notification de rappel n'a plus d'intérêt après.
      { TTL: 3600 },
    );
    return { ok: true, endpoint: sub.endpoint };
  } catch (e) {
    const status =
      typeof e === "object" && e !== null && "statusCode" in e
        ? (e as { statusCode: number }).statusCode
        : null;
    const gone = status === 404 || status === 410;

    if (gone) {
      await removeSubscription(sub.endpoint).catch(() => {
        /* purge best-effort : ne doit pas masquer l'erreur d'envoi */
      });
    }

    return {
      ok: false,
      endpoint: sub.endpoint,
      status,
      error: e instanceof Error ? e.message : "Échec d'envoi inconnu.",
      gone,
    };
  }
}

/** Envoie à plusieurs abonnements. Un échec n'interrompt pas les autres. */
export async function sendPushToAll(
  subs: PushSubscriptionRecord[],
  payload: PushPayload,
): Promise<SendOutcome[]> {
  return Promise.all(subs.map((s) => sendPush(s, payload)));
}
