import { readSyncState } from "@/lib/caldav";
import { requirePin } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dernier passage CalDAV réel (`lastSyncAt` de `caldav-last-sync.json`) —
 * pour que l'écran Compte affiche l'âge réel de la synchro au lieu d'un
 * texte figé (« Synchronisé il y a 4 min », en dur jusqu'ici).
 */
export async function GET(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  const { lastSyncAt } = await readSyncState();
  return Response.json({ lastSyncAt: lastSyncAt > 0 ? lastSyncAt : null });
}
