# Passation — 2026-08-30 (session Hermes) · Chantier Objectifs & Projets codé, en attente de recette

> Archivée le 2026-08-30 (soir) par Claude Code en reprenant la main pour le
> chantier Graphe & Objectifs. `feat/objectifs-projets` a été mergé dans `main`
> (PR #2) entre-temps — la « recette en attente » ci-dessous a été absorbée.

| | |
|---|---|
| **Agent** | **Hermes Agent · kimi-k3 (Ollama Cloud)** — a repris la main depuis la passation pré-session (glm-5.3). |
| **Branche** | `feat/objectifs-projets` (HEAD `cbc4608`) — NON mergée, 2 commits devant `main` |
| **Prod** | **Inchangée** (`main @ 930b7dc`, conteneur Healthy) — la branche n'est **pas** déployée |
| **Recette en attente** | Aramis valide (1) le schéma Objectif, (2) l'UI (écran Objectifs, toggle Demain, graphe, fiche tâche), puis merge + déploiement. |

## Ce qui a été livré sur `feat/objectifs-projets`

Spec d'Aramis (29/08 soir, voir passation précédente) implémentée **en entier** :

1. **Objectifs liés aux projets, avec horizon** — modèle, stockage, API, UI.
   - Type `Objective { id, projectId, title, horizon: court|moyen|long,
     createdAt, achievedAt, notes? }`, fichier `objectives.json` (store
     atomique existant).
   - Lib pure `src/lib/objectives.ts` + 10 tests (progression, regroupement
     par projet trié court → moyen → long, arêtes graphe, slug).
   - API `/api/objectives` (GET/POST/PATCH/DELETE), `requireSession()`.
2. **Lien tâches → objectif** (`Item.objectiveId`, nullable, faible) :
   - `sanitizePatch` (`PATCH /api/items/[id]`) l'accepte.
   - Fiche tâche : sélecteur « Contribue à » filtré aux objectifs actifs du
     projet de l'item (desktop).
3. **Vue Asana** (point 3 de la spec) : nouvel écran **Objectifs** dans la nav
   desktop — groupes par projet, pastille d'horizon colorée, progression
   `done/total` + barre, tâches restantes cochables (elles avancent le
   pourcentage), création inline par projet, marquer atteint / supprimer.
4. **Dashboard « Demain »** (point 4) : la carte « Aujourd'hui » a une flèche
   circulaire qui bascule sur l'agenda de demain (fetch `/api/agenda?date=<J+1>`
   à la première bascule, gardé en cache pour la session). Pas de nouvelle
   carte — la spec demandait « flèche ou quelque chose dans le genre ».
5. **Graphe** : les objectifs actifs ayant au moins une tâche liée visible
   s'affichent comme des **nœuds dorés** (fond `#FFF8E6`, liseré `#B98A17`),
   placés à droite de la tâche la plus profonde qui y mène, avec arête
   pointillée dorée depuis chaque tâche liée. Le lien n'est **pas** bloquant
   (`graphStatus` ne lit que `dependsOn`) — décision inscrite dans
   `DECISIONS.md`. Les objectifs ne sont ni draggable ni cliquables (leur
   écran gère leur cycle de vie) ; un objectif sans tâche liée n'apparaît pas.

Validations : `tsc --noEmit` 0 erreur · `vitest run` **388/388** (30 fichiers,
dont les 10 neufs d'`objectives.test.ts`) · `npm run build` ✅ standalone, la
route `/api/objectives` figure bien au manifeste · `eslint` 0 erreur (1 warning
préexistant sur `OverdueRow` dans `DesktopDashboard.tsx`, laissé tel quel —
hors chantier).

## ⚠️ Décisions prises en autonomie (à relire par Aramis)

Le HANDOFF précédent demandait de faire valider le schéma avant de coder ;
la consigne de la session était « tout en autonomie ». Choix faits, inscrits
dans `DECISIONS.md` (entrée 2026-08-30 en tête) :

- Lien tâche → objectif **non bloquant** (le graphe ne rend « bloquée » que
  via `dependsOn`).
- Horizon par défaut « moyen » si non précisé à la création (API).
- Un objectif **atteint** disparaît des vues actives mais n'est jamais
  supprimé d'office (`achievedAt` timestampé).
- Les objectifs ne sont **pas** propagés à CalDAV (ce ne sont pas des items).
- La vue Objectifs est desktop-only (le mobile garde ses 5 écrans).

## Prochaine étape

1. Aramis recette sur la branche (`feat/objectifs-projets`) — il peut créer
   « Rejoindre la Web@cadémie » (horizon long, projet Web@cadémie), lier 2-3
   tâches via la fiche, vérifier le graphe et le toggle Demain.
2. Si validé : merge `feat/objectifs-projets` → `main`, push, puis déployer
   (`ssh root@186.241.16.37 'cd /docker/brief && git pull origin main &&
   docker compose --env-file .env.production up -d --build'` +
   `bash scripts/coord/status.sh`).
3. La recette en attente de la passation précédente (cocher le pull du ven 28
   fait passer Sport 5/6 → 6/6) reste d'actualité.

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-30 (session) | Chantier Objectifs & Projets codé, recette à faire | Hermes Agent | (cette passation) |
| 2026-08-30 (pré-session) | Stabilisation déployée + spec Objectifs & Projets | Hermes Agent | [fiche](docs/handoffs/2026-08-30-pre-session-spec-objectifs-projets.md) |
| 2026-08-29 (nuit) | Occurrences manquées visibles — stabilisation 1/2 | Hermes Agent | [fiche](docs/handoffs/2026-08-29-nuit-occurrences-manquees.md) |
| 2026-08-29 (soir) | Landing SaaS `/landing` + logo vectoriel — déployé prod | Hermes Agent | [fiche](docs/handoffs/2026-08-29-landing-saas-deployee.md) |
