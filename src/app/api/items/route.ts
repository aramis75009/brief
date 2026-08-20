import { completionPatch } from "@/lib/completion";
import { isRealCalendarDate } from "@/lib/due";
import { requirePin } from "@/lib/guard";
import { fallbackProjectId, isPriority } from "@/lib/projects";
import { patchItem, readItems, readProjects, saveItems } from "@/lib/store";
import type { DraftItem, Item, ItemKind, SaveResult } from "@/lib/types";

/**
 * Enregistrement des items. Remplace l'ancienne route de push vers Todoist.
 *
 * Idempotent par construction : l'`id` du brouillon est réutilisé tel quel, donc
 * un double envoi écrase au lieu de dupliquer. C'est ce qui rend le double-clic
 * et le rejeu d'une file d'attente hors-ligne inoffensifs, sans logique de
 * déduplication à maintenir.
 */

function coerce(input: unknown, knownProjects: Set<string>, fallback: string): DraftItem | null {
  if (typeof input !== "object" || input === null) return null;
  const v = input as Record<string, unknown>;

  const title = String(v.title ?? "").trim();
  const id = String(v.id ?? "").trim();
  if (!title || !id) return null;

  const kind: ItemKind = v.kind === "event" ? "event" : "task";
  const projectId = knownProjects.has(String(v.projectId ?? "")) ? String(v.projectId) : fallback;

  // Une date illisible devient « pas d'échéance » : mieux vaut un rappel absent
  // et visible qu'un rappel programmé au mauvais moment.
  let due: string | null = null;
  if (typeof v.due === "string" && v.due.trim()) {
    const parsed = new Date(v.due);
    // `isRealCalendarDate` d'abord : new Date("2026-02-31") rend le 3 mars
    // sans erreur, donc `Number.isNaN` seul laisse passer des dates fausses.
    if (isRealCalendarDate(v.due) && !Number.isNaN(parsed.getTime())) due = v.due;
  }

  return {
    id,
    kind,
    title,
    projectId,
    due,
    allDay: v.allDay === true,
    priority: isPriority(v.priority) ? v.priority : 4,
    rrule: typeof v.rrule === "string" && /^FREQ=/i.test(v.rrule) ? v.rrule : null,
    durationMinutes:
      typeof v.durationMinutes === "number" && Number.isFinite(v.durationMinutes) && v.durationMinutes > 0
        ? Math.round(v.durationMinutes)
        : undefined,
    notes: typeof v.notes === "string" ? v.notes : undefined,
    subtasks: Array.isArray(v.subtasks) ? v.subtasks.filter(isSubTask) : undefined,
    audioOrigin: isAudioOrigin(v.audioOrigin) ? v.audioOrigin : undefined,
    status: v.status === "idea" || v.status === "archived" ? v.status : undefined,
  };
}

function isSubTask(s: unknown): s is { id: string; title: string; done: boolean } {
  if (typeof s !== "object" || s === null) return false;
  const o = s as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.title === "string" && typeof o.done === "boolean";
}

function isAudioOrigin(v: unknown): v is import("@/lib/types").AudioOrigin {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.text === "string" && typeof o.highlight === "string"
    && typeof o.startSec === "number" && typeof o.endSec === "number"
    && typeof o.durationSec === "number" && typeof o.date === "string"
    && Array.isArray(o.siblingIds);
}

export async function GET(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");
  let items = await readItems();
  if (statusFilter === "idea" || statusFilter === "active" || statusFilter === "archived") {
    items = items.filter((i) => (i.status || "active") === statusFilter);
  } else if (statusFilter === "not-idea") {
    items = items.filter((i) => i.status !== "idea" && i.status !== "archived");
  }

  return Response.json({ items });
}

