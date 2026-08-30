/**
 * Âge du dernier passage CalDAV, en français.
 *
 * Sorti de `DesktopShell` le 2026-08-30 : l'écran Réglages va désormais
 * chercher lui-même `lastSyncAt` (il est atteint par l'avatar, plus par le
 * chemin qui alimentait cette valeur), et la fonction doit être partageable —
 * et testable sans monter de composant.
 *
 * ⚠️ `null` veut dire « on ne sait pas », et le texte le dit franchement.
 * C'est exactement le piège qui a produit un « jamais synchronisé » affiché
 * en prod alors que la synchro tournait toutes les 15 minutes : la valeur
 * n'était jamais allée la chercher. Une phrase rassurante par défaut
 * (« synchronisé ») aurait caché la panne au lieu de la montrer.
 */
export function relativeSyncLabel(lastSyncAt: number | null, now: number = Date.now()): string {
  if (lastSyncAt === null) return "jamais synchronisé";
  const minutes = Math.max(0, Math.round((now - lastSyncAt) / 60_000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}
