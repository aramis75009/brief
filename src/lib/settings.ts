/**
 * Réglages de Brief — les interrupteurs posés sur la chaîne.
 *
 * PORTÉE VOLONTAIREMENT ÉTROITE : deux booléens, pas un sac à préférences.
 * Un réglage n'entre ici que s'il coupe ou rallume un service qui tourne
 * **sans surveillance** — la synchro CalDAV et le récap du matin. Une
 * préférence d'affichage n'a rien à y faire : elle vit par appareil, en
 * localStorage (même patron que `graphLayout.ts` et `queue.ts`).
 *
 * ⚠️ **Les défauts sont ON, et ça n'est pas négociable.** Le fichier
 * `settings.json` peut être absent : premier démarrage, volume Docker neuf,
 * restauration de sauvegarde partielle, `BRIEF_DATA_DIR` mal pointé. Si
 * l'absence de fichier valait OFF, un déploiement banal éteindrait la synchro
 * calendrier et le récap **en silence** — aucune erreur, aucun log, juste des
 * rendez-vous qui cessent d'arriver. C'est exactement la classe de bug que
 * `AGENTS.md` décrit : celle qui ne lève rien.
 *
 * Même raison pour la tolérance de `normalizeSettings` : un champ mal typé
 * retombe sur le défaut plutôt que d'être converti. `Boolean("false")` vaut
 * `true` en JavaScript — croire une chaîne allumerait un réglage que
 * l'utilisateur venait d'éteindre.
 */

export type Settings = {
  /**
   * La synchro bidirectionnelle CalDAV ↔ Apple Calendrier tourne-t-elle ?
   * OFF fait sortir `/api/cron/caldav-sync` **avant tout appel réseau** : le
   * cron continue d'appeler chaque minute, il ne se passe simplement rien.
   */
  caldavSync: boolean;
  /**
   * Le récap du matin est-il servi à l'automate qui l'envoie ?
   * OFF fait répondre `enabled: false` à `/api/digest`, listes vides.
   * ⚠️ C'est n8n qui ENVOIE le message — Brief peut dire « désactivé », il ne
   * peut pas empêcher l'envoi. Sans un test sur `enabled` côté n8n, le récap
   * partira quand même, vide.
   */
  digest: boolean;
};

export const DEFAULT_SETTINGS: Settings = { caldavSync: true, digest: true };

/** Les clés reconnues, dans l'ordre du type. Une clé absente d'ici est ignorée. */
const KEYS = ["caldavSync", "digest"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Ce que le disque contient, ramené à des réglages utilisables — jamais une
 * exception, jamais un `undefined`. Champ par champ : un réglage illisible ne
 * doit pas emporter l'autre avec lui.
 */
export function normalizeSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };
  const out = { ...DEFAULT_SETTINGS };
  for (const key of KEYS) {
    if (typeof raw[key] === "boolean") out[key] = raw[key];
  }
  return out;
}

/**
 * Applique un `PATCH` venu du réseau — donc de forme inconnue.
 *
 * Rend la **même référence** quand rien ne change, pour que l'appelant saute
 * l'écriture disque (même convention que `reconcileObjectives`) : cliquer deux
 * fois sur une bascule déjà dans le bon état ne doit pas réécrire le fichier.
 */
export function applySettingsPatch(current: Settings, patch: unknown): Settings {
  if (!isRecord(patch)) return current;
  let next: Settings | null = null;
  for (const key of KEYS) {
    const value = patch[key];
    if (typeof value !== "boolean" || value === current[key]) continue;
    next ??= { ...current };
    next[key] = value;
  }
  return next ?? current;
}
