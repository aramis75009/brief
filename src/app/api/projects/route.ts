import { requirePin } from "@/lib/guard";
import { FALLBACK_PROJECTS } from "@/lib/todoist";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const TODOIST_PROJECTS = "https://api.todoist.com/api/v1/projects";
const TTL_MS = 60 * 60 * 1000; // 1 h
const TIMEOUT_MS = 10_000;

let cache: { at: number; projects: Project[] } | null = null;

/**
 * Normalise la réponse Todoist. L'API v1 renvoie `{ results: [...] }`, les
 * versions antérieures un tableau nu : on accepte les deux.
 *
 * ⚠️ `id` reste une chaîne. Aucun Number()/parseInt ici ni ailleurs.
 */
function normalize(payload: unknown): Project[] {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { results?: unknown }).results)
      ? ((payload as { results: unknown[] }).results as unknown[])
      : [];

  return rows
    .map((row) => {
      const r = row as { id?: unknown; name?: unknown };
      return { id: String(r.id ?? ""), name: String(r.name ?? "") };
    })
    .filter((p) => p.id && p.name);
}

export async function GET(req: Request) {
  const denied = requirePin(req);
  if (denied) return denied;

  if (cache && Date.now() - cache.at < TTL_MS) {
    return Response.json(cache.projects, { headers: { "x-brief-source": "cache" } });
  }

  const token = process.env.TODOIST_API_TOKEN;
  if (!token) {
    return Response.json(FALLBACK_PROJECTS, { headers: { "x-brief-source": "fallback" } });
  }

  try {
    const res = await fetch(TODOIST_PROJECTS, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Todoist a répondu ${res.status}`);

    const projects = normalize(await res.json());
    if (!projects.length) throw new Error("Aucun projet renvoyé");

    cache = { at: Date.now(), projects };
    return Response.json(projects, { headers: { "x-brief-source": "todoist" } });
  } catch (e) {
    // Repli silencieux : mieux vaut une liste figée qu'un écran bloqué.
    console.error("[projects]", e instanceof Error ? e.message : e);
    return Response.json(FALLBACK_PROJECTS, { headers: { "x-brief-source": "fallback" } });
  }
}
