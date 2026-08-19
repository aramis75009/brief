# Passation — 2026-08-14 · Déploiement prod et correctif projets invisibles

> ⚠️ **Archivé à chaud le 2026-08-14** — passation écrite directement depuis
> HANDOFF.md par Hermes, pas reconstruite depuis git.

| | |
|---|---|
| **Agent** | Hermes Agent v0.20.0 · `deepseek/deepseek-v4-flash-0731` via OpenRouter |
| **Branche** | `feat/task-completion` — la branche que sert le VPS |
| **Commits** | `e7676db` fix projets au premier chargement · `c8507ec` docs handoff |

## Goal — l'objectif

Déployer en production `feat/task-completion` (correctifs de fuseau de Claude Code
+ correctifs d'interface), et corriger le bug remonté par Aramis : les projets
créés depuis (Perso, Sport) n'apparaissaient pas dans Réglages.

## Current state — ce qui a été fait

- **Déploiement prod réussi** : `brief-app` reconstruit, healthy, HTTPS 200.
- **Correctif `e7676db`** : l'amorce au premier déverrouillage ne chargeait que
  les items et la vision, jamais les projets. `loadProjects` est désormais
  appelé pendant l'amorce, donc les projets créés par Aramis apparaissent dès la
  première ouverture.
- **Vérifié serveur** : `GET /api/projects` renvoie les 5 projets ; le bug était
  uniquement côté chargement initial du client.
- **Passation mise à jour** : HANDOFF.md réécrit, celle de Claude archivée.

## Decisions

Déployer directement sur `feat/task-completion` (branche de prod), pas de
branche de correctif séparée. Lecture des données de prod via `docker exec … cat
$BRIEF_DATA_DIR/…`.

## Validations

- `npx eslint src/components/BriefApp.tsx` ✅
- `npx tsc --noEmit` ✅
- `npx vitest run` ✅ 74/74
- `docker compose up -d --build` ✅ healthy · HTTPS 200 · GET /api/projects ✅

**Non vérifié :** le correctif projets n'a pas été vu sur un téléphone depuis le
déploiement ; aucun rappel réel n'a sonné depuis le correctif de fuseau ; les
correctifs d'interface n'ont pas été exercés dans un navigateur.

## Blockers

Rien. Branche poussée, déployée, saine.

## Next

Aramis vérifie sur le téléphone : projets visibles dès l'ouverture, rappel
« demain » sonne à 9 h, échéance effaçable, frappe préservée pendant une
transcription. Puis P1 : autorisation micro que Safari redemande à chaque
ouverture (TODOS.md).