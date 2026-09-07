import "server-only";
import { newlyUnblocked, unblockedEvent } from "./inbox";
import type { Store } from "./store";
import type { Item } from "./types";

/**
 * Journalise les tâches qu'une écriture vient de DÉBLOQUER.
 *
 * Vit dans `src/lib` et non dans une route : trois routes en ont besoin
 * (`PATCH /api/items`, `PATCH` et `DELETE /api/items/[id]`), et un `route.ts`
 * qui en importe un autre couple deux points d'entrée du routeur — ça
 * fonctionne, mais rien ne garantit que ça reste vrai d'une version de Next à
 * l'autre.
 *
 * `before` doit être lu AVANT la mutation. Sans la comparaison, chaque coche
 * annoncerait « débloquée » sur toutes les tâches prêtes du compte.
 *
 * L'échec n'échoue JAMAIS la requête : la mutation est déjà enregistrée, et
 * refuser ici ferait rejouer au client une écriture qui a réussi.
 */
export async function announceUnblocked(store: Store, before: Item[]): Promise<void> {
  try {
    const unblocked = newlyUnblocked(before, await store.readItems());
    if (!unblocked.length) return;
    const at = new Date();
    await store.appendInbox(unblocked.map((it) => unblockedEvent(it, at)));
  } catch {
    /* journal indisponible — la mutation est faite, c'est ce qui compte */
  }
}
