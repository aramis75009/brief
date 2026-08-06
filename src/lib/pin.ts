/**
 * PIN côté client — stocké en sessionStorage (vidé à la fermeture de l'onglet).
 *
 * ⚠️ Ce module ne protège RIEN par lui-même : c'est de l'UX. La seule barrière
 * réelle est la vérification serveur dans src/lib/guard.ts, que toute route
 * /api/* doit appeler. Ne jamais considérer ce fichier comme un contrôle d'accès.
 */

const KEY = "brief:pin";
export const PIN_HEADER = "x-brief-pin";

export function getPin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setPin(pin: string): void {
  try {
    window.sessionStorage.setItem(KEY, pin);
  } catch {
    /* Safari en navigation privée peut refuser l'écriture — on continue en mémoire. */
  }
}

/**
 * Lecture de la transcription persistée. Appelée pendant le rendu (initialiseur
 * de useState) : doit rester sûre côté serveur.
 */
export function readStoredTranscript(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem("brief:transcript") ?? "";
  } catch {
    return "";
  }
}

export function clearPin(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* idem */
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("PIN refusé");
    this.name = "UnauthorizedError";
  }
}

/**
 * fetch vers /api/* avec le header PIN. Lève UnauthorizedError sur 401 pour que
 * l'appelant puisse re-demander le PIN plutôt que d'afficher une erreur générique.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const pin = getPin();
  const headers = new Headers(init.headers);
  if (pin) headers.set(PIN_HEADER, pin);

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    clearPin();
    throw new UnauthorizedError();
  }
  return res;
}

/** Vérifie un PIN auprès du serveur avant de le stocker. */
export async function verifyPin(pin: string): Promise<boolean> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { [PIN_HEADER]: pin },
  });
  return res.ok;
}
