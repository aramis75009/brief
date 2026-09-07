import { requireStore } from "@/lib/guard";
import type { Portfolio } from "@/lib/types";

/**
 * Portefeuilles — un groupe de projets, et rien de plus.
 *
 * Un portefeuille ne possède ni tâche ni objectif : il n'agrège que des
 * projets, dont il tire sa santé et sa progression. C'est ce qui lui permet de
 * rester juste sans maintenance — supprimer un projet le retire du groupe, il
 * n'y a aucun compteur à corriger ailleurs.
 *
 * Règle absolue du repo : toute route sous /api/ commence par une garde.
 * Celle-ci touche au store, donc `requireStore()` — qui fait la garde ET la
 * résolution d'identité en un appel.
 *
 * Toute mutation passe par `updatePortfoliosAtomically` : lire puis écrire en
 * deux temps laisse une fenêtre où deux appels concurrents s'écrasent, et rien
 * ne le signalerait.
 */

const MAX_NAME = 60;
const MAX_PROJECTS = 40;
/**
 * Un portefeuille par projet serait déjà absurde ; ce plafond n'est là que
 * pour qu'une boucle client emballée ne remplisse pas le disque du compte.
 */
const MAX_PORTFOLIOS = 60;

/** `pf_<base36>` — opaque, jamais converti en nombre, jamais ordonné. */
function newPortfolioId(): string {
  return `pf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Nettoie une liste d'ids de projets : chaînes non vides, dédoublonnées,
 * plafonnée. La résolution (le projet existe-t-il encore ?) se fait à la
 * LECTURE, dans `portfolioProjects` — pas ici : un projet supprimé après coup
 * doit disparaître du portefeuille sans qu'on ait à réécrire le fichier.
 */
export function cleanProjectIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (id) seen.add(id);
    if (seen.size >= MAX_PROJECTS) break;
  }
  return [...seen];
}

export async function GET(): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  return Response.json(await store.readPortfolios());
}

export async function POST(req: Request): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  let body: { name?: unknown; projectIds?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, MAX_NAME);
  if (!name) return Response.json({ error: "Le nom du portefeuille est vide." }, { status: 400 });

  const created: Portfolio = {
    id: newPortfolioId(),
    name,
    projectIds: cleanProjectIds(body.projectIds),
    createdAt: new Date().toISOString(),
  };

  try {
    let full = false;
    await store.updatePortfoliosAtomically((portfolios) => {
      if (portfolios.length >= MAX_PORTFOLIOS) {
        full = true;
        return null;
      }
      return [...portfolios, created];
    });
    if (full) {
      return Response.json(
        { error: `Un compte ne peut pas dépasser ${MAX_PORTFOLIOS} portefeuilles.` },
        { status: 409 },
      );
    }
    return Response.json(created, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: "Portefeuille non enregistré côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}

export async function PATCH(req: Request): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  let body: { id?: unknown; name?: unknown; projectIds?: unknown; archived?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return Response.json({ error: "Identifiant manquant." }, { status: 400 });

  const patch: Partial<Portfolio> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, MAX_NAME);
    if (!name) return Response.json({ error: "Le nom ne peut pas être vide." }, { status: 400 });
    patch.name = name;
  }
  if (body.projectIds !== undefined) patch.projectIds = cleanProjectIds(body.projectIds);
  if (typeof body.archived === "boolean") patch.archived = body.archived;

  try {
    let found = false;
    const next = await store.updatePortfoliosAtomically((portfolios) => {
      const index = portfolios.findIndex((p) => p.id === id);
      if (index === -1) return null;
      found = true;
      const copy = [...portfolios];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
    if (!found) return Response.json({ error: "Portefeuille introuvable." }, { status: 404 });
    return Response.json(next.find((p) => p.id === id));
  } catch (e) {
    return Response.json(
      { error: "Portefeuille non mis à jour côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  let body: { id?: unknown };
  try {
    body = (await req.json()) as { id?: unknown };
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return Response.json({ error: "Identifiant manquant." }, { status: 400 });

  try {
    let found = false;
    await store.updatePortfoliosAtomically((portfolios) => {
      if (!portfolios.some((p) => p.id === id)) return null;
      found = true;
      return portfolios.filter((p) => p.id !== id);
    });
    if (!found) return Response.json({ error: "Portefeuille introuvable." }, { status: 404 });
    // Aucun effet de bord : un portefeuille ne possède rien. Les projets qu'il
    // groupait sont intacts, et leurs objectifs avec eux.
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: "Portefeuille non supprimé côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
