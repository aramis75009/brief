import "server-only";
import { reconcileObjectives } from "./objectives";
import type { Store } from "./store";
import type { InboxEvent, Objective } from "./types";

/**
 * Colle serveur : recalcule `achievedAt` des objectifs auto d'après l'état
 * courant des items, en une lecture-modification-écriture atomique
 * (`updateObjectivesAtomically`). N'écrit `objectives.json` que si quelque
 * chose a bougé.
 *
 * Le store est celui du compte qui a fait la mutation : réconcilier les
 * objectifs d'un autre compte serait invisible et faux.
 *
 * À appeler depuis une route API après toute mutation qui peut affecter la
 * complétion d'un objectif : coche/décoche d'une tâche, changement de
 * `dependsOn` ou `objectiveId` d'un item.
 *
 * La logique testable est dans `reconcileObjectives` (`objectives.ts`).
 *
 * Un objectif qui s'atteint TOUT SEUL (par convergence de ses dépendances)
 * part au journal : c'est précisément le fait qu'Aramis ne peut pas voir
 * autrement — personne n'a cliqué, et l'objectif change d'état pendant qu'on
 * cochait une tâche à l'autre bout de l'app.
 */
export async function reconcileObjectivesInStore(
  store: Store,
  nowIso: string = new Date().toISOString(),
): Promise<Objective[]> {
  let achieved: Objective[] = [];

  const next = await store.updateObjectivesAtomically((objectives, items) => {
    const updated = reconcileObjectives(items, objectives, nowIso);
    if (updated === objectives) return null;
    // Comparaison AVANT/APRÈS dans la même passe atomique : hors d'elle, deux
    // mutations concurrentes rendraient un « nouvellement atteint » faux.
    const before = new Map(objectives.map((o) => [o.id, o.achievedAt]));
    achieved = updated.filter(
      (o) => o.achievedAt && !before.get(o.id) && !o.achievedManually,
    );
    return updated;
  });

  if (achieved.length) {
    try {
      await store.appendInbox(achieved.map((o) => objectiveEvent(o, nowIso)));
    } catch {
      /* journal indisponible — l'objectif est atteint, c'est ce qui compte */
    }
  }

  return next;
}

/**
 * « Objectif atteint » — l'identifiant ne dépend QUE de l'objectif.
 *
 * Un objectif ne s'atteint qu'une fois ; s'il se rouvre puis se referme, on ne
 * republie pas la même ligne. C'est voulu : le journal raconte des faits
 * nouveaux, pas des oscillations.
 */
function objectiveEvent(objective: Objective, atIso: string): InboxEvent {
  return {
    id: `obj-${objective.id}`,
    kind: "objective",
    title: "Objectif atteint",
    body: `${objective.title} — toutes ses dépendances sont faites.`,
    at: atIso,
    readAt: null,
    projectId: objective.projectId,
  };
}
