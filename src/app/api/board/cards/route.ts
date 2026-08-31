import { requireStore } from "@/lib/guard";
import { columnItems, moveCardPlan } from "@/lib/kanban";
import { reconcileObjectivesInStore } from "@/lib/objective-reconcile";
import type { Item } from "@/lib/types";

/**
 * Déplacement d'une carte du board Kanban.
 *
 * Le client envoie une INTENTION — « entre ces deux cartes-là » — et jamais des
 * positions absolues. Deux raisons, toutes deux silencieuses si on les ignore :
 *
 *   1. L'écran ne voit qu'un sous-ensemble de chaque colonne (filtre projet,
 *      `!doneAt`, items actifs seulement). Des rangs calculés par le client
 *      écraseraient l'ordre des cartes qu'il masque.
 *   2. Un onglet resté ouvert renverrait la carte dans sa colonne d'origine,
 *      annulant un déplacement fait ailleurs, sans qu'aucune requête n'échoue.
 *
 * Le calcul tourne donc ici, dans la file d'écriture, sur la liste complète.
 *
 * ⚠️ Reste en PATCH. Le préflight CORS qu'impose `application/json` est ce qui
 * protège cette route du CSRF : en POST avec un content-type simple, un site
 * tiers pourrait mélanger tout le board avec le cookie de session de la
 * victime.
 */

/** Route d'ÉCRITURE : `requireSession()` seul, jamais le jeton machine. */
export async function PATCH(req: Request): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  let body: {
    itemId?: unknown;
    toColumnId?: unknown;
    beforeId?: unknown;
    afterId?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }

  // `String(objet)` rend "[object Object]" : on type explicitement plutôt que
  // de convertir, sinon un corps malformé produit un id qui « existe ».
  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
  if (!itemId) return Response.json({ error: "itemId manquant" }, { status: 400 });

  const beforeId = typeof body.beforeId === "string" && body.beforeId.trim() ? body.beforeId.trim() : undefined;
  const afterId = typeof body.afterId === "string" && body.afterId.trim() ? body.afterId.trim() : undefined;

  // Une colonne inconnue devient « non placée » plutôt qu'un `columnId` mort :
  // c'est exactement l'état qui rendait des cartes invisibles.
  let toColumnId: string | null = null;
  if (typeof body.toColumnId === "string" && body.toColumnId.trim()) {
    const wanted = body.toColumnId.trim();
    const board = await store.readBoard();
    toColumnId = board.columns.some((column) => column.id === wanted) ? wanted : null;
  } else if (body.toColumnId !== null && body.toColumnId !== undefined) {
    return Response.json({ error: "toColumnId doit être une chaîne ou null" }, { status: 400 });
  }

  let found = false;
  let fromColumnId: string | null = null;
  const items = await store.updateItemsAtomically((current) => {
    const moved = current.find((item) => item.id === itemId);
    if (!moved) return [];
    found = true;
    fromColumnId = moved.columnId ?? null;
    return moveCardPlan({ items: current, itemId, toColumnId, beforeId, afterId });
  });

  if (!found) return Response.json({ error: "Item introuvable" }, { status: 404 });

  // Invariant `AGENTS.md` : la réconciliation tourne après toute écriture
  // d'item, sans liste blanche de champs. Elle rend la même référence quand
  // rien ne change, donc l'écriture disque est sautée.
  await reconcileObjectivesInStore(store);

  // L'état frais des colonnes touchées : sans lui, l'UI optimiste ne peut pas
  // se réconcilier et prendrait un déplacement vers un item supprimé pour un
  // succès.
  const summarize = (columnId: string | null) =>
    columnItems(items, columnId).map((item: Item) => ({
      id: item.id,
      columnId: item.columnId ?? null,
      columnOrder: item.columnOrder,
    }));

  const columns: Record<string, ReturnType<typeof summarize>> = {
    [toColumnId ?? "unplaced"]: summarize(toColumnId),
  };
  if (fromColumnId !== toColumnId) {
    columns[fromColumnId ?? "unplaced"] = summarize(fromColumnId);
  }

  return Response.json({ ok: true, columns });
}
