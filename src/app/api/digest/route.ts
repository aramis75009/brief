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
 * ⚠️ **Jeton machine, surtout pas le PIN.** `x-brief-pin` ouvre TOUTES les
 * routes, y compris la création, la complétion, la suppression d'items et
 * `/api/transcribe` qui consomme la clé Groq. Un secret déposé dans un
 * planificateur doit se révoquer seul, sans obliger à changer le code qu'Aramis
 * tape sur son téléphone. Même raison que `/api/capture` et
 * `/api/cron/reminders`, chacun avec son propre jeton.
 *
 * Lecture seule, et volontairement : aucun `POST` ici. Le jour où un automate
 * devra écrire, ce sera une décision prise à ce moment-là, pas un effet de bord
 * d'une route de lecture.
 *
 * Le tri et le découpage se font côté serveur — voir `src/lib/digest.ts` pour
 * la raison (le fuseau de l'appelant n'est pas celui des échéances).
 */

export async function GET(req: Request): Promise<Response> {
  const denied = requireMachineToken(req, "BRIEF_DIGEST_TOKEN");
  if (denied) return denied;

  const [items, projects] = await Promise.all([readItems(), readProjects()]);
  return Response.json(buildDigest(items, projects, new Date()));
}
