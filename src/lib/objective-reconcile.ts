import "server-only";
import { reconcileObjectives } from "./objectives";
import type { Store } from "./store";
import type { Objective } from "./types";

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
 */
export async function reconcileObjectivesInStore(
  store: Store,
  nowIso: string = new Date().toISOString(),
): Promise<Objective[]> {
  return store.updateObjectivesAtomically((objectives, items) => {
    const next = reconcileObjectives(items, objectives, nowIso);
    return next === objectives ? null : next;
  });
}
