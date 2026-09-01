/**
 * Balayage des comptes pour les passages de cron.
 *
 * Les crons n'ont aucune session : ils ne travaillent pas « pour un
 * utilisateur », ils orchestrent tous les comptes. Ce module isole cette
 * orchestration pour qu'elle se teste sans disque, sans réseau et sans
 * Supabase — `runReminders` et `runCalDavSync`, eux, ne connaissent qu'un
 * store à la fois.
 *
 * DEUX PROPRIÉTÉS, toutes deux invisibles si elles manquent :
 *
 *   1. UN ÉCHEC EST ISOLÉ. Sans le try/catch par compte, un `items.json`
 *      corrompu chez UN utilisateur éteindrait les rappels de TOUS les autres
 *      — et la route continuerait de répondre 200.
 *
 *   2. L'ORDRE TOURNE. Si le budget de temps coupe toujours au même endroit,
 *      les derniers comptes ne seraient jamais traités et leurs rappels
 *      deviendraient `stale`, c'est-à-dire abandonnés silencieusement par
 *      `pendingReminders`. À quelques comptes c'est théorique ; la rotation
 *      coûte trois lignes et supprime la classe de bug.
 */

export type SweepResult<T> = {
  runs: { userId: string; result: T }[];
  failures: { userId: string; error: string }[];
  /** Comptes non traités faute de temps — repris au passage suivant. */
  deferred: string[];
};

export async function sweepUsers<T>(opts: {
  userIds: string[];
  /** Temps au-delà duquel on s'arrête et on reporte. Doit rester sous `maxDuration`. */
  budgetMs: number;
  run: (userId: string) => Promise<T>;
  /** Décale le point de départ. Un cran par passage suffit à faire tourner l'ordre. */
  offset?: number;
}): Promise<SweepResult<T>> {
  const { userIds, budgetMs, run, offset = 0 } = opts;
  const result: SweepResult<T> = { runs: [], failures: [], deferred: [] };
  if (!userIds.length) return result;

  const k = ((offset % userIds.length) + userIds.length) % userIds.length;
  const ordered = [...userIds.slice(k), ...userIds.slice(0, k)];

  const startedAt = Date.now();
  for (let i = 0; i < ordered.length; i++) {
    const userId = ordered[i];

    // Le PREMIER compte passe toujours : un budget mal réglé doit dégrader le
    // débit, jamais tout arrêter.
    // `>=` et non `>` : un budget de zéro veut dire « aucun temps disponible »,
    // pas « un temps infini ». Avec `>`, un budget nul et des passages
    // instantanés ne coupaient jamais.
    if (i > 0 && Date.now() - startedAt >= budgetMs) {
      result.deferred.push(...ordered.slice(i));
      break;
    }

    try {
      result.runs.push({ userId, result: await run(userId) });
    } catch (e) {
      result.failures.push({
        userId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