export async function POST(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  let body: { items?: unknown };
  try {
    body = (await req.json()) as { items?: unknown };
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const rows = Array.isArray(body.items) ? body.items : [];
  if (!rows.length) {
    return Response.json({ error: "Aucun item à enregistrer." }, { status: 400 });
  }

  const projects = await readProjects();
  const known = new Set(projects.map((p) => p.id));
  const fallback = fallbackProjectId(projects);
  const now = new Date().toISOString();

  const results: SaveResult[] = [];
  const toSave: Item[] = [];

  for (const row of rows) {
    const draft = coerce(row, known, fallback);
    if (!draft) {
      const id = String((row as { id?: unknown })?.id ?? "?");
      results.push({ ok: false, id, error: "Item invalide : titre ou identifiant manquant." });
      continue;
    }
    toSave.push({ ...draft, createdAt: now, remindedAt: null, doneAt: null });
    results.push({ ok: true, id: draft.id });
  }

  if (toSave.length) {
    try {
      await saveItems(toSave);
    } catch (e) {
      // Le disque peut être en lecture seule (Vercel). On le dit plutôt que de
      // laisser croire que les items sont enregistrés.
      return Response.json(
        {
          error: "Items non enregistrés côté serveur.",
          detail: e instanceof Error ? e.message : String(e),
          saved: 0,
          total: rows.length,
        },
        { status: 503 },
      );
    }
  }

  const saved = results.filter((r) => r.ok).length;
  const status = saved === 0 ? 400 : saved === rows.length ? 200 : 207;
  return Response.json({ results, saved, total: rows.length }, { status });
}

/**
 * Coche « fait » d'un item — `{ id, done }`.
 *
 * Route séparée de POST à dessein : POST remplace un item entier et remet
 * `doneAt` à `null` par construction, ce qui rend impossible d'enregistrer une
 * complétion par ce chemin. Deux intentions différentes, deux verbes.
 *
 * L'écriture passe par `patchItem`, qui sérialise et renomme atomiquement : le
 * cron des rappels écrit le même fichier toutes les 60 secondes, et une
 * lecture-modification-écriture concurrente perdrait l'une des deux.
 */
export async function PATCH(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  let body: { id?: unknown; done?: unknown; completedAt?: unknown };
  try {
    body = (await req.json()) as { id?: unknown; done?: unknown; completedAt?: unknown };
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return Response.json({ error: "Identifiant manquant." }, { status: 400 });
  if (typeof body.done !== "boolean") {
    return Response.json({ error: "`done` doit être un booléen." }, { status: 400 });
  }
  // Occurrence PRÉCISE cochée (l'heure effective affichée dans la liste du
  // jour). Sur une récurrence, le cron des rappels peut avoir avancé `due`
  // au-delà de l'occurrence qu'on coche : sans elle, `completionPatch`
  // enregistrerait la mauvaise occurrence comme faite.
  const completedAt = typeof body.completedAt === "string" ? body.completedAt : undefined;

  const item = (await readItems()).find((i) => i.id === id);
  if (!item) return Response.json({ error: "Item introuvable." }, { status: 404 });

  const { kind, patch } = completionPatch(item, body.done, new Date(), completedAt);

  try {
    const updated = await patchItem(id, patch);
    if (!updated) return Response.json({ error: "Item introuvable." }, { status: 404 });
    // `kind` permet au client de dire « repoussé à mardi » plutôt que « fait »
    // sur une récurrence — sans ça, cocher paraîtrait ne rien faire.
    return Response.json({ item: updated, outcome: kind });
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

/*
 * La suppression vit dans `/api/items/[id]`, pas ici.
 *
 * Un `DELETE` de collection portant l'id dans le corps a existé à cet endroit.
 * Quand `DELETE /api/items/[id]` est arrivé, les deux ont coexisté sans que
 * rien ne les départage — et c'est le nouveau que personne n'appelait. Un
 * chemin d'écriture jamais exercé finit par diverger de celui qui sert.
 *
 * `PATCH` reste ici parce qu'il fait autre chose : il coche et décoche, et
 * c'est le serveur qui décide si une tâche récurrente avance ou se termine.
 */
