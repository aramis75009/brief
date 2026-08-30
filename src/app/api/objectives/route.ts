import { requireSession } from "@/lib/guard";
import { reconcileObjectives, uniqueObjectiveId } from "@/lib/objectives";
import { readObjectives, readProjects, updateObjectivesAtomically } from "@/lib/store";
import type { Objective, ObjectiveHorizon } from "@/lib/types";

/**
 * Objectifs Brief — lecture, création, édition, suppression.
 *
 * Un objectif n'est pas un item : il survit à ses tâches, les orchestre.
 * Règle absolue : toute route sous /api/ commence par requireSession().
 *
 * Toute mutation passe par `updateObjectivesAtomically` (lecture-modification-
 * écriture sérialisée) et applique `reconcileObjectives` dans la même passe :
 * un objectif dont toutes les dépendances sont faites s'atteint tout seul, et
 * se rouvre si l'une redevient à faire (sauf s'il a été marqué à la main).
 * GET reste une pure lecture — la réconciliation vit au moment des mutations,
 * jamais dans une requête de lecture.
 */

const MAX_TITLE = 80;
const MAX_DEPS = 40;
const HORIZONS: ObjectiveHorizon[] = ["court", "moyen", "long"];

function isHorizon(v: unknown): v is ObjectiveHorizon {
  return typeof v === "string" && HORIZONS.includes(v as ObjectiveHorizon);
}

/**
 * Nettoie une liste de dépendances d'objectif : chaînes non vides, jamais
 * l'auto-référence (`obj:<ownId>`), plafonnée à `MAX_DEPS`. Les ids d'items et
 * les ids d'objectifs préfixés `obj:` cohabitent — la résolution (existe /
 * n'existe pas) se fait à la lecture dans `effectiveDeps`, pas ici.
 */
export function cleanDeps(v: unknown, ownId: string): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
    .map((d) => d.trim())
    .filter((d) => d !== `obj:${ownId}`)
    .slice(0, MAX_DEPS);
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

  let createdId = "";
  try {
    const reconciled = await updateObjectivesAtomically((objectives, items) => {
      const created: Objective = {
        id: uniqueObjectiveId(title, new Set(objectives.map((o) => o.id))),
        projectId,
        title,
        horizon,
        createdAt: new Date().toISOString(),
        achievedAt: null,
        achievedManually: false,
        notes,
        dependsOn: [],
      };
      createdId = created.id;
      return reconcileObjectives(items, [...objectives, created], new Date().toISOString());
    });
    const created = reconciled.find((o) => o.id === createdId);
    return Response.json(created, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: "Objectif non enregistré côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}

export async function PATCH(req: Request): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;

  let body: {
    id?: unknown;
    title?: unknown;
    horizon?: unknown;
    achievedAt?: unknown;
    achievedManually?: unknown;
    notes?: unknown;
    dependsOn?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return Response.json({ error: "Identifiant manquant." }, { status: 400 });

  const patch: Partial<Objective> = {};
  if (body.title !== undefined) {
    const title = String(body.title).trim().slice(0, MAX_TITLE);
    if (!title) return Response.json({ error: "Le titre ne peut pas être vide." }, { status: 400 });
    patch.title = title;
  }
  if (body.horizon !== undefined && isHorizon(body.horizon)) patch.horizon = body.horizon;
  if (body.notes !== undefined) {
    const n = String(body.notes ?? "").trim().slice(0, 500);
    patch.notes = n || undefined;
  }
  if (body.dependsOn !== undefined) {
    const deps = cleanDeps(body.dependsOn, id);
    if (deps) patch.dependsOn = deps;
  }
  if (body.achievedAt !== undefined) {
    const achieved = typeof body.achievedAt === "string" ? body.achievedAt : null;
    patch.achievedAt = achieved;
    // Un `achievedAt` posé à la main est collant (jamais rouvert par la
    // réconciliation) ; un `achievedAt: null` explicite rend l'objectif « auto »
    // à nouveau. Le client peut forcer via `achievedManually`.
    patch.achievedManually =
      typeof body.achievedManually === "boolean" ? body.achievedManually : achieved !== null;
  } else if (typeof body.achievedManually === "boolean") {
    patch.achievedManually = body.achievedManually;
  }

  let found = false;
  try {
    const reconciled = await updateObjectivesAtomically((objectives, items) => {
      const index = objectives.findIndex((o) => o.id === id);
      if (index === -1) return null;
      found = true;
      const next = [...objectives];
      next[index] = { ...next[index], ...patch };
      return reconcileObjectives(items, next, new Date().toISOString());
    });
    if (!found) return Response.json({ error: "Objectif introuvable." }, { status: 404 });
    return Response.json(reconciled.find((o) => o.id === id));
  } catch (e) {
    return Response.json(
      { error: "Objectif non mis à jour côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
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

  const tag = `obj:${id}`;
  let found = false;
  try {
    await updateObjectivesAtomically((objectives, items) => {
      if (!objectives.some((o) => o.id === id)) return null;
      found = true;
      // Retire aussi les liens `obj:<id>` que d'autres objectifs pointaient
      // vers celui-ci — sinon `effectiveDeps` traînerait une référence morte.
      const pruned = objectives
        .filter((o) => o.id !== id)
        .map((o) =>
          (o.dependsOn ?? []).includes(tag)
            ? { ...o, dependsOn: (o.dependsOn ?? []).filter((d) => d !== tag) }
            : o,
        );
      return reconcileObjectives(items, pruned, new Date().toISOString());
    });
    if (!found) return Response.json({ error: "Objectif introuvable." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: "Objectif non supprimé côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
