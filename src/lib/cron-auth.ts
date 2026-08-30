import "server-only";

/**
 * Garde des routes déclenchées par une machine.
 *
 * Le cron et le raccourci iOS ne peuvent pas s'authentifier comme un humain
 * (pas de navigation vers /auth/login) : ils portent un secret dédié, passé
 * en Bearer. C'est délibérément un secret DIFFÉRENT de la session Supabase
 * Auth — un secret stocké en clair dans un raccourci iOS ou une crontab ne
 * doit pas ouvrir la même porte que la session utilisateur, et doit pouvoir
 * être révoqué seul sans invalider les sessions en cours.
 */

/**
 * Un appelant machine s'est-il présenté ? (Bearer, `x-brief-token`, ou
 * `?token=` quand la route l'autorise.)
 *
 * Sert aux routes à garde MIXTE — session utilisateur OU jeton machine, voir
 * `requireSessionOrMachineToken` dans `guard.ts`. Sans ce test, on ne saurait
 * pas quelle erreur renvoyer : « session invalide ou expirée » sur un jeton
 * machine erroné enverrait l'agent chercher un problème de cookie qui n'existe
 * pas. On regarde la PRÉSENCE d'une pièce d'identité machine, jamais sa
 * validité — c'est `requireMachineToken` qui tranche.
 */
export function hasMachineCredential(
  req: Request,
  opts?: { allowQueryToken?: boolean },
): boolean {
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ") && header.length > 7) return true;
  if (req.headers.get("x-brief-token")) return true;
  if (opts?.allowQueryToken && new URL(req.url).searchParams.get("token")) return true;
  return false;
}

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
