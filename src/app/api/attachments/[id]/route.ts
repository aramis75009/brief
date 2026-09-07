import { requireStore } from "@/lib/guard";
import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

/**
 * Sert et supprime une pièce jointe.
 *
 * L'`id` est le NOM DU FICHIER sur disque : une donnée venue de la requête
 * entre donc dans un chemin, ce qui n'arrive qu'à deux endroits dans tout le
 * projet (l'autre est la résolution du compte, dans `store.ts`). D'où le motif
 * strict ci-dessous — sans lui, `../../items.json` serait un identifiant
 * valide.
 *
 * Le cloisonnement tient par le répertoire, pas par l'id : `store.attachmentsDir()`
 * est celui du compte connecté, donc l'id d'un autre compte donne un 404 — pas
 * son contenu. Les ids sont énumérables, c'est ce qui rend ce point critique.
 */

const ID_PATTERN = /^att_[a-z0-9]+$/i;

/**
 * Les types servis en ligne. Tout le reste part en téléchargement forcé.
 *
 * Un SVG ou un HTML rendu en ligne s'exécuterait dans l'origine de Brief :
 * un fichier déposé deviendrait du script capable de lire la session. La
 * liste est donc une liste BLANCHE, et `image/svg+xml` n'y est délibérément
 * pas.
 */
const INLINE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  // La métadonnée fait foi : un fichier présent sur disque mais rattaché à
  // aucun item n'est pas servi. C'est ce qui empêche un reliquat d'écriture
  // interrompue de rester lisible.
  const items = await store.readItems();
  const meta = items
    .flatMap((it) => it.attachments ?? [])
    .find((a) => a.id === id);
  if (!meta) return Response.json({ error: "Pièce jointe introuvable." }, { status: 404 });

  let buf: Buffer;
  try {
    buf = await readFile(join(store.attachmentsDir(), id));
  } catch {
    return Response.json({ error: "Pièce jointe introuvable." }, { status: 404 });
  }

  const inline = INLINE_MIME.has(meta.mime);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": inline ? meta.mime : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${meta.name}"`,
      // `private` : jamais dans un cache partagé — c'est le fichier d'un compte.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const items = await store.readItems();
  const owner = items.find((it) => (it.attachments ?? []).some((a) => a.id === id));
  if (!owner) return Response.json({ error: "Pièce jointe introuvable." }, { status: 404 });

  // La métadonnée part EN PREMIER. Dans l'autre ordre, un échec du retrait
  // laisserait une pièce listée dont le fichier n'existe plus — un 404 au clic
  // sans moyen de la faire disparaître.
  try {
    await store.patchItem(owner.id, {
      attachments: (owner.attachments ?? []).filter((a) => a.id !== id),
    });
  } catch (e) {
    return Response.json(
      { error: "Pièce jointe non détachée.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }

  // Le fichier orphelin ne coûte que de la place, et plus rien ne le sert
  // (le GET ci-dessus exige la métadonnée). Son échec ne doit pas faire
  // échouer une suppression déjà effective côté données.
  await unlink(join(store.attachmentsDir(), id)).catch(() => {});

  return Response.json({ ok: true, id });
}
