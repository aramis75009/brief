import { requireSession } from "@/lib/guard";
import { uniqueObjectiveId } from "@/lib/objectives";
import { readObjectives, readProjects, writeObjectives } from "@/lib/store";
import type { Objective, ObjectiveHorizon } from "@/lib/types";

/**
 * Objectifs Brief — lecture, création, édition, suppression.
 *
 * Un objectif n'est pas un item : il survit à ses tâches, les orchestre.
 * Règle absolue : toute route sous /api/ commence par requireSession().
 */

const MAX_TITLE = 80;
const HORIZONS: ObjectiveHorizon[] = ["court", "moyen", "long"];

function isHorizon(v: unknown): v is ObjectiveHorizon {
  return typeof v === "string" && HORIZONS.includes(v as ObjectiveHorizon);
}

export async function GET(_req: Request): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;

  return Response.json(await readObjectives());
}

export async function POST(req: Request): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;

  let body: { title?: unknown; projectId?: unknown; horizon?: unknown; notes?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const title = String(body.title ?? "").trim().slice(0, MAX_TITLE);
  if (!title) return Response.json({ error: "Le titre de l'objectif est vide." }, { status: 400 });

  const projectId = String(body.projectId ?? "").trim();
  if (!projectId) return Response.json({ error: "Projet manquant." }, { status: 400 });

  const horizon: ObjectiveHorizon = isHorizon(body.horizon) ? body.horizon : "moyen";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) || undefined : undefined;

  const projects = await readProjects();
  if (!projects.some((p) => p.id === projectId)) {
    return Response.json({ error: "Projet introuvable." }, { status: 404 });
  }

  const existing = await readObjectives();
  const created: Objective = {
    id: uniqueObjectiveId(title, new Set(existing.map((o) => o.id))),
    projectId,
    title,
    horizon,
    createdAt: new Date().toISOString(),
    achievedAt: null,
    notes,
  };

  try {
    await writeObjectives([...existing, created]);
  } catch (e) {
    return Response.json(
      { error: "Objectif non enregistré côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }

  return Response.json(created, { status: 201 });
}

export async function PATCH(req: Request): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;

  let body: { id?: unknown; title?: unknown; horizon?: unknown; achievedAt?: unknown; notes?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return Response.json({ error: "Identifiant manquant." }, { status: 400 });

  const existing = await readObjectives();
  const index = existing.findIndex((o) => o.id === id);
  if (index === -1) return Response.json({ error: "Objectif introuvable." }, { status: 404 });

  const patch: Partial<Objective> = {};
  if (body.title !== undefined) {
    const title = String(body.title).trim().slice(0, MAX_TITLE);
    if (!title) return Response.json({ error: "Le titre ne peut pas être vide." }, { status: 400 });
    patch.title = title;
  }
  if (body.horizon !== undefined && isHorizon(body.horizon)) patch.horizon = body.horizon;
  if (body.achievedAt !== undefined) {
    patch.achievedAt = typeof body.achievedAt === "string" ? body.achievedAt : null;
  }
  if (body.notes !== undefined) {
    const n = String(body.notes ?? "").trim().slice(0, 500);
    patch.notes = n || undefined;
  }

  const next = [...existing];
  next[index] = { ...next[index], ...patch };

  try {
    await writeObjectives(next);
  } catch (e) {
    return Response.json(
      { error: "Objectif non mis à jour côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }

  return Response.json(next[index]);
}

export async function DELETE(req: Request): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;

  let body: { id?: unknown };
  try {
    body = (await req.json()) as { id?: unknown };
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return Response.json({ error: "Identifiant manquant." }, { status: 400 });

  const existing = await readObjectives();
  if (!existing.some((o) => o.id === id)) {
    return Response.json({ error: "Objectif introuvable." }, { status: 404 });
  }

  try {
    await writeObjectives(existing.filter((o) => o.id !== id));
  } catch (e) {
    return Response.json(
      { error: "Objectif non supprimé côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
}
