import { requirePin } from "@/lib/guard";
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
  const denied = requirePin(req);
  if (denied) return denied;

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

  const dataDir = process.env.BRIEF_DATA_DIR || join(process.cwd(), ".data");
  const audioDir = join(dataDir, "audio");

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