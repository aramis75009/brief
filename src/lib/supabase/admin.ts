import "server-only";
import { createClient } from "@supabase/supabase-js";
import { USER_ID_PATTERN } from "../store";

/**
 * Accès Supabase avec la clé SERVICE-ROLE — celle qui contourne RLS.
 *
 * ⚠️ C'EST LA CLÉ LA PLUS PUISSANTE DU PROJET. Elle n'existe que dans ce
 * fichier, et ce fichier n'exporte PAS le client : seulement les quelques
 * fonctions métier qui en ont besoin, chacune filtrant explicitement sur un
 * `user_id`. Le filet RLS n'existe pas sur ce chemin — la discipline le
 * remplace, et une surface réduite est ce qui rend cette discipline tenable.
 *
 * POURQUOI ELLE EST NÉCESSAIRE : les crons n'ont aucune session. `requireStore()`
 * résout le compte depuis un JWT ; un passage de `/api/cron/reminders` n'en a
 * pas, et doit pourtant savoir quels comptes existent. Le client habituel
 * (`supabase/server.ts`, clé publishable + cookies) ne peut pas le dire : RLS
 * ne lui montrerait que la ligne de l'utilisateur connecté, et il n'y en a pas.
 *
 * Ce module ne sert JAMAIS une requête de navigateur.
 */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SECRET_KEY (ou NEXT_PUBLIC_SUPABASE_URL) manquante : les crons ne peuvent pas lister les comptes.",
    );
  }
  // Pas de session à persister ni à rafraîchir : ce client ne représente
  // personne, il porte un secret de service.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Les comptes autorisés — la source unique de l'itération des crons.
 *
 * ⚠️ Les identifiants sont refiltrés contre `USER_ID_PATTERN` avant d'être
 * rendus. Ils vont servir à construire des chemins de fichiers : une ligne
 * aberrante en base ne doit pas atteindre le système de fichiers, et
 * `storeForUser` lèverait alors au milieu d'un passage de cron, interrompant
 * les comptes suivants.
 */
export async function listAuthorizedUserIds(): Promise<string[]> {
  const { data, error } = await adminClient().from("authorized_users").select("user_id");
  if (error) {
    throw new Error(`Lecture de authorized_users impossible : ${error.message}`);
  }
  return (data ?? [])
    .map((row) => (row as { user_id: unknown }).user_id)
    .filter((id): id is string => typeof id === "string" && USER_ID_PATTERN.test(id));
}
