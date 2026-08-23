import { requirePin } from "@/lib/guard";
import { readTags, writeTags } from "@/lib/store";
import { TAG_COLORS } from "@/lib/types";
import type { TagColor } from "@/lib/types";

/**
 * Modification / suppression d'un tag.
 */

function isTagColor(v: unknown): v is TagColor {
  return typeof v === "string" && (TAG_COLORS as readonly string[]).includes(v);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  const { id } = await params;
  let body: { name?: unknown; color?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }

  const tags = await readTags();
  const tag = tags.find((t) => t.id === id);
  if (!tag) return Response.json({ error: "Tag introuvable" }, { status: 404 });

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 30);
    if (!name) return Response.json({ error: "Nom requis" }, { status: 400 });
    tag.name = name;
  }
  if (body.color !== undefined && isTagColor(body.color)) {
    tag.color = body.color;
  }

  await writeTags(tags);
  return Response.json(tag);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  const { id } = await params;
  const tags = await readTags();
  const filtered = tags.filter((t) => t.id !== id);
  if (filtered.length === tags.length) {
    return Response.json({ error: "Tag introuvable" }, { status: 404 });
  }
  await writeTags(filtered);
  return Response.json({ ok: true });
}