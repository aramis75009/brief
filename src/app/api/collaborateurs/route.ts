import { listCollaboratorRows } from "@/lib/collaborators";
import { requireStore } from "@/lib/guard";

/**
 * Les collaborateurs assignables — comptes autorisés, hors soi-même.
 *
 * Garde `requireStore()` (pas juste `requireSession()`) par cohérence : on
 * n'écrit rien, mais cette liste n'a de sens que pour un compte qui utilise
 * l'app, et la garde rend l'identité (`sub`) dont `listCollaboratorRows` a
 * besoin pour s'exclure de la liste.
 */
export async function GET(): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { userId } = session;

  const rows = await listCollaboratorRows(userId);
  return Response.json({
    collaborators: rows.map((r) => ({
      userId: r.userId,
      displayName: r.displayName || r.userId.slice(0, 8),
    })),
  });
}