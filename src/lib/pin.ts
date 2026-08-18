/**
 * PIN côté client — mémorisé par appareil dans localStorage ET un cookie
 * persistant (double écriture).
 *
 * ⚠️ Ce module ne protège RIEN par lui-même : c'est de l'UX. La seule barrière
 * réelle est la vérification serveur dans src/lib/guard.ts, que toute route
 * /api/* doit appeler. Ne jamais considérer ce fichier comme un contrôle d'accès.
 *
 * Depuis le 2026-08-17, la mémorisation est permanente : le code est saisi
 * UNE fois par appareil (première ouverture), puis Brief s'ouvre directement.
 * L'écran PIN ne réapparaît que sur un appareil jamais associé, ou après un
 * « Verrouiller » explicite, ou si le code serveur a changé (401).
 *
 * Pourquoi un cookie en plus du localStorage (correctif 2026-08-18) : iOS
 * purge le stockage des PWA inutilisées — le localStorage peut disparaître et
 * l'écran PIN réapparaître sans raison. Le cookie persistant (même domaine,
 * ~13 mois) survit à cette purge et est partagé entre la PWA et Safari, qui
 * ont des localStorage séparés. Le PIN reste en clair, comme dans le
 * localStorage : c'est de l'UX, pas une barrière de sécurité.
 */

const KEY = "brief:pin";
const COOKIE_KEY = "brief_pin";
/** ~13 mois, renouvelé à chaque setPin — bien au-delà des purges iOS. */
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
export const PIN_HEADER = "x-brief-pin";

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_KEY}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function writeCookie(pin: string): void {
  if (typeof document === "undefined") return;
  try {
    // `Secure` seulement en HTTPS : en dev local (http://localhost) un cookie
    // Secure ne serait pas posé.
    const secure =
      typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(pin)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* stockage indisponible */
  }
}

function clearCookie(): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    /* idem */
  }
}

export function getPin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromCookie = readCookie();
    if (fromCookie) return fromCookie;
    const fromStorage = window.localStorage.getItem(KEY);
    if (fromStorage) {
      // Migration : le PIN n'était que dans localStorage (purgeable par iOS) →
      // on le remonte dans le cookie pour qu'il survive aux purges suivantes.
      writeCookie(fromStorage);
      return fromStorage;
    }
    return null;
  } catch {
    return null;
  }
}

export function setPin(pin: string): void {
  try {
    window.localStorage.setItem(KEY, pin);
  } catch {
    /* Safari en navigation privée peut refuser l'écriture — on continue en mémoire. */
  }
  writeCookie(pin);
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
    window.localStorage.removeItem(KEY);
  } catch {
    /* idem */
  }
  clearCookie();
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
