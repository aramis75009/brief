import { requireMachineToken } from "@/lib/cron-auth";
import { ownerStore } from "@/lib/guard";
import { structureText } from "@/lib/parse";
import { fallbackProjectId } from "@/lib/projects";
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
 * Jeton dédié, pas la session de l'app : un secret déposé dans un raccourci iOS
 * est en clair sur le téléphone. Le perdre doit coûter la révocation d'un jeton,
 * pas le changement du mot de passe d'un compte.
 *
 * `structure: false` court-circuite le LLM et crée un item brut dans l'Inbox —
 * utile quand on veut juste ne pas oublier, sans attendre l'appel réseau.
 */

export async function POST(req: Request): Promise<Response> {
  const denied = requireMachineToken(req, "BRIEF_CAPTURE_TOKEN");
  if (denied) return denied;

  // ⚠️ MONO-COMPTE JUSQU'AU LOT 2. Ce jeton ne porte aucune identité : la
  // capture écrit donc dans le Brief du PROPRIÉTAIRE. Le lot 2 le remplace par
  // un jeton par compte (table `machine_tokens`), et cette ligne disparaît.
  const store = ownerStore();
  if (store instanceof Response) return store;

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

  const projects = await store.readProjects();
  const fallback = fallbackProjectId(projects);
  const now = new Date().toISOString();

  // Chemin court : pas de structuration, l'item atterrit tel quel dans l'Inbox.
  if (body.structure === false) {
    const item: Item = {
      id: `cap_${Date.now().toString(36)}`,
      kind: "task",
      title: text.slice(0, 300),
      projectId: fallback,
      due: null,
      allDay: true,
      priority: 4,
      rrule: null,
      createdAt: now,
      remindedAt: null,
      doneAt: null,
    };
    await store.saveItems([item]);
    return Response.json({ saved: 1, items: [item] });
  }

  // Chemin normal : on appelle la structuration EN DIRECT (`src/lib/parse.ts`),
  // la même que `/api/parse`. Une seule définition du prompt, donc une seule à
  // faire évoluer — et surtout aucun aller-retour HTTP vers soi-même : depuis
  // que l'authentification est une session par cookie, un appel
  // serveur-vers-serveur n'a aucune identité à présenter et se ferait refuser.
  const result = await structureText(text, projects);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const rows = result.items;
  if (!rows.length) {
    return Response.json({ error: "Aucun item extrait de la note." }, { status: 422 });
  }

  const items: Item[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    projectId: r.projectId || fallback,
    due: r.due,
    allDay: r.allDay,
    priority: r.priority,
    rrule: r.rrule,
    createdAt: now,
    remindedAt: null,
    doneAt: null,
  }));

  await store.saveItems(items);

  // Réponse volontairement courte : le raccourci l'affiche en notification.
  return Response.json({
    saved: items.length,
    summary: items.map((i) => i.title).join(" · "),
    items,
  });
}
