import { requireSession } from "@/lib/guard";
import { structureText } from "@/lib/parse";
import { readProjects } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Structuration d'une note pour l'app — le travail lui-même vit dans
 * `src/lib/parse.ts`, parce que `/api/capture` doit pouvoir l'appeler sans
 * passer par HTTP (un appel serveur-vers-serveur ne porte aucune session).
 * Cette route n'est plus qu'une porte : garde, validation, traduction en
 * `Response`.
 */
export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const text = String(body.text ?? "").trim();
  if (!text) {
    return Response.json({ error: "Aucun texte à structurer." }, { status: 400 });
  }

  // Les projets viennent du serveur et non du client : c'est lui qui les possède.
  const projects = await readProjects();

  const result = await structureText(text, projects);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ items: result.items });
}
