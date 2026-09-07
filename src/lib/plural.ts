/**
 * Accord en nombre — français.
 *
 * ⚠️ **En français, zéro prend le SINGULIER** : « 0 tâche », pas « 0 tâches ».
 * C'est la règle que les gabarits `${n} tâche${n > 1 ? "s" : ""}` dispersés
 * dans les composants finissaient toujours par rater dans un sens ou dans
 * l'autre — d'où une seule fonction plutôt qu'une ternaire par écran.
 */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${n > 1 ? (pluralForm ?? `${singular}s`) : singular}`;
}

/** Le mot accordé, sans le nombre — pour un participe qui suit un décompte. */
export function agree(n: number, singular: string, pluralForm?: string): string {
  return n > 1 ? (pluralForm ?? `${singular}s`) : singular;
}
