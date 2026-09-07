import { requireStore } from "@/lib/guard";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Attachment } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PER_ITEM = 20;
const MAX_NAME = 120;

/**
 * Pièces jointes — dépôt d'un fichier sur un item.
 *
 * ⚠️ Le répertoire vient du STORE (`store.attachmentsDir()`), jamais de
 * `BRIEF_DATA_DIR` recomposé ici. C'est exactement la faute que les deux
 * routes `/api/audio` portaient jusqu'au 2026-08-31 : elles satisfaisaient
 * l'invariant « toute route a une garde » tout en laissant n'importe quel
 * compte autorisé lire les fichiers d'un autre, parce que les ids sont
 * énumérables. `no-direct-store-access.test.ts` fige la règle.
 *
 * Il n'existe pas de pièce jointe sans item propriétaire : le fichier n'est
 * écrit sur le disque QUE si l'item existe, et l'enregistrement de la
 * métadonnée passe par le même chemin sérialisé que tout le reste.
 */

/** `att_<base36>` — sert AUSSI de nom sur disque, d'où le motif strict à la lecture. */
function newAttachmentId(): string {
  return `att_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Un nom de fichier affichable : on retire tout ce qui pourrait ressembler à
 * un chemin. Ce nom n'est JAMAIS utilisé pour écrire sur le disque (c'est
 * l'`id` qui l'est), mais il finit dans un en-tête HTTP au téléchargement.
 */
export function safeDisplayName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  // Caractères de contrôle, guillemet et antislash : ils cassent l'en-tête
  // `Content-Disposition` au téléchargement. Les espaces, eux, restent —
  // « grille tarifaire v3.pdf » doit rester lisible.
  const cleaned = base.replace(/[\u0000-\u001f\u007f"\\]/g, "").trim();
  return cleaned.slice(0, MAX_NAME) || "fichier";
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

  const itemId = String(form.get("itemId") ?? "").trim();
  if (!itemId) return Response.json({ error: "Item manquant." }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Fichier trop volumineux (20 Mo maximum)." }, { status: 413 });
  }

  const items = await store.readItems();
  const item = items.find((it) => it.id === itemId);
  if (!item) return Response.json({ error: "Item introuvable." }, { status: 404 });
  if ((item.attachments ?? []).length >= MAX_PER_ITEM) {
    return Response.json(
      { error: `Un item ne peut pas porter plus de ${MAX_PER_ITEM} pièces jointes.` },
      { status: 409 },
    );
  }

  const attachment: Attachment = {
    id: newAttachmentId(),
    name: safeDisplayName(file.name),
    mime: file.type || "application/octet-stream",
    sizeBytes: file.size,
    addedAt: new Date().toISOString(),
  };

  const dir = store.attachmentsDir();
  const finalPath = join(dir, attachment.id);
  const tmpPath = `${finalPath}.${process.pid}.tmp`;

  try {
    await mkdir(dir, { recursive: true });
    const buf = await file.arrayBuffer();
    await writeFile(tmpPath, Buffer.from(buf));
    // `rename` est atomique sur un même système de fichiers : un lecteur voit
    // le fichier complet ou rien, jamais un fichier à moitié écrit.
    await rename(tmpPath, finalPath);
  } catch (e) {
    return Response.json(
      { error: "Fichier non enregistré côté serveur.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }

  // La métadonnée n'est posée qu'APRÈS l'écriture réussie du fichier : une
  // pièce jointe listée dont le fichier manque donnerait un 404 au clic, sans
  // qu'on sache jamais si le dépôt a échoué ou si le fichier a disparu.
  try {
    const updated = await store.patchItem(itemId, {
      attachments: [...(item.attachments ?? []), attachment],
    });
    if (!updated) return Response.json({ error: "Item introuvable." }, { status: 404 });
    return Response.json({ attachment, item: updated }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: "Pièce jointe non rattachée à l'item.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}
