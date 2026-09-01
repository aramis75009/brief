import { requireMachineToken } from "@/lib/cron-auth";
import { sweepUsers } from "@/lib/cron-sweep";
import { runReminders } from "@/lib/reminders";
import { storeForUser, USER_ID_PATTERN } from "@/lib/store";
import { listAuthorizedUserIds } from "@/lib/supabase/admin";

export const runtime = "nodejs";
/** Un passage doit tenir largement dans la minute qui sépare deux appels. */
export const maxDuration = 50;
export const dynamic = "force-dynamic";

/**
 * Les comptes à traiter, avec un repli sur le seul propriétaire.
 *
 * ⚠️ POURQUOI CE REPLI. Avant le pivot, le chemin des rappels ne touchait que
 * le disque local. Il dépend maintenant de Supabase pour savoir quels comptes
 * existent — et `listAuthorizedUserIds()` LÈVE si la clé manque ou si l'API est
 * injoignable. Sans repli, une panne Supabase de trois minutes ne dégrade pas
 * le service : elle l'ÉTEINT, et aucun rappel ne part pour personne. Or le cron
 * n'imprime qu'un `curl` en échec — c'est précisément la panne muette contre
 * laquelle `AGENTS.md` met en garde : les notifications cessent d'arriver et
 * rien ne se voit.
 *
 * Le repli garde donc le propriétaire servi, ce qui couvre l'essentiel des
 * rappels réels, et le journal dit clairement qu'il est dégradé.
 */
function ownerFallback(cause: string): string[] {
  const owner = process.env.BRIEF_OWNER_USER_ID;
  const usable = Boolean(owner && USER_ID_PATTERN.test(owner));
  console.error(
    `[cron] liste des comptes inutilisable (${cause}) — ` +
      (usable
        ? "repli DÉGRADÉ sur le seul compte propriétaire"
        : "et pas de BRIEF_OWNER_USER_ID pour se replier : AUCUN rappel ne partira"),
  );
  return usable ? [owner as string] : [];
}

async function userIdsToSweep(): Promise<string[]> {
  let userIds: string[];
  try {
    userIds = await listAuthorizedUserIds();
  } catch (e) {
    return ownerFallback(e instanceof Error ? e.message : String(e));
  }

  // ⚠️ UNE LISTE VIDE N'EST PAS UNE RÉPONSE VALIDE, et c'est le mode de panne
  // le plus traître des deux : il ne lève pas. Une clé service-role pointée sur
  // le mauvais projet Supabase, une table renommée, une politique RLS qui
  // change — et l'appel réussit en rendant `[]`. Le balayage sort aussitôt, la
  // route répond `200 {users: 0}`, `curl -fsS` reste vert, et plus AUCUN rappel
  // ne part pour personne. Brief a au moins un compte par construction : celui
  // qui a déployé. Une liste vide est donc toujours une anomalie.
  if (!userIds.length) return ownerFallback("Supabase a rendu une liste vide");

  return userIds;
}

/**
 * Le budget laissé au balayage.
 *
 * ⚠️ CE N'EST PAS `maxDuration` QUI COMMANDE, c'est le client. Le conteneur
 * `cron` appelle avec `curl -fsS -m 30` (`docker-compose.yml`) : un passage qui
 * dépasse 30 s fait abandonner curl, qui journalise
 * `[cron] passage échoué` — alors que le serveur, lui, va au bout. Ce message
 * est le SEUL signal d'échec du déploiement ; le laisser tomber une fois par
 * minute sur un passage réussi le rendrait inutile pour toujours. Le budget
 * reste donc sous le `-m` du client, pas seulement sous `maxDuration`.
 */
const SWEEP_BUDGET_MS = 25_000;

/**
 * Passage du planificateur, appelé chaque minute par le cron du VPS :
 *
 *   * * * * * curl -fsS -H "Authorization: Bearer $BRIEF_CRON_TOKEN" \
 *               http://127.0.0.1:3000/api/cron/reminders >> /var/log/brief-cron.log 2>&1
 *
 * ⚠️ `BRIEF_CRON_TOKEN` reste GLOBAL et le restera : il déclenche un PASSAGE,
 * il ne désigne pas un utilisateur. Le passage, lui, parcourt tous les comptes
 * autorisés depuis le pivot multi-utilisateur du 2026-08-31. Seuls les jetons
 * `capture` et `digest` deviendront des jetons par compte (lot 2).
 *
 * Renvoie toujours un compte-rendu chiffré, PAR COMPTE. Un cron dont la sortie
 * est vide ne permet pas de distinguer « rien à faire » de « cassé depuis trois
 * jours ».
 */
async function handle(req: Request): Promise<Response> {
  const denied = requireMachineToken(req, "BRIEF_CRON_TOKEN");
  if (denied) return denied;

  const startedAt = Date.now();
  try {
    const userIds = await userIdsToSweep();
    const sweep = await sweepUsers({
      userIds,
      budgetMs: SWEEP_BUDGET_MS,
      // Un cran par minute : l'ordre tourne d'un passage à l'autre, donc aucun
      // compte n'est systématiquement le dernier servi.
      offset: Math.floor(startedAt / 60_000),
      run: (userId) => runReminders(storeForUser(userId)),
    });
    const durationMs = Date.now() - startedAt;

    // Journal structuré : c'est la seule trace d'un envoi côté serveur.
    for (const { userId, result } of sweep.runs) {
      console.log(
        `[cron] user=${userId} checked=${result.checked} due=${result.due} sent=${result.sent} ` +
          `advanced=${result.advanced} stale=${result.skippedStale} ` +
          `correctedToAnchor=${result.correctedToAnchor} failures=${result.failures.length}`,
      );
      for (const f of result.failures) {
        console.error(`[cron] user=${userId} échec ${f.id} : ${f.error}`);
      }
    }
    for (const f of sweep.failures) {
      console.error(`[cron] user=${f.userId} passage interrompu : ${f.error}`);
    }
    if (sweep.deferred.length) {
      console.warn(
        `[cron] budget atteint, ${sweep.deferred.length} compte(s) reporté(s) au passage suivant`,
      );
    }
    console.log(
      `[cron] users=${userIds.length} ok=${sweep.runs.length} ` +
        `failed=${sweep.failures.length} deferred=${sweep.deferred.length} ms=${durationMs}`,
    );

    return Response.json({ ...sweep, users: userIds.length, durationMs });
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
