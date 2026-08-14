import { isRealCalendarDate } from "@/lib/due";
import { requirePin } from "@/lib/guard";
import { fallbackProjectId, isPriority } from "@/lib/projects";
import { deleteItem, patchItem, readProjects } from "@/lib/store";
import type { ItemKind, Item, Priority, Project } from "@/lib/types";

/**
 * Modification et suppression d'un item déjà enregistré.
 *
 * Jusqu'ici, la fiche d'un item ne permettait que d'effacer (et encore, sans
 * persistance : la suppression se faisait côté client et l'item revenait au
 * rechargement). C'est le chaînon manquant — `store.patchItem` et
 * `store.deleteItem` existaient déjà sans route pour y arriver.
 *
 * PATCH applique un patch partiel sur les champs éditables d'un item.
 * DELETE retire l'item du store, durablement.
 */

/**
 * Sanitise un patch, comme `coerce` dans `/api/items` le fait pour la création.
 * Une date illisible devient « pas d'échéance », une priorité inconnue devient 4,
 * un projet inconnu bascule sur le repli : jamais de données bricolées.
 */
function sanitizePatch(
  input: unknown,
  knownProjects: Set<string>,
  fallback: string,
): Partial<Item> {
  if (typeof input !== "object" || input === null) return {};
  const v = input as Record<string, unknown>;
  const out: Partial<Item> = {};

  if (typeof v.title === "string") {
    const t = v.title.trim();
    if (t) out.title = t;
  }
  if (v.kind === "event" || v.kind === "task") out.kind = v.kind as ItemKind;
  if (typeof v.projectId === "string") {
    out.projectId = knownProjects.has(v.projectId) ? v.projectId : fallback;
  }
  if (isPriority(v.priority)) out.priority = v.priority as Priority;
  if (v.due === null || v.due === "") {
    out.due = null;
    out.allDay = true;
  } else if (typeof v.due === "string" && v.due.trim()) {
    const parsed = new Date(v.due);
    if (isRealCalendarDate(v.due) && !Number.isNaN(parsed.getTime())) {
      out.due = v.due;
    }
  }
  if (typeof v.allDay === "boolean") out.allDay = v.allDay;
  if (v.rrule === null || v.rrule === "") {
    out.rrule = null;
  } else if (typeof v.rrule === "string" && /^FREQ=/i.test(v.rrule.trim())) {
    out.rrule = v.rrule.trim();
  }
  return out;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  const { id } = await params;
  if (!id.trim()) {
    return Response.json({ error: "Identifiant manquant." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const projects: Project[] = await readProjects();
  const known = new Set(projects.map((p) => p.id));
  const patch = sanitizePatch(body, known, fallbackProjectId(projects));

  // Un titre vide (réduit à rien par sanitizePatch) doit être refusé : on ne
  // dégrade pas un item existant en truc sans intitulé.
  if (patch.title === "") {
    return Response.json({ error: "Le titre ne peut pas être vide." }, { status: 400 });
  }

  const updated = await patchItem(id, patch);
  if (!updated) {
    return Response.json({ error: "Item introuvable." }, { status: 404 });
  }
  return Response.json({ item: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  const { id } = await params;
  if (!id.trim()) {
    return Response.json({ error: "Identifiant manquant." }, { status: 400 });
  }

  const deleted = await deleteItem(id);
  if (!deleted) {
    return Response.json({ error: "Item introuvable." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
