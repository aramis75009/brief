import "server-only";
import { hasMachineCredential, requireMachineToken } from "./cron-auth";
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
