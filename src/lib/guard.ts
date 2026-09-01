import "server-only";
import { hasMachineCredential, requireMachineToken } from "./cron-auth";
import { storeForUser, USER_ID_PATTERN, type Store } from "./store";
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
/**
 * Les claims du JWT de la session, ou `null` s'il n'y en a pas de valide.
 *
 * Sert quand la route a besoin de SAVOIR QUI est connecté et pas seulement
 * QUE quelqu'un l'est — l'écran Réglages affiche l'adresse du compte, et
 * « Changer le mot de passe » l'envoie à Supabase. Aucun appel réseau : le JWT
 * est vérifié localement (clé publique ES256), comme pour `requireSession`.
 */
export async function readSessionClaims(): Promise<Record<string, unknown> | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return data.claims as unknown as Record<string, unknown>;
}

export async function requireSession(): Promise<Response | null> {
  if (!(await readSessionClaims())) {
    return Response.json({ error: "Session invalide ou expirée." }, { status: 401 });
  }
  return null;
}

/**
 * Garde MIXTE : session utilisateur **OU** jeton machine de lecture.
 *
 * Réservée aux routes de LECTURE qu'un agent doit pouvoir interroger sans
 * navigateur (`GET /api/agenda`, décision Aramis du 2026-08-30) et que l'app
 * appelle par ailleurs avec la session de l'utilisateur. Les deux appelants
 * existent vraiment : `/api/agenda` est la source unique de l'accueil, de
 * l'onglet Agenda et du calendrier desktop (`fetchAgendaDay`) — la basculer
 * sur le seul jeton machine éteindrait ces trois écrans sans que rien ne le
 * signale côté serveur.
 *
 * ⚠️ **Lecture seule.** Ne jamais poser cette garde sur une route qui écrit :
 * un secret déposé dans une crontab ou un raccourci iOS ne doit pas ouvrir la
 * porte de l'écriture. Les routes d'écriture gardent `requireSession()` seul,
 * ou un jeton machine dédié à l'écriture (`/api/capture`).
 *
 * L'ordre n'est pas un détail : on regarde d'abord si une pièce d'identité
 * machine est PRÉSENTE. Un jeton machine faux répond alors « Jeton invalide »
 * (401) plutôt que « session expirée », qui enverrait l'agent chercher un
 * problème de cookie. Un navigateur, lui, ne pose ni Bearer ni `?token=` :
 * il tombe toujours sur `requireSession()`.
 */
export async function requireSessionOrMachineToken(
  req: Request,
  envName: string,
  opts?: { allowQueryToken?: boolean },
): Promise<Response | null> {
  if (hasMachineCredential(req, opts)) return requireMachineToken(req, envName, opts);
  return requireSession();
}

/* ---------------------------------------------------------------------------
 * Cloisonnement par compte (pivot multi-utilisateur du 2026-08-31)
 * ------------------------------------------------------------------------- */

/**
 * L'identifiant du compte connecté (`sub` du JWT), ou `null`.
 *
 * Le format est validé ICI plutôt qu'au moment de construire le chemin de
 * fichier : une session dont le `sub` est inexploitable doit être refusée à la
 * porte avec un 401 lisible, pas provoquer une exception au fond du store —
 * qui remonterait en 500 et enverrait chercher une panne de disque.
 */
export async function sessionUserId(): Promise<string | null> {
  const claims = await readSessionClaims();
  const sub = claims?.sub;
  if (typeof sub !== "string" || !USER_ID_PATTERN.test(sub)) return null;
  return sub;
}

/**
 * Garde de session ET résolution du store, en un seul appel.
 *
 * C'est la porte unique du cloisonnement : elle remplace le couple
 * `requireSession()` + résolution d'identité, ce qui rend impossible d'avoir
 * l'un sans l'autre, et impossible de se tromper de compte à l'intérieur d'une
 * route.
 *
 * Toute route sous /api/ QUI TOUCHE AU STORE doit commencer par :
 *   const session = await requireStore();
 *   if (session instanceof Response) return session;
 *   const { store } = session;
 *
 * Seule `transcribe` garde `requireSession()` seul : elle ne fait que relayer
 * un flux vers Groq sans rien écrire. `audio`, elle, TOUCHE au disque du
 * compte — elle est passée à `requireStore()` le 2026-08-31, parce qu'un
 * répertoire audio global laissait n'importe quel compte autorisé servir la
 * dictée d'un autre.
 *
 * ⚠️ Une route ne doit JAMAIS appeler `storeForUser` elle-même — elle
 * choisirait alors le compte qu'elle lit. `no-direct-store-access.test.ts`
 * fige cette règle.
 */
export async function requireStore(): Promise<{ userId: string; store: Store } | Response> {
  const userId = await sessionUserId();
  if (!userId) {
    return Response.json({ error: "Session invalide ou expirée." }, { status: 401 });
  }
  return { userId, store: storeForUser(userId) };
}

/**
 * Le store du compte propriétaire (`BRIEF_OWNER_USER_ID`).
 *
 * ⚠️ TRANSITOIRE — lot 1 du pivot seulement. Les jetons machine `capture` et
 * `digest` ne portent aucune identité : ils écrivent chez le propriétaire. Le
 * lot 2 les remplace par des jetons par compte (table `machine_tokens`) et
 * supprime cette fonction.
 *
 * Renvoie 503 plutôt qu'un store au hasard si la variable manque ou n'est pas
 * un UUID : une capture vocale qui atterrit dans le mauvais Brief ne se voit
 * pas, alors qu'un 503 se lit dans le journal du cron.
 */
export function ownerStore(): Store | Response {
  const userId = process.env.BRIEF_OWNER_USER_ID;
  if (!userId || !USER_ID_PATTERN.test(userId)) {
    return Response.json(
      { error: "BRIEF_OWNER_USER_ID n'est pas configuré côté serveur." },
      { status: 503 },
    );
  }
  return storeForUser(userId);
}

/**
 * Garde MIXTE rendant un store : session utilisateur **OU** jeton machine de
 * LECTURE. Même contrat que `requireSessionOrMachineToken` — dont elle reprend
 * l'ordre d'évaluation et ses raisons — mais elle rend le couple
 * `{ userId, store }` au lieu de `null`.
 *
 * ⚠️ **Lecture seule**, comme sa sœur : ne jamais la poser sur une route qui
 * écrit.
 *
 * Pendant le lot 1, un appelant machine reçoit le store du PROPRIÉTAIRE : le
 * jeton ne porte pas encore d'identité. Le lot 2 le remplacera par le compte
 * que le jeton désigne, et seul le corps de cette fonction changera.
 */
export async function requireStoreOrMachineToken(
  req: Request,
  envName: string,
  opts?: { allowQueryToken?: boolean },
): Promise<{ userId: string; store: Store } | Response> {
  if (hasMachineCredential(req, opts)) {
    const denied = requireMachineToken(req, envName, opts);
    if (denied) return denied;
    const store = ownerStore();
    if (store instanceof Response) return store;
    return { userId: process.env.BRIEF_OWNER_USER_ID as string, store };
  }
  return requireStore();
}
