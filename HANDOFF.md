# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-14 · Déploiement en prod et correctif projets invisibles

| | |
|---|---|
| **Agent** | Hermes Agent v0.20.0 · `deepseek/deepseek-v4-flash-0731` via OpenRouter |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits** | `e7676db` fix projets au premier chargement (poussé et déployé) |

## Goal — l'objectif

Déployer en production la branche `feat/task-completion` (correctifs de fuseau
de Claude + mes correctifs d'interface), et corriger un bug remonté par Aramis
sur son téléphone : les projets créés depuis (Perso, Sport) ne s'affichaient
pas dans Réglages.

## Current state — ce qui a été fait

- **`feat/task-completion` a été poussée sur `origin` et déployée sur le VPS**
  (`/docker/brief`), à la cible que sert Traefik. `brief-app` reconstruit,
  **healthy**, HTTPS 200 sur `https://brief.srv1899780.hstgr.cloud`.
- **Nouvelle passation consignée pour Claude (`docs/handoffs/2026-08-14-systeme-passation-et-fuseau.md`)** —
  la précédente passation a été archivée là, conformément au protocole.
- **Bug correctif :** au premier déverrouillage, Brief ne chargeait que les
  items et la vision (`refreshItems()`), jamais la liste des projets
  (`loadProjects()`). La liste restait à `SEED_PROJECTS` et les projets créés
  par Aramis — Perso, Sport — étaient invisibles jusqu'à un rechargement
  manuel ou une structuration. Correctif `e7676db`.

**Données vérifiées en prod :** le serveur renvoie bien les 5 projets
(frip-trend, my-flip, webacademie, perso, sport) via `GET /api/projects`. Le
problème était purement côté chargement initial du client.

## Decisions — choix critiques ou irréversibles

**Déployer directement sur `feat/task-completion`** (pas de branche `fix/`
séparée) : la prod vit sur cette branche et Aramis développe dessus ; c'est
elle qu'on déploie. Un aller-retour branche → merge → redeploy n'aurait rien
déplacé de plus, à ce stade où rien d'autre n'est en cours.

**Poursuivre le disque `fetch` → `curl` propre pour le diagnostic** : l'accès
aux données de prod passe par `docker exec brief-app-1 cat $BRIEF_DATA_DIR/…`
pour lire `projects.json` et `items.json`, sans jamais recopier de secret.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/components/BriefApp.tsx` | +9/−1 (au déverrouillage) : charger aussi `loadProjects({ silent: true })` pendant l'amorce, pour que les projets créés depuis la recette apparaissent dès la première ouverture |
| `HANDOFF.md` | réécrit — nouvelle passation (celle-ci) |
| `docs/handoffs/2026-08-14-systeme-passation-et-fuseau.md` | **créé** — archive de la passation de Claude (correctifs de fuseau) |
| `docs/handoffs/2026-08-14-saisie-clavier-et-edition-items.md` | déjà présent (les 10 correctifs de revue) |

## Validations — passants / échoués / non lancés

Lancées **après** le correctif, sur `src/components/BriefApp.tsx` :

| Commande | Résultat |
|---|---|
| `npx eslint src/components/BriefApp.tsx` | ✅ aucune erreur |
| `npx tsc --noEmit` | ✅ aucune erreur |
| `npx vitest run` | ✅ **74 passent** |

Déploiement vérifié :

| Vérification | Résultat |
|---|---|
| `docker compose up -d --build` (VPS) | ✅ `brief-app` Built, Recreated, Started, Healthy |
| `curl https://brief.srv1899780.hstgr.cloud` | ✅ HTTP 200 |
| `GET /api/projects` (prod) | ✅ renvoie les 5 projets |

**Non vérifié — et c'est ce qui reste à faire :**

- Le correctif projets n'a **pas été vu sur le téléphone** depuis le déploiement.
  À confirmer par Aramis : ouvrir l'app, aller dans Réglages → les projets
  Perso et Sport doivent apparaître **dès la première ouverture**, sans cliquer
  sur « Recharger les projets ».
- Aucun rappel réel n'a été déclenché depuis le correctif de fuseau (le
  comportement en production ne sera prouvé que par un rappel programmé qui
  sonne à l'heure attendue sur le VPS — « demain » doit sonner à 9 h, pas 11 h).
- Les correctifs d'interface (échéance effaçable, note qui grandit, saisie
  préservée) n'ont toujours pas été exercés dans un navigateur.

## Blockers — ce qui bloque

Rien. `feat/task-completion` est poussée, déployée et saine sur le VPS ; arbre
local propre.

## Next — la prochaine action

1. **Aramis vérifie sur le téléphone** : (a) les projets Perso et Sport
   apparaissent dans Réglages dès l'ouverture ; (b) un rappel « demain » sonne
   à 9 h et non 11 h ; (c) effacer une échéance depuis la fiche, et taper
   pendant une transcription sans que la frappe soit écrasée.
2. Reprendre le P1 de `TODOS.md` : l'autorisation micro que Safari redemande à
   chaque ouverture.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| 2026-08-14 | Déploiement prod + correctif projets invisibles | **Hermes** | [fiche](docs/handoffs/2026-08-14-deploiement-et-correctif-projets.md) |
| 2026-08-14 | Système de passation + correctif fuseau | Claude Code | [fiche](docs/handoffs/2026-08-14-systeme-passation-et-fuseau.md) |
| 2026-08-14 | Saisie clavier et modification des items | **Hermes** | [fiche](docs/handoffs/2026-08-14-saisie-clavier-et-edition-items.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |

Les fiches du 06 au 14 août sont **reconstruites depuis git** ou archivées à
chaud et le disent en en-tête. Les passations écrites à chaud portent cet
avertissement.