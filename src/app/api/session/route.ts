import { requirePin } from "@/lib/guard";

/**
 * Valide un PIN et pose le cookie persistant CÔTÉ SERVEUR.
 *
 * Pourquoi côté serveur (correctif 2026-08-18) : sur iOS, les cookies posés
 * par JavaScript (`document.cookie`) dans une PWA standalone peuvent être
 * purgés à la fermeture de l'app — l'écran PIN réapparaissait à chaque
 * relance. Un cookie posé par `Set-Cookie` HTTP persiste, lui. Le client
 * continue d'écrire localStorage + cookie JS (migration, fallback), mais le
 * cookie serveur est la source fiable : posé à chaque vérification réussie,
 * il survit aux fermetures et aux purges du stockage local.
 *
 * Le PIN reste en clair dans le cookie : c'est de l'UX, pas une barrière de
 * sécurité (la seule barrière reste `requirePin` sur chaque route /api/*).
 */

const COOKIE_KEY = "brief_pin";
/** ~13 mois, renouvelé à chaque vérification — bien au-delà des purges iOS. */
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export async function POST(req: Request) {
  const denied = requirePin(req);
  if (denied) return denied;

  const pin = process.env.BRIEF_PIN;
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    `${COOKIE_KEY}=${encodeURIComponent(pin ?? "")}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`,
  );

  return Response.json({ ok: true }, { headers });
}
