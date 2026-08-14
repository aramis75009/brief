# Passation — 2026-08-11 · Projets gérés depuis Réglages

> ⚠️ **Reconstruit a posteriori depuis git le 2026-08-14.** `Goal`, `Decisions`
> et `Blockers` sont déduits des diffs et de la réécriture de `TODOS.md`.
> `Changed` et `Validations` sont factuels.

| | |
|---|---|
| **Agent** | Claude Code |
| **Branche** | `main` |
| **Commits** | `bd9c324`, `3daf04b`, `46608d2`, `c69bceb` |

## Goal — l'objectif

Rendre les projets modifiables par l'utilisateur, et remettre `TODOS.md` en face
de l'architecture qui existe vraiment.

## Current state — ce qui a été fait

Les projets se créent, se renomment et se suppriment depuis l'écran Réglages.
Les projets codés en dur — « Inbox » et « La Table de Paupy » — ont disparu.
`src/lib/projects.test.ts` accompagne le changement : **c'est la première fois
que du code de Brief est couvert par des tests.**

Deux correctifs d'affichage iPhone : barre d'état sans couture, padding du logo.

`TODOS.md` réécrit à 173 lignes ajoutées / 47 supprimées, contre l'architecture
réellement livrée.

## Decisions — choix critiques ou irréversibles

**`output: "standalone"` est désactivé sur Vercel, conservé pour l'image VPS**
(`bd9c324`). Les deux cibles n'ont pas les mêmes besoins et une seule
configuration ne peut pas satisfaire les deux.

**Le journal de décisions ment sur deux points, et c'est acté par écrit** dans
`TODOS.md` : « Postgres » et un « flux `calendar.ics` en lecture seule » y sont
mentionnés alors que **ni l'un ni l'autre n'existe dans le code**. Consigné
plutôt qu'effacé, pour qu'un futur lecteur ne reconstruise pas une architecture
fantôme.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/app/api/projects/route.ts` | +98 — CRUD projets |
| `src/components/SettingsScreen.tsx` | +195 — gestion des projets |
| `src/lib/projects.ts` | refondu |
| `src/lib/projects.test.ts` | étendu — **premiers tests du projet** |
| `src/lib/store.ts` | ajusté |
| `src/app/api/{capture,items,parse}/route.ts` | adaptés |
| `next.config.ts` | `standalone` conditionnel |
| `src/components/{CaptureScreen,PhoneFrame,icons}.tsx` | correctifs iPhone |
| `TODOS.md` | réécrit |

## Validations — passants / échoués / non lancés

- **Passants :** `src/lib/projects.test.ts`.
- **Non vérifié :** toujours pas de preuve du Web Push sur iPhone verrouillé.

## Blockers — ce qui bloque

Trois blocages P0 ouverts : pas de déploiement HTTPS, pas de persistance
prouvée, pas de Web Push prouvé.

## Next — la prochaine action

Le VPS.
