import { readSyncState } from "@/lib/caldav";
import { requireStore } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dernier passage CalDAV réel (`lastSyncAt` de `caldav-last-sync.json`) —
 * pour que l'écran Compte affiche l'âge réel de la synchro au lieu d'un
 * texte figé (« Synchronisé il y a 4 min », en dur jusqu'ici).
 */
export async function GET(_req: Request): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  const { lastSyncAt } = await readSyncState(store);
  return Response.json({ lastSyncAt: lastSyncAt > 0 ? lastSyncAt : null });
}
