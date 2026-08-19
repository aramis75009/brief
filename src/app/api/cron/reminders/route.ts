import { requireMachineToken } from "@/lib/cron-auth";
import { runReminders } from "@/lib/reminders";

export const runtime = "nodejs";
/** Un passage doit tenir largement dans la minute qui sépare deux appels. */
export const maxDuration = 50;
export const dynamic = "force-dynamic";

/**
 * Passage du planificateur, appelé chaque minute par le cron du VPS :
 *
 *   * * * * * curl -fsS -H "Authorization: Bearer $BRIEF_CRON_TOKEN" \
 *               http://127.0.0.1:3000/api/cron/reminders >> /var/log/brief-cron.log 2>&1
 *
 * Renvoie toujours un compte-rendu chiffré. Un cron dont la sortie est vide ne
 * permet pas de distinguer « rien à faire » de « cassé depuis trois jours ».
 */
async function handle(req: Request): Promise<Response> {
  const denied = requireMachineToken(req, "BRIEF_CRON_TOKEN");
  if (denied) return denied;

  const startedAt = Date.now();
  try {
    const run = await runReminders();
    const durationMs = Date.now() - startedAt;

    // Journal structuré : c'est la seule trace d'un envoi côté serveur.
    console.log(
      `[cron] checked=${run.checked} due=${run.due} sent=${run.sent} ` +
        `advanced=${run.advanced} stale=${run.skippedStale} ` +
        `correctedToAnchor=${run.correctedToAnchor} ` +
        `failures=${run.failures.length} ms=${durationMs}`,
    );
    for (const f of run.failures) console.error(`[cron] échec ${f.id} : ${f.error}`);

    return Response.json({ ...run, durationMs });
  } catch (e) {
    console.error("[cron] passage interrompu :", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Passage interrompu." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
