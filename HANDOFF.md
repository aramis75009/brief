# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-09-07 (soir) · V2 déployée + collaborateurs en prod

| | |
|---|---|
| **Agent** | **Hermes** (glm-5.3). Je garde la main sur les retouches ; le flux de design est **Claude Design → validation Aramis → Claude Code + MCP** (voir « Règles »). |
| **main** | `8de001d` — **déployé en prod**, conteneur Healthy, `GET /api/collaborateurs` et `/api/assigned` répondent 200. |
| **Prod** | `8de001d5` = main. Version affichée : `1.3.0.0` (pas de bump pour la feature collaborateurs — voir TODO ci-dessous). |
| **Branches** | Aucune branche de feature sur origin : `feat/v2-desktop` (l'essai abandonné d'Hermes) a été **supprimée** le 07/09 soir. Restent `docs/agent-recette-account` et `docs/passation-lot1-livre` (doc only, sans PR). |

## Règles nouvelles d'Aramis (07/09 soir) — s'y conformer

1. **Le « end-of » d'une réalisation Claude Design validée se fait
   OBLIGATOIREMENT avec Claude Code + MCP Claude Design.** Claude Design
   produit, Aramis valide, Claude Code intègre et passe la main ; Hermes
   prend les retouches, la QA, les bugs, l'implémentation.
2. **Les docs sont un livrable** : HANDOFF, DECISIONS, README doivent être à
   jour à chaque fin de session. Le README décrit ce que Brief EST
   réellement : **une application de gestion de projets et de tâches
   multi-utilisateurs** (plus un « organiseur personnel mobile-first »).
   Aujourd'hui deux comptes (Aramis + Hermes agent) ; d'autres viendront.

## Goal en cours

Aramis prépare avec Claude (Mac) un **prompt to-do list** détaillé pour les
tâches qui lui sont assignées. **Ne pas commencer ces tâches avant le prompt.**
Le chantier annoncé derrière : **passe de correction page par page** de tous
les irritants du client (ex : priorités qui « se mettent aléatoirement »,
champs non modifiables) — Aramis les liste précisément dans le prompt.

## Current state — tout est en ligne

1. **Refonte v2 (Claude Code) DÉPLOYÉE** le 07/09 : sidebar 5 entrées, Mes
   tâches à 5 vues + Chronologie dans les projets, portefeuilles, boîte de
   réception, `Item.startDate`, `attachments/`, `portfolios.json`,
   `inbox.json`. Vérifs faites : sidebar au DOM, `/api/portfolios` 200,
   0 erreur JS.
2. **Collaborateurs DÉPLOYÉS** le 07/09 soir (`8de001d`) : `Item.assigneeId`
   chez le propriétaire, `ownerUserId` posé au rendu, `lib/collaborators.ts`
   (parcours des comptes filtré sur la session, jamais sur un id client),
   `GET /api/collaborateurs`, `GET|POST /api/assigned` (la coche = l'unique
   écriture d'un assigné), sélecteur « Assignée à » dans la fiche desktop
   (propriétaire seul), badge « PARTAGÉE » côté assigné, `toggleDone` routé
   par `ownerUserId`. E2E 9/9 réel + 736 tests verts. Détail : entrée
   `2026-09-07` de DECISIONS.md.
3. **ÇA MARCHE EN VRAI** : Aramis a assigné 8 tâches (projet IA — correctifs
   d'affichage mobile/desktop, filtre tâches terminées, couleurs de statut,
   portefeuilles de test, suppression d'une slide bar mobile). Hermes les
   voit sur son compte agent via `/api/assigned` — le flux est prouvé.
4. `display_name` « Hermes (agent) » posé dans `authorized_users` (jamais lu
   avant cette feature).

## Next action

1. **Attendre le prompt to-do d'Aramis** (rédigé avec Claude Cowork sur son
   Mac — il fera `git pull` avant). Puis traiter les 8 tâches assignées une
   par une, **les cocher depuis le compte agent** à chaque validation.
2. Après ça : la passe QA page par page pilotée par le prompt (bugs de
   fluidité : priorités aléatoires, champs non modifiables, etc.).
3. À faire un jour : bump `VERSION`/`CHANGELOG` (la prod affiche 1.3.0.0
   alors que main contient la feature collaborateurs) ; fusionner
   `docs/agent-recette-account` (toujours pas de PR) ; lots 2/3 du pivot
   multi-utilisateur ; cause de la `rrule` effacée de « Reposter 15
   articles » (TODOS.md).

## Blockers

Aucun. Deux pièges de déploiement à ne pas réapprendre : `--env-file
.env.production` obligatoire ; `ssh brief-vps` jamais d'IP en clair (le scan
Hermes bloque le run en silence). `pull --ff-only`, jamais `reset --hard`.

## Leçons de la session

- Le store du dev local (`BRIEF_DATA_DIR` défaut `.data/`) n'est PAS celui du
  VPS : un E2E qui coche doit lire le store que le dev sert RÉELLEMENT, sinon
  il « échoue » alors que la feature marche. Toujours vérifier lequel des
  `.data/` ou `data/` le serveur lit avant de conclure.
- Le aria-label du bouton coche v2 est « Marquer « <titre> » comme faite » —
  pas « Marquer fait ». Un locator Playwright doit suivre le libellé réel.
- Les items partagés dont le projet n'existe pas chez l'assigné n'ont pas de
  pastille projet : le badge PARTAGÉE bleu reste le repère fiable.