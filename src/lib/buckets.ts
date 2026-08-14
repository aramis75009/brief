import { shiftDays, zonedParts, zonedTime } from "./zoned";

/**
 * Découpage du temps en « en retard / aujourd'hui / cette semaine », dans
 * `Europe/Paris`.
 *
 * Ce module existe pour qu'il n'y ait **qu'une seule définition d'aujourd'hui**
 * dans Brief. Elle vivait dans `src/app/api/overview/route.ts` ; quand
 * `/api/digest` a eu besoin du même découpage, la recopier aurait créé deux
 * notions du jour capables de diverger sans que rien ne le signale — la Vision
 * affichant « 3 en retard » pendant que le récap du matin en annonce 4.
 *
 * ⚠️ Aucune méthode locale de `Date` ici. Tout passe par `zoned.ts` : les
 * conteneurs tournent en UTC, et `setHours(0,0,0,0)` y donne 2 h du matin heure
 * de Paris l'été. Voir l'en-tête de `zoned.ts`.
 */

export type Bucket = "overdue" | "today" | "week" | "later" | "none";

/** Minuit à Paris, `offset` jours après le jour courant de `base`. */
export function midnightAt(base: Date, offset: number): Date {
  const { y, m, d } = shiftDays(zonedParts(base), offset);
  return zonedTime(y, m, d, 0, 0);
}

/**
 * Fabrique le classeur d'échéances pour un instant donné.
 *
 * Les trois bornes sont calculées une fois puis capturées : les appeler par
 * item ferait le travail de fuseau des milliers de fois pour le même résultat.
 *
 * Une échéance illisible tombe dans `none`, jamais dans une case approchée —
 * c'est la règle du projet : un rappel absent se voit, un rappel au mauvais
 * moment ne se voit pas.
 */
export function makeBucketOf(now: Date): (due: string | null) => Bucket {
  const today = midnightAt(now, 0);
  const tomorrow = midnightAt(now, 1);
  const inSevenDays = midnightAt(now, 7);

  return (due) => {
    if (!due) return "none";
    const d = new Date(due);
    if (Number.isNaN(d.getTime())) return "none";
    if (d < today) return "overdue";
    if (d < tomorrow) return "today";
    if (d < inSevenDays) return "week";
    return "later";
  };
}
