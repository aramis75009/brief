import { requireMachineToken } from "@/lib/cron-auth";
import { runCalDavSync } from "@/lib/caldav";

export const runtime = "nodejs";
/** Un passage doit tenir largement dans la fenêtre entre deux appels. */
export const maxDuration = 50;
export const dynamic = "force-dynamic";

/**
 * Synchro Brief → calendrier Apple (iCloud), déclenchée par le cron du VPS.
 *
 *   * * * * * curl -fsS -H "Authorization: Bearer ***" \
 *               http://127.0.0.1:3000/api/cron/caldav-sync >> /var/log/brief-cron.log 2>&1
 *
 * Le garde-fou interne (15 min) fait sortir la route sans réseau si la
 * dernière synchro date de moins d'un quart d'heure — le cron peut appeler
 * chaque minute sans marteler iCloud.
 */
async function handle(req: Request): Promise<Response> {
  const denied = requireMachineToken(req, "BRIEF_CALDAV_TOKEN");
  if (denied) return denied;

  const startedAt = Date.now();
  try {
    const run = await runCalDavSync();
    const durationMs = Date.now() - startedAt;

    if (run.skipped) {
      console.log(`[caldav] skipped nextSyncIn=${run.nextSyncInSec}s ms=${durationMs}`);
    } else {
      console.log(
        `[caldav] calendar=${run.discoveredCalendar} desired=${run.desired} ` +
          `existing=${run.existing} put=${run.put} adopted=${run.adopted} ` +
          `deleted=${run.deleted} failures=${run.failures.length} ms=${durationMs}`,
      );
    }
    for (const f of run.failures) console.error(`[caldav] échec ${f.uid} : ${f.error}`);

    return Response.json({ ...run, durationMs });
  } catch (e) {
    console.error("[caldav] passage interrompu :", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Passage interrompu." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;