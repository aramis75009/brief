import "server-only";
import { reconcileObjectives } from "./objectives";
import { updateObjectivesAtomically } from "./store";
import type { Objective } from "./types";

/**
 * Colle serveur : recalcule `achievedAt` des objectifs auto d'après l'état
 * courant des items, en une lecture-modification-écriture atomique
 * (`updateObjectivesAtomically`). N'écrit `objectives.json` que si quelque
 * chose a bougé.
 *
 * À appeler depuis une route API après toute mutation qui peut affecter la
 * complétion d'un objectif : coche/décoche d'une tâche, changement de
 * `dependsOn` ou `objectiveId` d'un item.
 *
 * La logique testable est dans `reconcileObjectives` (`objectives.ts`).
 */
export async function reconcileObjectivesInStore(
  nowIso: string = new Date().toISOString(),
): Promise<Objective[]> {
  return updateObjectivesAtomically((objectives, items) => {
    const next = reconcileObjectives(items, objectives, nowIso);
    return next === objectives ? null : next;
  });
}
