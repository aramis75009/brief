import { requirePin } from "@/lib/guard";
import { readBoard, writeBoard } from "@/lib/store";
import type { KanbanColumn } from "@/lib/types";

/**
 * Board Kanban — lecture et modification des colonnes.
 * Les colonnes sont libres (comme Trello) : l'utilisateur crée, nomme,
 * réordonne et supprime ses colonnes.
 */

export async function GET(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;
  return Response.json(await readBoard());
}

export async function PATCH(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  let body: { action?: unknown; column?: unknown; id?: unknown; name?: unknown; order?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }

  const board = await readBoard();

  const action = String(body.action ?? "");

  if (action === "add") {
    const name = String(body.name ?? "").trim().slice(0, 40);
    if (!name) return Response.json({ error: "Nom requis" }, { status: 400 });
    const id = `col-${Date.now().toString(36)}`;
    const order = board.columns.length;
    board.columns.push({ id, name, order });
    board.updatedAt = new Date().toISOString();
    await writeBoard(board);
    return Response.json(board);
  }

  if (action === "rename") {
    const id = String(body.id ?? "");
    const name = String(body.name ?? "").trim().slice(0, 40);
    const col = board.columns.find((c) => c.id === id);
    if (!col) return Response.json({ error: "Colonne introuvable" }, { status: 404 });
    col.name = name;
    board.updatedAt = new Date().toISOString();
    await writeBoard(board);
    return Response.json(board);
  }

  if (action === "delete") {
    const id = String(body.id ?? "");
    board.columns = board.columns.filter((c) => c.id !== id);
    // Réordonner les colonnes restantes
    board.columns
      .sort((a, b) => a.order - b.order)
      .forEach((c, i) => (c.order = i));
    board.updatedAt = new Date().toISOString();
    await writeBoard(board);
    return Response.json(board);
  }

  if (action === "reorder") {
    const ids = body.order;
    if (!Array.isArray(ids)) return Response.json({ error: "order doit être un tableau d'IDs" }, { status: 400 });
    const idList = ids.map(String);
    board.columns
      .sort((a, b) => idList.indexOf(a.id) - idList.indexOf(b.id))
      .forEach((c, i) => (c.order = i));
    board.updatedAt = new Date().toISOString();
    await writeBoard(board);
    return Response.json(board);
  }

  return Response.json({ error: "Action inconnue" }, { status: 400 });
}