# Réglages desktop — profil, store de réglages, fin du PIN fantôme

**Date** : 2026-08-30 (nuit) · **Agent** : Claude Code (Opus 5) · **Branche** :
`feat/reglages-desktop-profil` (empilée sur `feat/agenda-machine-token`)

---

## Le problème

Trois défauts distincts, tous signalés par Aramis le 30/08 :

1. **L'onglet Réglages affichait un « Verrou PIN »** — un mécanisme supprimé le
   2026-08-26 (auth = Supabase email + mot de passe). La bascule promettait un
   verrou qui n'existe plus.
2. **Les Réglages étaient un onglet de la nav**, alors qu'on les ouvre trois
   fois par mois. Aramis : « revoir la page réglages pour la mettre quand on
   clique sur le profil ».
3. **Les bascules ne faisaient rien.** Sur les quatre lignes de la section
   « Chaîne », une seule agissait (Rappels push). Les trois autres étaient des
   `useState` locaux qui ne survivaient pas à un rechargement — l'en-tête du
   fichier l'admettait en commentaire.

À quoi s'ajoute un trou qui n'avait été signalé par personne : **le desktop
n'avait aucun moyen de se déconnecter.** La seule sortie de session vivait dans
`AccountSheet`, le sheet mobile.

## Décisions (Aramis, 2026-08-30)

| Question | Décision |
|---|---|
| Portée du câblage | **Store de réglages complet** — `settings.json` + `/api/settings`. Pas de bascule décorative. |
| Navigation | **L'avatar ouvre l'écran Réglages**, l'onglet quitte la nav. |
| La ligne « Verrou PIN » | **Devient un bloc « Compte »** : adresse, changement de mot de passe, déconnexion. |
| Mobile | **Hors périmètre.** `AccountSheet` garde ses bascules décoratives, à reprendre quand le mobile redevient le sujet (`TODOS.md`). |

## Architecture

### `src/lib/settings.ts` — la logique pure

```ts
type Settings = { caldavSync: boolean; digest: boolean };
const DEFAULT_SETTINGS = { caldavSync: true, digest: true };
normalizeSettings(raw: unknown): Settings
applySettingsPatch(current: Settings, patch: unknown): Settings
```

**Portée volontairement étroite : deux booléens, pas un sac à préférences.** Un
réglage n'entre ici que s'il coupe un service qui tourne *sans surveillance*.
Une préférence d'affichage vit par appareil en localStorage — patron
`graphLayout.ts` / `queue.ts`.

**Les défauts sont ON, et ce n'est pas négociable.** `settings.json` peut être
absent : premier démarrage, volume Docker neuf, restauration partielle,
`BRIEF_DATA_DIR` mal pointé. Si l'absence valait OFF, un déploiement banal
couperait la synchro calendrier et le récap **en silence** — la classe de bug
que décrit `AGENTS.md`, celle qui ne lève rien.

`normalizeSettings` retombe sur le défaut champ par champ plutôt que de
convertir : `Boolean("false")` vaut `true` en JavaScript, croire une chaîne
allumerait un réglage que l'utilisateur venait d'éteindre.

`applySettingsPatch` rend la **même référence** quand rien ne change — même
convention que `reconcileObjectives`, pour que l'appelant saute l'écriture
disque.

### `src/lib/store.ts`

`readSettings()` et `updateSettingsAtomically(fn)`, calqués sur
`readObjectives` / `updateObjectivesAtomically` : même `readJson` / `writeJson`
atomique, même file d'écriture sérialisée.

### `src/app/api/settings/route.ts`

`GET` et `PATCH`, sous `requireSession()` **seule**. Un réglage est une
écriture, même quand il ne touche qu'un booléen : pas de jeton machine, et
surtout pas la garde mixte de `/api/agenda`, réservée à la lecture.

### Le câblage réel

| Bascule | Effet |
|---|---|
| **Calendrier Apple (CalDAV)** | `/api/cron/caldav-sync` sort **avant tout appel réseau** → `{ skipped: true, reason: "disabled" }`. Couper la synchro doit vraiment cesser de parler à iCloud, pas jeter le résultat. Le cron continue d'appeler ; rallumer reprend au passage suivant. |
| **Digest Telegram** | `/api/digest` rend `enabled: false` + listes vides, en **200** (un choix de l'utilisateur n'est pas une erreur, et un 4xx ferait sonner l'automate). |
| **Rappels push** | Inchangé — la seule qui marchait déjà. |

⚠️ **Limite assumée sur le digest** : c'est n8n qui ENVOIE le message. Brief
peut dire « désactivé », il ne peut pas retenir l'automate. Sans un nœud IF sur
`enabled` côté n8n, le récap partira quand même, vide. Action côté Aramis.

### Le bloc « Compte »

- **Adresse** — `/api/auth/session` rend désormais `{ authenticated, email }`,
  via un `readSessionClaims()` extrait de `guard.ts`. L'adresse vient des
  claims du JWT déjà vérifié, **jamais d'un champ posé par le client** : sinon
  n'importe quelle session valide demanderait la réinitialisation d'un autre
  compte.
- **Changer le mot de passe** → `POST /api/auth/forgot-password` avec cette
  adresse. Route existante, zéro backend neuf, réponse générique conservée.
- **Se déconnecter** → `logout()` remonté dans `BriefApp` et partagé entre le
  sheet mobile et l'écran desktop.

### Navigation

`NAV_ITEMS` perd « Réglages » (8 onglets → 7). `DesktopShell` passe
`onOpenAccount={() => setScreen("réglages")}` au bandeau ; le prop
`onOpenAccount` de `DesktopShell` disparaît au profit de `onLogout`.
L'avatar porte l'anneau d'état actif (`aria-current="page"`) quand l'écran
Réglages est ouvert : sans lui, on ouvre l'écran sans aucun repère de « où je
suis ».

L'écran reste **plein, en deux colonnes**. Destinations et Étiquettes sont de
vraies interfaces de gestion ; un sheet les rendrait inutilisables.

## Ce qui reste dehors

- `AccountSheet` mobile et ses trois bascules décoratives → `TODOS.md`.
- Aucune préférence d'affichage n'entre dans `settings.json`.
- Pas de test de composant : la logique testable vit dans `settings.ts`, le
  store et les routes.
