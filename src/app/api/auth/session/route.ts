import { readSessionClaims } from "@/lib/guard";

/**
 * Qui est connecté.
 *
 * L'adresse sert au bloc « Compte » des Réglages : l'afficher, et l'envoyer à
 * `/api/auth/forgot-password` pour « Changer le mot de passe ». Elle vient des
 * claims du JWT déjà vérifié — jamais d'un champ que le client aurait posé
 * lui-même, sinon n'importe qui demanderait la réinitialisation d'un autre
 * compte depuis une session valide.
 */
export async function GET(): Promise<Response> {
  const claims = await readSessionClaims();
  if (!claims) {
    return Response.json({ error: "Session invalide ou expirée." }, { status: 401 });
  }

  const email = typeof claims.email === "string" ? claims.email : null;
  return Response.json({ authenticated: true, email });
}
