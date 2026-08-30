import { requireMachineToken } from "@/lib/cron-auth";
import { buildDigest } from "@/lib/digest";
import { readItems, readProjects } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Récap du jour pour un appelant machine — le retard et les échéances du jour.
 *
 * Sert un automate (n8n, un raccourci, un futur agent) qui met en forme et
 * envoie sur un canal que Brief n'a pas : WhatsApp, Telegram, un mail. Brief
 * sait déjà notifier par Web Push item par item ; ceci répond à une autre
 * question — « qu'est-ce qui pèse sur ma journée » — en un seul message.
 *
 * ⚠️ **Jeton machine, jamais la session utilisateur.** Un secret déposé dans
 * un planificateur (crontab, n8n, raccourci iOS) doit se révoquer seul, sans
 * invalider les sessions ouvertes ni obliger Aramis à se reconnecter partout.
 * Même raison que `/api/capture` et `/api/cron/reminders`, chacun avec son
 * propre jeton. (L'ancien PIN partagé, qui ouvrait TOUTES les routes d'un
 * coup — écriture et `/api/transcribe` comprises —, est supprimé depuis le
 * 2026-08-26 : c'est exactement ce qu'on ne voulait plus.)
 *
 * `BRIEF_DIGEST_TOKEN` ouvre AUSSI `GET /api/agenda` depuis le 2026-08-30 :
 * même portée (lecture seule), même révocation, un seul secret à distribuer
 * aux agents. Voir `docs/agent-calendar-access.md`.
 *
 * Lecture seule, et volontairement : aucun `POST` ici. Le jour où un automate
 * devra écrire, ce sera une décision prise à ce moment-là, pas un effet de bord
 * d'une route de lecture.
 *
 * Le tri et le découpage se font côté serveur — voir `src/lib/digest.ts` pour
 * la raison (le fuseau de l'appelant n'est pas celui des échéances).
 */

export async function GET(req: Request): Promise<Response> {
  const denied = requireMachineToken(req, "BRIEF_DIGEST_TOKEN", {
    allowQueryToken: true,
  });
  if (denied) return denied;

  const [items, projects] = await Promise.all([readItems(), readProjects()]);
  return Response.json(buildDigest(items, projects, new Date()));
}
