import "server-only";
import { reconcileObjectives } from "./objectives";
import { readItems, readObjectives, writeObjectives } from "./store";
import type { Objective } from "./types";

/**
 * Colle serveur : lit items + objectifs, applique `reconcileObjectives`, et
 * n'écrit `objectives.json` QUE si quelque chose a bougé (comparaison par
 * référence, élément par élément — `reconcileObjectives` garde l'identité des
 * objets inchangés).
 *
 * À appeler depuis une route API après toute mutation qui peut affecter la
 * complétion d'un objectif : coche/décoche d'une tâche, changement de
 * `dependsOn` ou `objectiveId` d'un item, édition des dépendances d'un objectif.
 *
 * La logique testable est dans `reconcileObjectives` (`objectives.ts`) — ici il
 * n'y a que de l'entrée/sortie, comme le reste de `store.ts`.
 */
export async function reconcileObjectivesInStore(
  nowIso: string = new Date().toISOString(),
): Promise<Objective[]> {
  const [items, objectives] = await Promise.all([readItems(), readObjectives()]);
  const next = reconcileObjectives(items, objectives, nowIso);
  const changed =
    next.length !== objectives.length || next.some((o, i) => o !== objectives[i]);
  if (changed) await writeObjectives(next);
  return next;
}
