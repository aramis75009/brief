import "server-only";

/**
 * Garde d'accès SERVEUR pour toutes les routes /api/*.
 *
 * L'URL de déploiement est publique : sans ce contrôle, n'importe qui peut
 * appeler /api/transcribe et consommer la clé Groq. Toute nouvelle route sous
 * /api/ DOIT commencer par `const denied = requirePin(req); if (denied) return denied;`
 */

const PIN_HEADER = "x-brief-pin";

/** Comparaison à temps constant — évite de fuiter le PIN caractère par caractère. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Renvoie une Response 401 si la requête n'est pas autorisée, `null` si elle l'est.
 */
export function requirePin(req: Request): Response | null {
  const expected = process.env.BRIEF_PIN;

  // Pas de PIN configuré côté serveur = pas d'ouverture silencieuse.
  if (!expected) {
    return Response.json(
      { error: "BRIEF_PIN n'est pas configuré côté serveur." },
      { status: 503 },
    );
  }

  const provided = req.headers.get(PIN_HEADER);
  if (!provided || !safeEqual(provided, expected)) {
    return Response.json({ error: "PIN invalide." }, { status: 401 });
  }

  return null;
}
