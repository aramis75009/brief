# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-09-07 · Refonte v2 : le prototype Claude Design est en code

| | |
|---|---|
| **Agent** | **Claude Code (Opus 5)**. Je garde la main (passation précédente : moi-même, 05/09). |
| **Branche** | `feat/refonte-v2`, 7 commits. **Pas de PR ouverte, rien de poussé.** |
| **Base** | `origin/main` @ `fcdcf17`. |
| **Prod** | **inchangée** — `3a1ea3e`, v1.2.1.0. Rien de cette refonte n'est déployé. |

## Goal

Aramis a fait produire par Claude Design un prototype de refonte complète
(`docs/brief-refonte-v2.dc.html`, importé du projet
`de78eee2-0a67-4d78-8ed2-f8f84c12affb`). Sa consigne : **« c'est pile ce dont
j'avais besoin, il faut tout intégrer »**, en gardant la première tuile et le
donut/avancement semaine de l'accueil v1, et le graphe dans la sidebar.

Consigne d'exécution, mot pour mot : *« je préfère que tu fasses tout et que tu
te corriges ensuite »*, et *« ce que je n'aimerais pas, c'est que tu fasses bien
toutes les implémentations, mais que rien ne fonctionne »*.

## Current state — livré et vérifié en local, PAS déployé

La spec de conception est dans
[`docs/superpowers/specs/2026-09-07-refonte-v2-design.md`](docs/superpowers/specs/2026-09-07-refonte-v2-design.md).

**Navigation à deux axes** : `nav` (où) × `view` (comment). La nav horizontale à
sept onglets devient une sidebar à cinq entrées ; Calendrier, Kanban, Idées et
Objectifs cessent d'être des destinations pour devenir des vues.

| Sidebar | Contenu |
|---|---|
| Accueil | 1ʳᵉ tuile + donut « Avancement » **conservés de la v1** |
| Boîte de réception | onglets Activité (journal) et À trier (les idées) |
| Mes tâches | Liste · Tableau · Calendrier (semaine **et** mois) · Tableau de bord · Fichiers |
| Portefeuilles | groupes de projets **+ objectifs** |
| Graphe | inchangé |
| *Projets* | mêmes vues **+ Chronologie** |

**Données** : `Item.startDate` (le seul ajout structurant — sans lui, quatre vues
sur six ne peuvent pas rendre une plage), `Item.attachments[]`, `portfolios.json`,
`inbox.json`. Le **statut est dérivé**, jamais stocké (`src/lib/status.ts`).

**La boîte de réception n'est pas une coquille** : cinq producteurs sont câblés
sur des écritures réelles — rappel envoyé, adoption CalDAV, tâche débloquée,
dictée structurée, objectif atteint tout seul.

**Mobile** : l'accueil correspondait déjà au prototype. Ajoutés :
`MyTasksScreen`, `ProjectsScreen`, et une nav basse dont le FAB dit **Dicter**.

## Decisions

1. **Le statut est dérivé, pas stocké.** Le prototype le montre comme une
   colonne de données. Stocké, il pourrit : une tâche « Dans les délais » dont
   l'échéance est passée hier s'afficherait en vert.
2. **Les « sections » du prototype SONT le Kanban existant** (`columnId`) —
   pas un champ parallèle. Glisser une carte dans le Tableau déplace la ligne
   dans la Liste, gratuitement.
3. **Quatre priorités, pas trois.** Le prototype n'en montre que trois ; Brief
   a `1|2|3|4` avec 1 = la plus haute (RFC 5545). Écraser 4 sur 3 créerait la
   seconde échelle que `types.ts` interdit.
4. **Objectifs fusionnés dans Portefeuilles**, comme Aramis le proposait.
   `Objective.projectId` existe déjà, un portefeuille groupe des projets : la
   chaîne se fait sans rien inventer. Création, atteinte, réouverture et
   suppression sont toutes reprises — l'écran Objectifs supprimé n'emporte
   aucune fonction.
5. **Le partage de projet entre comptes est hors périmètre.** Brief est
   multi-compte depuis le 31/08, mais `storeForUser` lit `users/<userId>/` :
   aucune donnée n'est visible d'un compte à l'autre. Le but d'Aramis
   (travailler à trois) demande une couche de partage qui n'existe pas. Le
   champ « Responsable » affiche le titulaire et n'est pas assignable.
6. **La Chronologie n'existe que dans un projet.** Hors projet, elle
   empilerait les barres de huit projets sans rapport sur une même grille.

## Trois bugs préexistants trouvés en chemin

1. **Huit tokens CSS n'existaient pas.** `--color-error`, `--color-action`,
   `--color-action-lo`, `--color-warn`, `--color-page`, `--color-ink-2`,
   `--color-ink-3` — vestiges du système corail, référencés dans `due.ts` et
   `projects.ts`, jamais définis. Une `var()` sans repli **annule** la
   déclaration : les badges d'échéance et les pastilles de priorité n'avaient
   aucune des couleurs que leur code annonce. Zéro erreur, zéro test rouge.
   Commande d'audit dans `DESIGN.md` § Pièges.
