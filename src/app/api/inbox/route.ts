import { requireStore } from "@/lib/guard";

/**
 * Boîte de réception — le journal de ce que Brief a fait SANS qu'on le lui
 * demande : un rappel parti, une édition adoptée depuis l'app Calendrier, une
 * tâche débloquée, une dictée structurée, un objectif atteint.
 *
 * Ces cinq faits sont aujourd'hui invisibles. Ils ne laissent qu'une ligne
 * dans le journal d'un conteneur que personne ne lit — c'est pour ça qu'un
 * rendez-vous déplacé dans Apple Calendar arrivait dans Brief sans que rien
 * ne le dise.
 *
 * **Cette route ne fait qu'exposer et marquer comme lu.** Elle n'écrit jamais
 * d'événement : ce sont les crons et les routes qui produisent les faits, au
 * moment où ils se produisent. Une route d'écriture ouverte au client
 * permettrait de fabriquer un journal qui ne raconte pas ce qui s'est passé.
 */

export async function GET(): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  const events = await store.readInbox();
  return Response.json({
    events,
    unread: events.filter((e) => !e.readAt).length,
  });
}

/**
 * Marque des événements comme lus. `ids` absent ou vide = tout le journal
 * (le geste « tout marquer comme lu »).
 */
export async function PATCH(req: Request): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  let body: { ids?: unknown };
  try {
    body = (await req.json()) as { ids?: unknown };
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];

  try {
    const events = await store.markInboxRead(ids);
    return Response.json({ events, unread: events.filter((e) => !e.readAt).length });
  } catch (e) {
    return Response.json(
      { error: "Journal non mis à jour côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
