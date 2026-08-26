import { getSupabaseServerClient } from "@/lib/supabase/server";

const GENERIC_MESSAGE = "Si ce compte existe, un lien de réinitialisation vient d'être envoyé.";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { email } = (body ?? {}) as { email?: unknown };
  if (typeof email !== "string" || !email.trim()) {
    return Response.json({ error: "Adresse email requise." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  try {
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://brief.srv1899780.hstgr.cloud"}/auth/reset-password`,
    });
  } catch {
    /* réponse toujours générique — ne jamais indiquer si l'email existe */
  }

  return Response.json({ ok: true, message: GENERIC_MESSAGE });
}
