"use client";

import { PIN_HEADER, getPin } from "./pin";

/**
 * Abonnement Web Push côté navigateur.
 *
 * ⚠️ iOS ne livre les notifications qu'aux PWA AJOUTÉES À L'ÉCRAN D'ACCUEIL.
 * Dans un onglet Safari, `Notification.requestPermission()` peut réussir et
 * aucune notification n'arrivera jamais. `isStandalone()` sert à le dire à
 * l'utilisateur au lieu de le laisser attendre une notification fantôme.
 */

export type PushState =
  | { status: "unsupported"; reason: string }
  | { status: "needs-install" }
  | { status: "denied" }
  | { status: "off" }
  | { status: "on"; endpoint: string };

/**
 * La clé publique VAPID doit être passée en binaire, pas en base64url.
 *
 * Renvoie l'ArrayBuffer et non l'Uint8Array : depuis TypeScript 5.7 les vues
 * typées sont génériques sur leur buffer, et `Uint8Array<ArrayBufferLike>` n'est
 * plus assignable à `BufferSource` — le compilateur refuse, à raison, parce que
 * le buffer pourrait être partagé. L'ArrayBuffer passe sans conversion.
 */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS n'expose pas display-mode de façon fiable ; il pose ce drapeau.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function supportError(): string | null {
  if (!("serviceWorker" in navigator)) return "Service worker indisponible.";
  if (!("PushManager" in window)) return "Push indisponible dans ce navigateur.";
  if (!("Notification" in window)) return "Notifications indisponibles.";
  if (!window.isSecureContext) return "Contexte non sécurisé : HTTPS requis.";
  return null;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // `updateViaCache: "none"` : sans ça, Safari peut resservir un ancien sw.js
  // pendant 24 h et tu débogues du code qui n'est plus le tien.
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

/** Lit l'état courant sans rien demander à l'utilisateur. */
export async function readPushState(): Promise<PushState> {
  const reason = supportError();
  if (reason) return { status: "unsupported", reason };
  if (isIOS() && !isStandalone()) return { status: "needs-install" };
  if (Notification.permission === "denied") return { status: "denied" };

  try {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    return sub ? { status: "on", endpoint: sub.endpoint } : { status: "off" };
  } catch {
    return { status: "off" };
  }
}

async function postSubscription(sub: PushSubscription): Promise<void> {
  const pin = getPin();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (pin) headers.set(PIN_HEADER, pin);

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers,
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Le serveur a refusé l'abonnement (${res.status}).`);
  }
}

/** Demande la permission puis abonne. Lève un message déjà lisible en français. */
export async function enablePush(vapidPublicKey: string): Promise<PushState> {
  const reason = supportError();
  if (reason) throw new Error(reason);
  if (isIOS() && !isStandalone()) {
    throw new Error(
      "Sur iPhone, ajoute d'abord Brief à l'écran d'accueil : les notifications n'arrivent pas depuis un onglet Safari.",
    );
  }
  if (!vapidPublicKey) throw new Error("Clé VAPID publique absente côté client.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications refusées. Réactive-les dans les réglages du navigateur.");
  }

  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      // Imposé par les navigateurs : tout push reçu doit afficher quelque chose.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBuffer(vapidPublicKey),
    }));

  await postSubscription(sub);
  return { status: "on", endpoint: sub.endpoint };
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { status: "off" };

  const endpoint = sub.endpoint;
  await sub.unsubscribe();

  const pin = getPin();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (pin) headers.set(PIN_HEADER, pin);
  // Le retrait serveur est best-effort : l'abonnement est déjà mort côté
  // navigateur, et un endpoint orphelin est purgé au premier envoi (410).
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers,
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});

  return { status: "off" };
}

/** Déclenche un envoi immédiat. Renvoie le nombre d'abonnements servis. */
export async function sendTestPush(): Promise<{ sent: number; total: number }> {
  const pin = getPin();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (pin) headers.set(PIN_HEADER, pin);

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();

  const res = await fetch("/api/push/test", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Brief",
      body: "Test de notification. Si tu lis ça, la chaîne fonctionne.",
      // Envoyé explicitement : le stockage serveur n'est pas persistant sur Vercel.
      subscription: sub?.toJSON() ?? undefined,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    sent?: number;
    total?: number;
    error?: string;
  };
  if (!res.ok && res.status !== 207) {
    throw new Error(data.error || `L'envoi a échoué (${res.status}).`);
  }
  return { sent: data.sent ?? 0, total: data.total ?? 0 };
}
