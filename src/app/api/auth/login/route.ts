import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return Response.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user) {
    return Response.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  }

  const { data: allowed } = await supabase
    .from("authorized_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!allowed) {
    await supabase.auth.signOut();
    return Response.json({ error: "Compte non autorisé." }, { status: 403 });
  }

  await supabase
    .from("authorized_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("user_id", data.user.id);

  return Response.json({ ok: true });
}
