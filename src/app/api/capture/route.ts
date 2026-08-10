import { requireMachineToken } from "@/lib/cron-auth";
import { inboxIdOf } from "@/lib/projects";
import { readProjects, saveItems } from "@/lib/store";
import type { Item } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Capture par texte — la porte d'entrée du raccourci iOS.
 *
 * Le geste vise le nombre d'actions entre la pensée et la tâche : appuyer sur
 * le bouton Action, parler, c'est enregistré. L'app ne s'ouvre jamais.
 *
 * Raccourci à construire côté iPhone :
 *   1. « Dicter le texte » (français) — la dictée native, gratuite et hors ligne
 *   2. « Obtenir le contenu de l'URL » : POST vers /api/capture
 *      en-têtes : Authorization: Bearer <BRIEF_CAPTURE_TOKEN>
 *      corps JSON : { "text": <résultat de la dictée> }
 *   3. Réglages → Bouton Action → Raccourci
 *
 * Jeton dédié, pas le PIN de l'app : un secret déposé dans un raccourci iOS est
 * en clair sur le téléphone. Le perdre doit coûter la révocation d'un jeton,
 * pas le changement du code d'accès.
 *
 * `structure: false` court-circuite le LLM et crée un item brut dans l'Inbox —
 * utile quand on veut juste ne pas oublier, sans attendre l'appel réseau.
 */

const PARSE_TIMEOUT_MS = 45_000;

export async function POST(req: Request): Promise<Response> {
  const denied = requireMachineToken(req, "BRIEF_CAPTURE_TOKEN");
  if (denied) return denied;

  let body: { text?: unknown; structure?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Corps JSON illisible." }, { status: 400 });
  }

  const text = String(body.text ?? "").trim();
  if (!text) {
    return Response.json({ error: "`text` est requis." }, { status: 400 });
  }

  const projects = await readProjects();
  const inbox = inboxIdOf(projects);
  const now = new Date().toISOString();

  // Chemin court : pas de structuration, l'item atterrit tel quel dans l'Inbox.
  if (body.structure === false) {
    const item: Item = {
      id: `cap_${Date.now().toString(36)}`,
      kind: "task",
      title: text.slice(0, 300),
      projectId: inbox,
      due: null,
      allDay: true,
      priority: 4,
      rrule: null,
      createdAt: now,
      remindedAt: null,
      doneAt: null,
    };
    await saveItems([item]);
    return Response.json({ saved: 1, items: [item] });
  }

  // Chemin normal : on réutilise /api/parse plutôt que de dupliquer le prompt.
  // Une seule définition de la structuration, donc une seule à faire évoluer.
  const origin = new URL(req.url).origin;
  const pin = process.env.BRIEF_PIN;
  if (!pin) {
    return Response.json({ error: "BRIEF_PIN absent côté serveur." }, { status: 503 });
  }

  let drafts: unknown;
  try {
    const res = await fetch(`${origin}/api/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-brief-pin": pin },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(PARSE_TIMEOUT_MS),
    });
    const data = (await res.json()) as { items?: unknown; error?: string };
    if (!res.ok) {
      return Response.json(
        { error: data.error ?? `La structuration a répondu ${res.status}.` },
        { status: 502 },
      );
    }
    drafts = data.items;
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Structuration injoignable." },
      { status: 502 },
    );
  }

  const rows = Array.isArray(drafts) ? (drafts as Record<string, unknown>[]) : [];
  if (!rows.length) {
    return Response.json({ error: "Aucun item extrait de la note." }, { status: 422 });
  }

  const items: Item[] = rows.map((r) => ({
    id: String(r.id),
    kind: r.kind === "event" ? "event" : "task",
    title: String(r.title),
    projectId: String(r.projectId ?? inbox),
    due: typeof r.due === "string" ? r.due : null,
    allDay: r.allDay === true,
    priority: (r.priority as Item["priority"]) ?? 4,
    rrule: typeof r.rrule === "string" ? r.rrule : null,
    createdAt: now,
    remindedAt: null,
    doneAt: null,
  }));

  await saveItems(items);

  // Réponse volontairement courte : le raccourci l'affiche en notification.
  return Response.json({
    saved: items.length,
    summary: items.map((i) => i.title).join(" · "),
    items,
  });
}
