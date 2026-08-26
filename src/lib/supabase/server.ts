import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Un seul facteur de client Supabase côté serveur, partagé par requireSession()
 * et les routes /api/auth/*. setAll() écrit les cookies quand c'est possible
 * (Route Handler) et ne fait rien silencieusement sinon (Server Component en
 * lecture seule) — src/proxy.ts rafraîchit la session sur chaque requête, donc
 * l'écriture ici est une optimisation, jamais une nécessité.
 */
export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquantes côté serveur.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* contexte lecture-seule — proxy.ts gère le rafraîchissement */
        }
      },
    },
  });
}
