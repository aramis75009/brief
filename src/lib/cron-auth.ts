import "server-only";

/**
 * Garde des routes déclenchées par une machine.
 *
 * Le cron et le raccourci iOS ne peuvent pas saisir le PIN de l'app : ils
 * portent un secret dédié. C'est délibérément un secret DIFFÉRENT de
 * `BRIEF_PIN` — un secret stocké en clair dans un raccourci iOS ou dans une
 * crontab ne doit pas ouvrir la même porte que le code que tu tapes.
 * Le révoquer n'oblige alors pas à changer le code de l'app.
 */

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** `null` si autorisé, une Response sinon. */
export function requireMachineToken(
  req: Request,
  envName: string,
  opts?: { allowQueryToken?: boolean },
): Response | null {
  const expected = process.env[envName];

  // Pas de secret configuré = porte fermée, jamais ouverte par défaut.
  if (!expected) {
    return Response.json(
      { error: `${envName} n'est pas configuré côté serveur.` },
      { status: 503 },
    );
  }

  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const provided = bearer || req.headers.get("x-brief-token") || "";

  // Un appelant qui ne peut pas poser de header (ex. claude.ai, qui ne fait
  // que des GET sur une URL) passe le jeton en query param `?token=`.
  // ⚠️ OPT-IN par route : seules les routes de LECTURE machine (digest)
  // l'activent. Le PIN n'est JAMAIS accepté en query (clé maîtresse), et
  // aucune route d'écriture (capture, items) n'accepte le query token.
  // Le query token n'est consulté QUE si aucun header n'est fourni : un
  // header valide ne doit pas être invalidé par un paramètre parasite.
  if (opts?.allowQueryToken && !provided) {
    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token") ?? "";
    if (queryToken) {
      if (!safeEqual(queryToken, expected)) {
        return Response.json({ error: "Jeton invalide." }, { status: 401 });
      }
      return null;
    }
  }

  if (!provided || !safeEqual(provided, expected)) {
    return Response.json({ error: "Jeton invalide." }, { status: 401 });
  }
  return null;
}
