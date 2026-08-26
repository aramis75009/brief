import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/reset-password
 *
 * Termine le flux « mot de passe oublié » : l'utilisateur arrive sur
 * /auth/reset-password avec un code de récupération Supabase (dans l'URL du
 * lien reçu par email, `?code=…`), le proxy a échangé ce code contre une
 * session, et cette route pose le nouveau mot de passe via `updateUser`.
 *
 * ⚠️ La session de récupération est éphémère : le code ne vaut qu'une fois
 * et expire. Un utilisateur qui ouvre la page sans code (ou avec un code
 * expiré) reçoit 401 — l'UI le renvoie vers « Mot de passe oublié ».
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { password } = (body ?? {}) as { password?: unknown };
  if (typeof password !== "string" || password.length < 8) {
    return Response.json(
      { error: "Le mot de passe doit contenir au moins 8 caractères." },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return Response.json(
      { error: "Impossible de réinitialiser le mot de passe. Le lien a peut-être expiré." },
      { status: 401 },
    );
  }

  return Response.json({ ok: true });
}
