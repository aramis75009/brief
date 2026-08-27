import { requireSession } from "@/lib/guard";
import { readItems } from "@/lib/store";
import type { Item } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recherche dans les items — titre, notes, et transcriptions vocales.
 *
 * GET /api/search?q=duval
 *
 * Cherche dans :
 * - `title` : le titre de l'item
 * - `notes` : les notes
 * - `audioOrigin.text` : le texte complet de la transcription d'origine
 * - `audioOrigin.highlight` : l'extrait surligné
 *
 * Retourne les items correspondants avec le type de match.
 */
export async function GET(req: Request): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase();

  if (!q) {
    return Response.json({ results: [], query: "" });
  }

  const items = await readItems();

  const results = items
    .filter((item) => {
      const title = item.title.toLowerCase();
      const notes = (item.notes || "").toLowerCase();
      const audio = item.audioOrigin;
      const audioText = audio ? (audio.text + " " + audio.highlight).toLowerCase() : "";
      return title.includes(q) || notes.includes(q) || audioText.includes(q);
    })
    .map((item) => ({
      ...item,
      matchIn: getMatchIn(item, q),
    }));

  return Response.json({ results, query: q });
}

function getMatchIn(item: Item, q: string): string[] {
  const matches: string[] = [];
  if (item.title.toLowerCase().includes(q)) matches.push("title");
  if (item.notes && item.notes.toLowerCase().includes(q)) matches.push("notes");
  if (item.audioOrigin) {
    if (item.audioOrigin.text.toLowerCase().includes(q)) matches.push("transcript");
    if (item.audioOrigin.highlight.toLowerCase().includes(q)) matches.push("highlight");
  }
  return matches;
}