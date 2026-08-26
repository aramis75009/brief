import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(): Promise<Response> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  return Response.json({ ok: true });
}