2. **`coerce()` jetait `dependsOn`, `tags` et `objectiveId` à la création.**
   `POST /api/items` répondait 200 et la dépendance n'existait nulle part.
   Trouvé parce que la Chronologie s'est mise à dessiner les flèches et n'en
   trouvait aucune. `sanitizePatch` (PATCH), lui, les gardait — d'où
   l'invisibilité.
3. **Deux couleurs de PROJET servaient de fond à des badges de priorité et
   d'échéance** (`--color-p4` violet Perso, `--color-p2` orange My Flip) : un
   badge « Demain » violet sans rapport avec le projet de la tâche.

## Blockers

Aucun sur le code.

### Deux branches non fusionnées bloquent des choses utiles

- **`docs/agent-recette-account`** (1 commit, `f1cf421`, aucune PR) — c'est la
  cause racine que la passation du 05/09 signalait déjà comme *toujours
  ouverte*. Tant que ce fichier n'est pas dans `main`, chaque agent redécouvre
  à ses frais que la recette authentifiée serait impossible. Elle ne l'est pas :
  je m'en suis servi toute la session.
- **`docs/passation-v1210-deployee`** (2 commits) portait la règle **« alias
  SSH `brief-vps`, jamais une IP en clair »**. Elle n'existait dans **aucun
  fichier de `main`** — un agent partant de `main` aurait bloqué son
  déploiement en silence. **Je l'ai récupérée sur cette branche**
  (`git checkout 37fa3b4 -- AGENTS.md docs/coordination.md scripts/coord/status.sh`) ;
  fusionner `feat/refonte-v2` la porte donc dans `main`.

## Next action

1. **Recetter à l'écran** — c'est le point où Aramis doit dire oui ou non. Le
   serveur de dev tourne sur `localhost:3100` ; se connecter avec le compte
   agent (`.env.local`, `BRIEF_AGENT_*`), ou avec son propre compte pour voir
   ses vraies données.
2. **Ouvrir la PR** puis déployer — via le webhook Hermes, avec `ssh brief-vps`,
   **jamais une IP**.
3. Différé, demandé par Aramis : **graphe ↔ objectifs façon n8n** (nœuds
   connectables pour créer des dépendances). Le graphe actuel est inchangé.
4. Toujours en attente : la cause qui a effacé la `rrule` de « Reposter 15
   articles » (`TODOS.md`, Dette connue), et les lots 2/3 du pivot
   multi-utilisateur.

## Validations

Lancées sur l'arbre final, sortie vue :

```
$ npx eslint .       → 0 erreur, 0 warning
$ npx tsc --noEmit   → 0 erreur
$ npx vitest run     → 728 passants, 1 skipped (52 fichiers)
```

Soit **+131 tests** (597 → 728) : `views.ts` (41), `status.ts` (32),
`inbox.ts` (19), portefeuilles + journal du store (14), `coerce` (11),
`plural` (5), `describePatch` (5), journal des rappels (4). Le total de 597
est celui de la passation du 05/09, mesuré sur la même base.

**Recette authentifiée sur le compte agent, faite et vue** — API en `curl` puis
navigateur (`/browse`, viewport 1600×1000 puis 393×852) :

| Vérifié | Résultat |
|---|---|
| `POST /api/portfolios` → `GET` | créé, relu, persisté |
| `startDate` sur un aller-retour | `startDate` conservé ; la Liste affiche « 9 – 11 sept » |
| Événement « dictée structurée » | apparu, français accordé |
| Événement « tâche débloquée » | apparu en cochant la dépendance |
| Dédoublonnage | décocher/recocher → **1** événement, pas 2 |
| Pièce jointe | déposée, relue, `Content-Disposition: attachment` + `nosniff` |
| Console navigateur | **0 erreur**, 0 requête en échec, sur les 8 écrans |
| Fiche en panneau | 452 px, **0 élément qui déborde** (mesuré au DOM) |

**NON LANCÉ — à ne pas croire fait :**

- **`npm run build`** — un `next dev` tourne sur 3100, la règle du repo
  l'interdit. Le build de production n'a jamais tourné sur ce code.
- **Rien n'est poussé ni déployé.** La prod est toujours en v1.2.1.0.
- **Aucune recette sur les données réelles d'Aramis** : tout s'est fait dans le
  store du compte agent. Les vues sont donc vérifiées sur 3 items, pas sur son
  vrai agenda.
- **La synchro CalDAV n'a pas tourné** sur ce code : le compte agent n'a pas
  d'identifiants Apple. Les événements de journal `caldav` sont donc testés
  unitairement (`describePatch`) mais **jamais vus partir en vrai**.
- **`VERSION` et `CHANGELOG.md` ne sont pas bumpés** — c'est le rôle de `/ship`.

**Reste dans le store du compte agent** (à supprimer quand ils n'ont plus
d'usage) : `it_recette_a`, `it_recette_b`, le portefeuille « Recette v2 », une
pièce jointe `tarifs.csv`, et l'`it_demo_push` de la session du 05/09.
