import { requireStore } from "@/lib/guard";
import { TAG_COLORS } from "@/lib/types";
import type { Tag, TagColor } from "@/lib/types";

/**
 * Tags / étiquettes — comme Trello.
 * Palette de couleurs fixe, création/modification/suppression.
 */

function isTagColor(v: unknown): v is TagColor {
  return typeof v === "string" && (TAG_COLORS as readonly string[]).includes(v);
}

export async function GET(_req: Request): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;
  return Response.json(await store.readTags());
}

export async function POST(req: Request): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  let body: { name?: unknown; color?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 30);
  if (!name) return Response.json({ error: "Nom requis" }, { status: 400 });

  const color = isTagColor(body.color) ? body.color : "blue";

  const tags = await store.readTags();
  const id = `tag-${Date.now().toString(36)}`;
  const tag: Tag = { id, name, color };
  tags.push(tag);
  await store.writeTags(tags);
  return Response.json(tag);
}