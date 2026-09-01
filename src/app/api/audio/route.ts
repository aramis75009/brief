import { requireStore } from "@/lib/guard";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

/** Extension de fichier selon le mimeType produit par MediaRecorder. */
function extFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

export async function POST(req: Request): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Requête multipart invalide." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Aucun fichier audio reçu." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Enregistrement trop volumineux." }, { status: 413 });
  }

  const mimeType = String(form.get("mimeType") || file.type || "audio/webm");
  const ext = extFor(mimeType);

  // ⚠️ Le répertoire vient du STORE, jamais de `BRIEF_DATA_DIR` recomposé ici.
  // Jusqu'au 2026-08-31 il était global : n'importe quel compte autorisé
  // pouvait servir la dictée d'un autre par `GET /api/audio/<id>`, et les ids
  // (`audio_<timestamp base36>`) sont énumérables.
  const audioDir = store.audioDir();

  const id = `audio_${Date.now().toString(36)}`;
  const filename = `${id}.${ext}`;
  const finalPath = join(audioDir, filename);
  const tmpPath = `${finalPath}.${process.pid}.tmp`;

  try {
    await mkdir(audioDir, { recursive: true });
    const buf = await file.arrayBuffer();
    await writeFile(tmpPath, Buffer.from(buf));
    // rename est atomique sur un même système de fichiers
    await rename(tmpPath, finalPath);
  } catch (e) {
    return Response.json(
      {
        error: "Audio non enregistré côté serveur.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }

  return Response.json({ id, url: `/api/audio/${id}` });
}