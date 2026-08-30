import { recordDeletedExternalUid } from "@/lib/caldav";
import { isRealCalendarDate } from "@/lib/due";
import { requireSession } from "@/lib/guard";
import { fallbackProjectId, isPriority } from "@/lib/projects";
import { deleteItem, patchItem, readItems, readProjects } from "@/lib/store";
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
export function sanitizePatch(
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
  // Le type "idée" est un statut, pas un `kind` — voir `itemType()`. Sans
  // cette branche, `updateItem(id, { status: "idea" })` (bouton « Convertir
  // en tâche »/« Archiver » de l'écran Idées) était silencieusement vidé par
  // ce sanitizer : la conversion ne persistait jamais côté serveur.
  if (v.status === "active" || v.status === "idea" || v.status === "archived") {
    out.status = v.status;
  }
  if (typeof v.notes === "string") out.notes = v.notes;
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
  // Occurrences décalées (adoptées depuis le calendrier) : objet
  // `RECURRENCE-ID` → nouveau DTSTART (UTC RFC 5545). `null` = effacement
  // explicite ; ABSENT = on ne touche pas (même règle que `exdates`).
  if (v.overrides === null) {
    out.overrides = undefined;
  } else if (typeof v.overrides === "object" && v.overrides !== null && !Array.isArray(v.overrides)) {
    const clean: Record<string, string> = {};
    for (const [k, val] of Object.entries(v.overrides as Record<string, unknown>)) {
      if (/^\d{8}T\d{6}Z$/.test(k) && typeof val === "string" && /^\d{8}T\d{6}Z$/.test(val)) {
        clean[k] = val;
      }
    }
    out.overrides = Object.keys(clean).length > 0 ? clean : undefined;
  }
  // Sous-tâches : tableau de { id, title, done }.
  if (Array.isArray(v.subtasks)) {
    out.subtasks = v.subtasks
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map((s) => ({
        id: String(s.id ?? ""),
        title: String(s.title ?? "").trim().slice(0, 200),
        done: !!s.done,
      }))
      .filter((s) => s.id && s.title)
      .slice(0, 50);
  }
  // Tags : tableau de strings (IDs de tags), max 10.
  if (Array.isArray(v.tags)) {
    out.tags = v.tags
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim())
      .slice(0, 10);
  }
  // Dépendances : tableau de strings (IDs d'items), max 20.
  if (Array.isArray(v.dependsOn)) {
    out.dependsOn = v.dependsOn
      .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
      .map((d) => d.trim())
      .slice(0, 20);
  }
  // Colonne Kanban : string (ID de colonne) ou null (non placée).
  if (v.columnId === null) {
    out.columnId = null;
  } else if (typeof v.columnId === "string" && v.columnId.trim()) {
    out.columnId = v.columnId.trim();
  }
  // Lien objectif : string (ID d'objectif) ou null (détaché). Absent = on ne touche pas.
  if (v.objectiveId === null) {
    out.objectiveId = null;
  } else if (typeof v.objectiveId === "string" && v.objectiveId.trim()) {
    out.objectiveId = v.objectiveId.trim();
  }
  return out;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireSession();
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
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  if (!id.trim()) {
    return Response.json({ error: "Identifiant manquant." }, { status: 400 });
  }

  try {
    // Un item ADOPTÉ (`externalUid` — posé directement dans l'app Calendrier,
    // décision Aramis du 2026-08-19) garde son événement source sur iCloud
    // même après suppression côté Brief. Sans mémoire de cette suppression,
    // le prochain passage CalDAV ne voit qu'un événement sans item Brief —
    // indiscernable d'un événement jamais adopté — et RECRÉE l'item avec le
    // même id déterministe. Lu AVANT `deleteItem` : après, l'item n'existe
    // plus nulle part pour retrouver son `externalUid`.
    const before = (await readItems()).find((i) => i.id === id);
    if (before?.externalUid) {
      await recordDeletedExternalUid(before.externalUid);
    }

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
