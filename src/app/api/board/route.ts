import { requireSession } from "@/lib/guard";
import { detachColumn } from "@/lib/kanban";
import { reconcileObjectivesInStore } from "@/lib/objective-reconcile";
import { readBoard, updateBoardAtomically, updateItemsAtomically } from "@/lib/store";
import type { KanbanBoard, KanbanColumn } from "@/lib/types";

/**
 * Board Kanban — lecture et modification des colonnes.
 * Les colonnes sont libres (comme Trello) : l'utilisateur crée, nomme,
 * réordonne et supprime ses colonnes.
 *
 * ⚠️ Chaque action passe par `updateBoardAtomically` : `readBoard()` suivi de
 * `writeBoard()` laissait une fenêtre entre la lecture et l'écriture, et le
 * glisser-déposer des colonnes transforme `reorder` en geste rapide et répété.
 *
 * ⚠️ Ne JAMAIS imbriquer `updateItemsAtomically` dans `updateBoardAtomically` :
 * les deux passent par la même file d'écriture (`serialize`, `store.ts:37`),
 * l'appel interne attendrait l'externe — interblocage définitif. On les
 * enchaîne.
 */

export async function GET(_req: Request): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;
  const board = await readBoard();

  /*
   * Passe de récupération — les orphelines des suppressions PASSÉES.
   *
   * L'ancienne action `delete` retirait la colonne sans toucher aux cartes :
   * `items.json` en production porte donc déjà des `columnId` qui ne pointent
   * plus nulle part. Ces cartes ne s'affichent dans aucune colonne, et pas
   * davantage dans « Non placées » (dont le filtre est `!columnId`) — le
   * correctif de `delete` empêche d'en créer de nouvelles, il ne répare pas
   * celles qui existent.
   *
   * Oui, c'est une écriture dans une route de lecture. C'est assumé et borné :
   * `detachColumn` rend un tableau vide dès que le board est sain, et
   * `updateItemsAtomically` n'écrit rien sur un tableau vide. En pratique elle
   * écrit une fois, jamais plus.
   */
  const liveIds = board.columns.map((c) => c.id);
  const recovered = await updateItemsAtomically((items) => detachColumn(items, null, liveIds));
  void recovered;

  return Response.json(board);
}

/**
 * Numérote les colonnes de 0 à n-1 **dans l'ordre du tableau reçu**.
 *
 * ⚠️ Ne trie surtout pas sur `order` au passage : cette fonction est appelée
 * juste après `reorder`, qui vient précisément de ranger le tableau dans un
 * ordre différent de celui des `order` stockés. Un tri ici annulerait le
 * réordonnancement — silencieusement, avec une réponse 200 et un board
 * inchangé.
 */
function renumber(columns: KanbanColumn[]): KanbanColumn[] {
  return columns.map((column, order) => ({ ...column, order }));
}

/** Les colonnes rangées selon le `order` qu'elles portent. */
function byStoredOrder(columns: KanbanColumn[]): KanbanColumn[] {
  return [...columns].sort((a, b) => a.order - b.order);
}

function touched(columns: KanbanColumn[]): KanbanBoard {
  return { columns, updatedAt: new Date().toISOString() };
}

export async function PATCH(req: Request): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;

  let body: { action?: unknown; column?: unknown; id?: unknown; name?: unknown; order?: unknown; limit?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }

  const action = String(body.action ?? "");

  if (action === "add") {
    const name = String(body.name ?? "").trim().slice(0, 40);
    if (!name) return Response.json({ error: "Nom requis" }, { status: 400 });
    const id = `col-${Date.now().toString(36)}`;
    const board = await updateBoardAtomically((current) =>
      touched([...current.columns, { id, name, order: current.columns.length }]),
    );
    return Response.json(board);
  }

  if (action === "rename") {
    const id = String(body.id ?? "");
    const name = String(body.name ?? "").trim().slice(0, 40);
    if (!name) return Response.json({ error: "Nom requis" }, { status: 400 });
    let found = true;
    const board = await updateBoardAtomically((current) => {
      if (!current.columns.some((c) => c.id === id)) {
        found = false;
        return current;
      }
      return touched(current.columns.map((c) => (c.id === id ? { ...c, name } : c)));
    });
    if (!found) return Response.json({ error: "Colonne introuvable" }, { status: 404 });
    return Response.json(board);
  }

  if (action === "delete") {
    const id = String(body.id ?? "");

    // Les cartes d'abord, la colonne ensuite. Dans cet ordre, une panne entre
    // les deux laisse des cartes visibles en « non placées » — l'état sûr.
    // L'ordre inverse produirait exactement le bug qu'on corrige : un
    // `columnId` qui ne pointe plus nulle part, donc des cartes affichées ni
    // dans une colonne ni dans « non placées », perdues sans un mot.
    let detached = 0;
    await updateItemsAtomically((items) => {
      const patches = detachColumn(items, id);
      detached = patches.length;
      return patches;
    });

    const board = await updateBoardAtomically((current) =>
      touched(renumber(byStoredOrder(current.columns.filter((c) => c.id !== id)))),
    );

    // Invariant `AGENTS.md` : la réconciliation tourne après TOUTE écriture
    // d'item, **sans liste blanche de champs**. `columnId` ne peut pas changer
    // l'état d'un objectif aujourd'hui — mais raisonner « ce champ-là ne
    // compte pas » est exactement ce que l'invariant interdit.
    if (detached > 0) await reconcileObjectivesInStore();

    return Response.json({ ...board, detached });
  }

  if (action === "reorder") {
    const ids = body.order;
    if (!Array.isArray(ids)) {
      return Response.json({ error: "order doit être un tableau d'IDs" }, { status: 400 });
    }
    const idList = ids.map(String);
    const board = await updateBoardAtomically((current) => {
      const ranked = new Map(idList.map((id, index) => [id, index]));
      // Une colonne absente de la liste (créée par un autre onglet entre-temps)
      // passe en fin plutôt que de sauter en tête avec un rang -1.
      return touched(
        renumber(
          [...current.columns].sort(
            (a, b) => (ranked.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (ranked.get(b.id) ?? Number.MAX_SAFE_INTEGER),
          ),
        ),
      );
    });
    return Response.json(board);
  }

  if (action === "wip") {
    const id = String(body.id ?? "");
    // `null` efface la limite. Une valeur non entière ou < 1 est refusée plutôt
    // que rabotée : « limite 0 » et « limite 2.5 » ne veulent rien dire, et une
    // valeur silencieusement corrigée est plus difficile à comprendre qu'un 400.
    const raw = body.limit;
    let limit: number | undefined;
    if (raw === null || raw === undefined) limit = undefined;
    else if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 999) limit = raw;
    else return Response.json({ error: "limit doit être un entier de 1 à 999, ou null" }, { status: 400 });

    let found = true;
    const board = await updateBoardAtomically((current) => {
      if (!current.columns.some((c) => c.id === id)) {
        found = false;
        return current;
      }
      return touched(
        current.columns.map((c) => {
          if (c.id !== id) return c;
          const next = { ...c, wipLimit: limit };
          if (limit === undefined) delete next.wipLimit;
          return next;
        }),
      );
    });
    if (!found) return Response.json({ error: "Colonne introuvable" }, { status: 404 });
    return Response.json(board);
  }

  return Response.json({ error: "Action inconnue" }, { status: 400 });
}
