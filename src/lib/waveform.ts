/**
 * Mise à l'échelle des niveaux audio mesurés sur les barres dessinées.
 *
 * `useRecorder` produit 4 niveaux (une bande de fréquences chacune, plancher
 * 0.35 pour rester visible dans le silence), alors que le dessin de la waveform
 * compte 20 barres. Sans interpolation les barres bougeraient par blocs de
 * cinq : on verrait quatre marches, pas une onde.
 *
 * Fonction pure, dans un `.ts` et pas dans le composant, parce que la suite de
 * tests tourne en `environment: "node"` sans DOM — c'est le seul endroit où
 * cette logique est vérifiable automatiquement.
 */
export function levelForBar(levels: number[], index: number, total: number): number {
  if (levels.length === 0) return 1;
  if (levels.length === 1) return levels[0];

  const span = Math.max(1, total - 1);
  const position = (Math.min(index, span) / span) * (levels.length - 1);
  const low = Math.floor(position);
  const high = Math.min(levels.length - 1, low + 1);

  return levels[low] + (levels[high] - levels[low]) * (position - low);
}
