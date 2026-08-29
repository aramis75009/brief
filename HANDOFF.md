# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-08-29 (nuit) · Occurrences manquées visibles — sprint stabilisation 1/2

| | |
|---|---|
| **Agent** | **Hermes Agent · glm-5.3** — reprise en autonomie |
| **Branche** | `main` (HEAD `a123ca5`) — unique branche |
| **Prod** | **Déployée** (`a123ca5`), conteneur Healthy, `/` et `/landing` 200 |

## Goal — l'objectif

Sprint « stabiliser avant de construire » (décision Aramis 29/08 soir) :
corriger les bugs des tâches récurrentes que vivait Aramis, puis seulement
attaquer les chantiers (projets & objectifs). Deux bugs décrits par Aramis,
reproduits sur ses **vraies données de prod** avant correction.

## Current state — ce qui a été fait

1. **Bug « avancement sport 5/6 »** — cause racine : la coche du pull du
   vendredi 28 n'a jamais été enregistrée, et AUCUNE vue ne permettait de
   la rattraper : le `due` d'une récurrente pointe toujours la prochaine
   occurrence, donc jamais « en retard », et les occurrences manquées
   n'existaient nulle part. Fix : `missedOccurrences()` +
   `overdueRows()` (une ligne « en retard » PAR occurrence manquée, jour
   fini, non couverte par `lastCompletedOccurrenceAt`). La coche d'une
   ligne transmet l'occurrence précise (`completedAt`) → `completionPatch`
   avance la série → l'avancement de la semaine passe (rejoué sur données
   prod : cocher le pull du 28 fait passer sport à 6/6).
2. **Bug « vue Tâches & RDV brouillon »** — trois causes dans
   `weekOccurrenceRows` : (a) injection du `due` courant quand la série
   était épuisée dans la semaine → RDV de la semaine SUIVANTE au milieu de
   la vue (le « 28, puis 31, puis 2 ») — supprimée ; (b) occurrences
   cochées masquées → maintenant visibles (grisées/barrées par
   occurrence, filtrables « Faites ») ; (c) manquées d'avant la semaine
   (fenêtre 7 j) ajoutées comme lignes en retard. Rejoué sur prod : vue
   sport = 24, 25, 26, 27, 28, 30 chronologique propre.
3. **Filtre d'état par occurrence** (`filterRowsByState`) : « En retard » /
   « Faites » se lisent sur l'occurrence, plus sur l'item.
4. **DesktopTasks** : badge « En retard · » rouge par ligne, état cochable
   par occurrence. **DesktopDashboard** : compteur « en retard »
   occurrence-based (héro + carte), 6 lignes au lieu de 3.
5. **Kanban** : la barre « Non placées » respecte le filtre projet (la
   variable filtrée existait, jamais branchée).
6. **`tagColors.ts`** : palette des tags centralisée (4 copies
   divergentes), « orange » corrigé (#FFCC00 était un jaune → #FF9500),
   alignée sur les teintes du design system. Les clés persistées dans
   `tags.json` n'ont pas changé.
7. **Découvert déjà corrigé ailleurs** : le `<button>` imbriqué de
   `TodayRow` était déjà fixé (commentaire dans HomeScreen.tsx) ; le
   bouton « Rien à structurer » n'existe plus. TODOS.md à jour.

## Decisions — choix critiques

- **« Fait jusqu'à maintenant » conservé** : une coche couvre toutes les
  occurrences antérieures (sémantique historique, alignée
  `reminders.ts`/`completion.ts`). Le filet « en retard » n'attrape que les
  occurrences POSTÉRIEURES à la dernière coche — test dédié au cas réel
  du ven 28.
- **Le manqué d'avant la semaine est borné à 7 jours** dans la vue
  Tâches & RDV (au-delà : dashboard « En retard » seulement). Limite la
  pollution sans cacher le rattrapage.
- **L'occurrence d'aujourd'hui n'est jamais « manquée »** tant que son jour
  n'est pas fini — on ne marque pas en retard un RDV du soir à 14 h.
- **Compteur overview serveur non touché** (`/api/overview` garde sa
  définition) : le dashboard calcule désormais son retard localement,
  occurrence-based. Harmonisation serveur = travail futur si besoin.

## Validations

| Étape | État |
|---|---|
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npx vitest run` | ✅ **378/378** (dont 41 sur la lib dashboard, 6 nouveaux) |
| `npx eslint .` | ✅ 0 erreur (warnings préexistants) |
| `npm run build` | ✅ standalone OK |
| **Rejeu données de prod** | ✅ pull ven 28 attrapé en retard ; vue sport propre ; plus de lignes semaine suivante |
| Prod VPS | ✅ `a123ca5` déployé, Healthy, `/` + `/landing` 200 |

## Next steps

1. **Aramis recette sur son usage réel** : ouvrir le dashboard, cocher le
   pull du vendredi 28 depuis « En retard » → sport doit passer 6/6.
   Signaler tout autre écart constaté (sprint stabilisation 2/2 si besoin).
2. **Sprint 2 : chantier projets & objectifs** (demande Aramis) sur la
   base saine.
3. Bugs P1 restants (non rencontrés par Aramis ce jour) : micro PWA iOS
   capricieux au 1er accès ; drag & drop Kanban edge cases.
4. Micro-dette : harmoniser le compteur « en retard » serveur
   (`/api/overview`) avec la définition occurrence-based si le récap
   Telegram doit suivre.

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-29 (nuit) | Occurrences manquées visibles — stabilisation 1/2 | Hermes Agent | (cette passation) |
| 2026-08-29 (soir) | Landing SaaS `/landing` + logo vectoriel — déployé prod | Hermes Agent | [fiche](docs/handoffs/2026-08-29-landing-saas-deployee.md) |
| 2026-08-29 (fin aprem) | Finitions du ménage + prod alignée sur `main` | Hermes Agent | [fiche](docs/handoffs/2026-08-29-finitions-menage-prod-alignee.md) |
| 2026-08-29 | Grand ménage du repo — main redevient la source de vérité | Hermes Agent | [fiche](docs/handoffs/2026-08-29-grand-menage-repo.md) |