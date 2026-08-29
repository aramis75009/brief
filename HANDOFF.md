# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-08-30 (pré-session) · Stabilisation déployée + SPEC chantier Objectifs & Projets

| | |
|---|---|
| **Agent** | **Hermes Agent · glm-5.3 (Ollama Cloud)** — Aramis continue avec ce même modèle dans la session qui suit. Session précédente : `20260829_174516_16a757` (TUI). |
| **Branche** | `main` (HEAD `f9880f5`) — unique branche, origin à jour |
| **Prod** | **Déployée** (`f9880f5`), conteneur Healthy, `/` + `/landing` 200, `status.sh` cohérent |
| **Recette en attente** | Aramis doit confirmer sur usage réel : cocher le pull du ven 28 (dans « En retard ») fait passer Sport 5/6 → 6/6. |

## État — sprint stabilisation 1/2 TERMINÉ et déployé (a123ca5 + f9880f5)

Bugs récurrents d'Aramis corrigés, reproduction sur ses **vraies données
de prod** (SSH → `docker exec brief-app-1 cat /app/data/items.json`) :

1. **Occurrences manquées visibles** : `missedOccurrences()` +
   `overdueRows()` dans `src/lib/desktopDashboard.ts` — une ligne
   « en retard » PAR occurrence manquée (jour fini, non couverte par
   `lastCompletedOccurrenceAt`). Cocher la ligne transmet l'occurrence
   précise (`completedAt`) → `completionPatch` avance la série.
2. **Vue Tâches & RDV saine** (`weekOccurrenceRows`) : plus d'injection du
   `due` courant (le « 28, 31, 2 »), occurrences cochées visibles
   (filtre « Faites » par occurrence), manquées ≤7 j avant la semaine
   visibles en retard, items faits simples limités à la semaine.
3. **`filterRowsByState`** : état lu par occurrence. **DesktopTasks** :
   badge « En retard · » rouge, coche par occurrence.
   **DesktopDashboard** : compteur « en retard » occurrence-based.
4. **Kanban** : « Non placées » respecte le filtre projet.
   **`tagColors.ts`** : palette tags centralisée (4 copies), orange fixé.

Validations : tsc 0 erreur · vitest **378/378** (41 sur la lib dashboard,
dont le test du cas réel ven 28) · build standalone OK · rejeu prod OK.

⚠️ Sémantique clé conservée : « fait jusqu'à maintenant » — une coche
couvre les occurrences antérieures. Le filet n'attrape que les
occurrences POSTÉRIEURES à la dernière coche.

⚠️ Compteur `/api/overview` (serveur) NON harmonisé — toujours
item-based. Si le récap Telegram doit montrer le retard occurrence-based,
c'est un chantier à part.

## NEXT CHANTIER — Objectifs & Projets (spec dictée par Aramis, 29/08 soir)

**Vision globale (rappel Aramis, `TODOS.md` P3 + DECISIONS.md)** : un
Asana personnel — Kanban, tags, sous-tâches, **dépendances visuelles
(graphe nœuds type n8n)**, dark mode à la fin. Priorité = Kanban.

**Ce qu'Aramis a demandé ce soir (spec à la lettre) :**

1. **Objectifs assignés à des projets**, avec horizon :
   - court terme / moyen terme / long terme.
   - Exemple donné par Aramis : **Web@cadémie → objectif « Rejoindre la
     Web@cadémie »** (projet `webacademie` dans prod).
2. **Des tâches à faire AVANT d'utiliser** la fonctionnalité qui crée les
   dépendances (comprendre : les tâches précèdent l'objectif et se
   relient en dépendances — voir le graphe existant
     `DependencyGraph.tsx`).
3. **Vue projet type Asana** : la vision « Asana perso » d'Aramis.
4. **Dashboard — « Demain »** : à l'endroit de la carte « Aujourd'hui »,
   ajouter la capacité de voir **l'étage de demain** (« flèche ou
   quelque chose dans le genre » — comprendre : navigation
   Aujourd'hui ↔ Demain sur la même carte, pas une nouvelle carte).
5. **Ensuite : vérifier que tout fonctionne bien** (recette complète,
   Aramis y veille).

**Où coder :**
- Modèle : `src/lib/types.ts` (Item), `store.ts`, `projects.ts` — un
  objectif est probablement un nouvel objet lié à un projet (pas un item :
  un objectif survit aux tâches, il les orchestre). À concecrire AVANT de
  coder — demander la validation du schéma à Aramis sur un petit exemple.
- API : routes `/api/projects` et probablement `/api/objectives` neuf.
- UI desktop : `DesktopDashboard.tsx` (carte Aujourd'hui → toggle
  Demain), `DesktopTasks.tsx` / nouvel écran « Objectifs », Kanban.
- La vision « Asana » desktop existe partiellement : Kanban, tags,
  sous-tâches, `DependencyGraph.tsx` — s'appuyer dessus.

**Règles du repo (AGENTS.md, à respecter scrupuleusement) :**
- GitHub = vérité. Avant de coder : `git fetch` + `bash
  scripts/coord/status.sh` + lire cette passation.
- Commits en anglais (`type: subject`) — convention Aramis.
- Toute route `/api/` commence par `requireSession()`.
- Aucun calcul de date hors `src/lib/zoned.ts` (Europe/Paris).
- Bouton mort → câbler une vraie feature, JAMAIS supprimer.
- Tests : la lib `desktopDashboard.test.ts` est le modèle du niveau
  attendu (occurrences, prod-replay). Chaque nouvelle logique pure a ses
  tests AVANT l'UI.
- Design : DESIGN.md + `docs/design-system-ref.dc.html` ; logo validé =
  `logo.svg` racine (3 barres pastel sur tuile encre — ne pas recréer).
- Aramis préfère qu'on lui **propose un exemple du résultat attendu**
  avant d'intégrer (correction explicite passée) — pour le schéma
  objectifs et l'UI « Demain », montrer d'abord une maquette/JSON.

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-30 (pré-session) | Stabilisation déployée + spec Objectifs & Projets | Hermes Agent | (cette passation) |
| 2026-08-29 (nuit) | Occurrences manquées visibles — stabilisation 1/2 | Hermes Agent | [fiche](docs/handoffs/2026-08-29-nuit-occurrences-manquees.md) |
| 2026-08-29 (soir) | Landing SaaS `/landing` + logo vectoriel — déployé prod | Hermes Agent | [fiche](docs/handoffs/2026-08-29-landing-saas-deployee.md) |
| 2026-08-29 (fin aprem) | Finitions du ménage + prod alignée sur `main` | Hermes Agent | [fiche](docs/handoffs/2026-08-29-finitions-menage-prod-alignee.md) |
| 2026-08-29 | Grand ménage du repo — main redevient la source de vérité | Hermes Agent | [fiche](docs/handoffs/2026-08-29-grand-menage-repo.md) |