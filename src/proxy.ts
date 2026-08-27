import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase à chaque requête, AVANT que la route ne
 * s'exécute — sans ça, un jeton d'accès expiré ferait échouer requireSession()
 * une fois par heure au lieu d'être renouvelé silencieusement en arrière-plan.
 *
 * Ne remplace PAS requireSession() : chaque route reste responsable de sa
 * propre vérification. La doc Next.js sur le proxy le dit explicitement — un
 * changement de matcher ne doit jamais devenir un trou de sécurité silencieux.
 *
 * ⚠️ Ce fichier ne doit JAMAIS lever. Son matcher couvre presque toutes les
 * requêtes : une exception ici ne dégrade pas une route, elle éteint le site
 * entier, écran de connexion compris. D'où les deux garde-fous ci-dessous —
 * variables absentes et appel réseau en échec renvoient la requête telle
 * quelle. Le rafraîchissement n'a alors pas lieu, ce qui est sans danger : la
 * garde de chaque route (`requireSession()`) reste l'autorité et refusera une
 * session invalide.
 */
/** Le matcher couvre tout : sans ce drapeau, le diagnostic noierait le journal. */
let missingEnvLogged = false;

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    // Même diagnostic que `getSupabaseServerClient()`, mais sans lever : ces
    // variables sont inlinées AU BUILD (voir Dockerfile), et leur absence est
    // une erreur de déploiement, pas une raison de couper le trafic.
    if (!missingEnvLogged) {
      missingEnvLogged = true;
      console.error(
        "[proxy] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquantes : session non rafraîchie.",
      );
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  try {
    // Échange du code de récupération (lien « mot de passe oublié ») contre
    // une session, AVANT getClaims : sans cet échange, la page
    // /auth/reset-password n'aurait aucune session et updateUser échouerait.
    // Le code ne vaut qu'une fois : on le retire de l'URL après échange.
    const code = request.nextUrl.searchParams.get("code");
    if (request.nextUrl.pathname === "/auth/reset-password" && code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const url = request.nextUrl.clone();
        url.searchParams.delete("code");
        url.searchParams.delete("next");
        const redirect = NextResponse.redirect(url);
        // Reporte les cookies de session posés par l'échange (via setAll →
        // `response`) sur la réponse de redirection (règle de la doc
        // Supabase : copier les cookies quand on construit une nouvelle
        // réponse au lieu de renvoyer la réponse du client).
        response.cookies.getAll().forEach((c) =>
          redirect.cookies.set(c.name, c.value, c),
        );
        return redirect;
      }
      // Code invalide ou expiré : on laisse la page s'afficher, elle
      // détectera l'absence de session et invitera à relancer le flux.
    }
    await supabase.auth.getClaims();
  } catch (e) {
    // Supabase injoignable, jeton illisible : le rafraîchissement n'a pas eu
    // lieu ce passage-ci, la requête continue.
    console.error("[proxy] rafraîchissement de session impossible :", e);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
