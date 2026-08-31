import { requireMachineToken } from "@/lib/cron-auth";
import { sweepUsers } from "@/lib/cron-sweep";
import { runCalDavSync } from "@/lib/caldav";
import { storeForUser } from "@/lib/store";
import { listAuthorizedUserIds } from "@/lib/supabase/admin";

export const runtime = "nodejs";
/** Un passage doit tenir largement dans la fenêtre entre deux appels. */
export const maxDuration = 50;
export const dynamic = "force-dynamic";

/** Sous `maxDuration`, avec de la marge — voir le cron des rappels. */
const SWEEP_BUDGET_MS = 40_000;

/** Ce qu'un compte rend quand sa bascule « Calendrier Apple » est éteinte. */
type SkippedRun = { skipped: true; reason: "disabled" };

/**
 * Synchro Brief ↔ calendrier Apple (iCloud), déclenchée par le cron du VPS.
 *
 *   * * * * * curl -fsS -H "Authorization: Bearer ***" \
 *               http://127.0.0.1:3000/api/cron/caldav-sync >> /var/log/brief-cron.log 2>&1
 *
 * Le garde-fou interne (15 min) fait sortir SANS RÉSEAU si la dernière synchro
 * du compte date de moins d'un quart d'heure — le cron peut appeler chaque
 * minute sans marteler iCloud. Ce garde-fou est par compte depuis le
 * 2026-08-31 : partagé, la synchro d'un utilisateur ferait sauter celle de tous
 * les autres.
 *
 * ⚠️ Les IDENTIFIANTS iCloud, eux, restent globaux et mono-compte jusqu'au lot
 * 3 du pivot (`src/lib/caldav.ts`). En pratique, seul le compte propriétaire a
 * donc quelque chose à synchroniser aujourd'hui — mais l'itération est déjà en
 * place, et un compte sans données ne fait qu'un passage à vide.
 */
async function handle(req: Request): Promise<Response> {
  const denied = requireMachineToken(req, "BRIEF_CALDAV_TOKEN");
  if (denied) return denied;

  const startedAt = Date.now();
  try {
    const userIds = await listAuthorizedUserIds();
    const sweep = await sweepUsers<Awaited<ReturnType<typeof runCalDavSync>> | SkippedRun>({
      userIds,
      budgetMs: SWEEP_BUDGET_MS,
      offset: Math.floor(startedAt / 60_000),
      run: async (userId) => {
        const store = storeForUser(userId);

        // La bascule « Calendrier Apple » des Réglages, PAR COMPTE. On sort
        // AVANT tout appel réseau : couper la synchro doit vraiment cesser de
        // parler à iCloud, pas seulement jeter le résultat. Le cron continue
        // d'appeler chaque minute — c'est voulu, rallumer la bascule reprend
        // tout seul au passage suivant.
        const settings = await store.readSettings();
        if (!settings.caldavSync) return { skipped: true, reason: "disabled" };

        return runCalDavSync(store);
      },
    });
    const durationMs = Date.now() - startedAt;

    for (const { userId, result } of sweep.runs) {
      if ("reason" in result) {
        console.log(`[caldav] user=${userId} désactivé dans les Réglages — passage sauté`);
      } else if (result.skipped) {
        console.log(`[caldav] user=${userId} skipped nextSyncIn=${result.nextSyncInSec}s`);
      } else {
        console.log(
          `[caldav] user=${userId} calendar=${result.discoveredCalendar} ` +
            `desired=${result.desired} existing=${result.existing} put=${result.put} ` +
            `adopted=${result.adopted} deleted=${result.deleted} ` +
            `completedFromCalendar=${result.completedFromCalendar} ` +
            `externalAdopted=${result.externalAdopted} externalUpdated=${result.externalUpdated} ` +
            `externalCompleted=${result.externalCompleted} externalDeleted=${result.externalDeleted} ` +
            `failures=${result.failures.length}`,
        );
        for (const f of result.failures) {
          console.error(`[caldav] user=${userId} échec ${f.uid} : ${f.error}`);
        }
      }
    }
    for (const f of sweep.failures) {
      console.error(`[caldav] user=${f.userId} passage interrompu : ${f.error}`);
    }
    if (sweep.deferred.length) {
      console.warn(
        `[caldav] budget atteint, ${sweep.deferred.length} compte(s) reporté(s) au passage suivant`,
      );
    }

    return Response.json({ ...sweep, users: userIds.length, durationMs });
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
