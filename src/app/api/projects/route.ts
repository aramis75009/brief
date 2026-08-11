import { requirePin } from "@/lib/guard";
import { nextSkin, uniqueProjectId } from "@/lib/projects";
import { readItems, readProjects, writeProjects } from "@/lib/store";
import type { Project } from "@/lib/types";

/**
 * Projets de Brief — lecture, création, suppression.
 *
 * Ne consulte aucun service tiers : les projets appartiennent à Brief, sans
 * plafond de nombre. C'était la première raison du pivot, cette route est
 * l'endroit où ça devient vrai pour l'utilisateur.
 */

const MAX_NAME = 40;

export async function GET(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  return Response.json(await readProjects());
}

export async function POST(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, MAX_NAME);
  if (!name) {
    return Response.json({ error: "Le nom du projet est vide." }, { status: 400 });
  }

  const projects = await readProjects();

  // Comparaison insensible à la casse et aux espaces : deux projets nommés
  // « Sport » et « sport » seraient indiscernables à l'écran, donc c'est un
  // doublon même si les identifiants diffèrent.
  const folded = name.toLowerCase();
  if (projects.some((p) => p.name.trim().toLowerCase() === folded)) {
    return Response.json({ error: `« ${name} » existe déjà.` }, { status: 409 });
  }

  const created: Project = {
    id: uniqueProjectId(name, new Set(projects.map((p) => p.id))),
    name,
    ...nextSkin(projects),
  };

  try {
    await writeProjects([...projects, created]);
  } catch (e) {
    // Disque en lecture seule (Vercel) : on le dit plutôt que de laisser croire
    // que le projet est créé alors qu'il disparaîtra au rechargement.
    return Response.json(
      { error: "Projet non enregistré côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }

  return Response.json(created, { status: 201 });
}

export async function DELETE(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  let body: { id?: unknown };
  try {
    body = (await req.json()) as { id?: unknown };
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return Response.json({ error: "Identifiant manquant." }, { status: 400 });

  const projects = await readProjects();
  if (!projects.some((p) => p.id === id)) {
    return Response.json({ error: "Projet introuvable." }, { status: 404 });
  }

  // Les items NE SONT PAS supprimés avec le projet. Effacer des tâches parce
  // qu'on range une étiquette serait une perte de données sans rapport avec
  // l'intention. Ils deviennent orphelins et s'affichent sous « Autre » dans
  // l'écran Tâches, donc rien ne disparaît en silence.
  const orphaned = (await readItems()).filter((i) => i.projectId === id && !i.doneAt).length;

  try {
    await writeProjects(projects.filter((p) => p.id !== id));
  } catch (e) {
    return Response.json(
      { error: "Projet non supprimé côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }

  return Response.json({ ok: true, id, orphaned });
}
