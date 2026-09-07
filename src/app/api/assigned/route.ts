import { completeAssigned, itemsAssignedTo } from "@/lib/collaborators";
import { requireStore } from "@/lib/guard";

/**
 * Tâches assignées au compte connecté — le « on m'a confié quoi ? ».
 *
 * GET  rend les items des autres comptes où `assigneeId` = moi, enrichis de
 *      `ownerUserId`. Rien n'est écrit ici.
 * POST coche/décoche une tâche partagée : `{ ownerId, id, done }`. C'est le
 *      SEUL chemin d'écriture d'un assigné : l'édition libre, la suppression
 *      et l'assignation restent chez le propriétaire. La route relit l'item
 *      chez le propriétaire et exige l'assignation avant d'écrire — le
 *      `ownerId` du client n'est jamais cru sur parole.
 */
export async function GET(): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { userId } = session;

  const items = await itemsAssignedTo(userId);
  return Response.json({ items });
}

export async function POST(req: Request): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { userId } = session;

  let body: { ownerId?: unknown; id?: unknown; done?: unknown };
  try {
    body = (await req.json()) as { ownerId?: unknown; id?: unknown; done?: unknown };
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const ownerId = typeof body.ownerId === "string" ? body.ownerId.trim() : "";
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!ownerId || !id) {
    return Response.json({ error: "Propriétaire ou identifiant manquant." }, { status: 400 });
  }
  if (typeof body.done !== "boolean") {
    return Response.json({ error: "`done` doit être un booléen." }, { status: 400 });
  }

  const result = await completeAssigned(userId, ownerId, id, body.done);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ item: result.item });
}