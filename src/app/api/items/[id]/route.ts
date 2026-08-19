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

  // Un titre présent mais blanc est conservé tel quel (chaîne vide) pour que
  // l'appelant puisse le REFUSER en 400. L'écraser ici rendrait le contrôle
  // inatteignable et `PATCH {"title":"   "}` répondrait 200 sans rien changer.
  if (typeof v.title === "string") out.title = v.title.trim();
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
    } else {
      // Une date illisible devient « pas d'échéance », comme partout ailleurs
      // dans Brief — surtout pas « on ignore et on garde l'ancienne ». Sinon le
      // client croit avoir déplacé l'échéance, et l'ancien rappel sonne quand
      // même. Un rappel absent se voit ; un rappel au mauvais moment ne se voit
      // pas.
      out.due = null;
      out.allDay = true;
    }
  }
  if (typeof v.allDay === "boolean") out.allDay = v.allDay;
  if (v.rrule === null || v.rrule === "") {
    out.rrule = null;
  } else if (typeof v.rrule === "string" && /^FREQ=/i.test(v.rrule.trim())) {
    out.rrule = v.rrule.trim();
  }
  if (v.durationMinutes === null || v.durationMinutes === undefined) {
    out.durationMinutes = undefined;
  } else if (
    typeof v.durationMinutes === "number" &&
    Number.isFinite(v.durationMinutes) &&
    v.durationMinutes > 0
  ) {
    out.durationMinutes = Math.round(v.durationMinutes);
  }
  // Occurrences supprimées (adoptées depuis le calendrier) : tableau de dates
  // UTC RFC 5545. `null` = effacement explicite ; ABSENT = on ne touche pas
  // (un PATCH {due} ne doit pas effacer les exdates existants).
  if (v.exdates === null) {
    out.exdates = undefined;
  } else if (Array.isArray(v.exdates)) {
    const clean = v.exdates.filter(
      (d): d is string => typeof d === "string" && /^\d{8}T\d{6}Z$/.test(d),
    );
    out.exdates = clean.length > 0 ? clean : undefined;
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

  // Même traitement d'erreur que `/api/items` : un disque en lecture seule ou
  // une écriture qui échoue doit produire un 503 en français, pas le 500
  // générique de Next — le client affiche le message tel quel.
  try {
    const updated = await patchItem(id, patch);
    if (!updated) {
      return Response.json({ error: "Item introuvable." }, { status: 404 });
    }
    return Response.json({ item: updated });
  } catch (e) {
    return Response.json(
      {
        error: "Modification non enregistrée côté serveur.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}

/**
 * Suppression définitive d'un item.
 *
 * Jusqu'ici la corbeille de la fiche ne retirait la ligne que de l'état React :
 * l'item revenait au rechargement suivant, sans que rien ne le signale. Une
 * suppression qui ne supprime pas est pire qu'un bouton absent — on croit avoir
 * rangé.
 *
 * Distinct de la coche : cocher garde une trace, supprimer n'en garde aucune.
 *
 * ⚠️ C'est l'UNIQUE chemin de suppression. Un second existait sur la
 * collection (`DELETE /api/items` avec l'id dans le corps) ; les deux ont
 * cohabité le temps d'un commit, dont un que personne n'appelait. Ne pas en
 * réintroduire un troisième.
 */
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

  try {
    const deleted = await deleteItem(id);
    if (!deleted) {
      return Response.json({ error: "Item introuvable." }, { status: 404 });
    }
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json(
      {
        error: "Suppression non enregistrée côté serveur.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}
