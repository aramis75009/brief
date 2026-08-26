import "server-only";
import { getSupabaseServerClient } from "./supabase/server";

/**
 * Garde d'accès SERVEUR pour toutes les routes /api/*.
 *
 * Remplace requirePin() (PIN partagé unique) : vérifie une session Supabase
 * Auth. getClaims() valide le JWT localement (clé publique du projet, ES256)
 * — pas d'appel réseau à Supabase à chaque requête ; le rafraîchissement du
 * jeton, quand il est nécessaire, est géré par src/proxy.ts avant que la
 * route ne s'exécute.
 *
 * Toute nouvelle route sous /api/ DOIT commencer par :
 *   const denied = await requireSession();
 *   if (denied) return denied;
 */
export async function requireSession(): Promise<Response | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return Response.json({ error: "Session invalide ou expirée." }, { status: 401 });
  }

  return null;
}
