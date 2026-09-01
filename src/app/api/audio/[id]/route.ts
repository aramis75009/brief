import { requireStore } from "@/lib/guard";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

export const runtime = "nodejs";

/**
 * Route GET — sert un fichier audio précédemment enregistré par POST /api/audio.
 *
 * L'`id` ne porte pas l'extension ; on cherche dans le répertoire audio DU
 * COMPTE le fichier dont le nom commence par `{id}.`. Le mimeType est retrouvé
 * à partir de l'extension. Un id qui appartient à un autre compte donne un 404,
 * pas son contenu.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  const { id } = await params;

  // L'id ne doit contenir que des caracteurs sûrs (alphanumériques + _)
  if (!/^audio_[a-z0-9_]+$/i.test(id)) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  // ⚠️ Le répertoire du COMPTE connecté. Global jusqu'au 2026-08-31, il rendait
  // les dictées de chacun lisibles par tous les comptes autorisés.
  const audioDir = store.audioDir();

  let files: string[];
  try {
    files = await readdir(audioDir);
  } catch {
    return Response.json({ error: "Audio introuvable." }, { status: 404 });
  }

  const match = files.find((f) => f.startsWith(`${id}.`));
  if (!match) {
    return Response.json({ error: "Audio introuvable." }, { status: 404 });
  }

  const ext = match.split(".").pop() || "webm";
  const contentType =
    ext === "m4a"
      ? "audio/mp4"
      : ext === "webm"
        ? "audio/webm"
        : ext === "ogg"
          ? "audio/ogg"
          : ext === "wav"
            ? "audio/wav"
            : "application/octet-stream";

  try {
    const buf = await readFile(join(audioDir, match));
    return new Response(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return Response.json({ error: "Audio introuvable." }, { status: 404 });
  }
}