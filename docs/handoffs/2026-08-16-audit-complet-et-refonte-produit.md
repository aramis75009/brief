# Passation — 2026-08-16 · Audit complet & refonte produit Brief

| | |
|---|---|
| **Agent** | Hermes Agent · `qwen/qwen3.8-max` via OpenRouter |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits** | aucun — session d'audit et de design, zéro code modifié |

## Goal — l'objectif

Reprise complète du redesign de Brief mandatée par Aramis : audit live
(environnement, code, prod, n8n, données), critique produit, nouveau modèle,
et previews HTML du nouveau produit. Règle absolue de la session : **observer
avant de modifier** — aucun code applicatif touché.

## Current state — ce qui a été fait

1. **Audit live complet** : repo (9 054 LOC lus en entier), prod via SSH
   (`/docker/brief`, volume `brief-data` : 15 items / 6 projets), logs cron,
   API live (401 sans PIN, parse 0,41 s, digest 200), n8n (2 workflows actifs),
   suite verte (94/94).
2. **Diagnostic livré** : fondation backend saine à conserver ; le produit est
   centré sur le mauvais objet (formulaire de capture au lieu de la réponse
   « qu'est-ce que je fais maintenant ? ») ; revue obligatoire = friction
   constante ; le prompt IA invente (projet forcé, priorités par défaut).
3. **Découvertes critiques** :
   - `brief_cli.py` (couche Telegram) lit/écrit `data/` local avec un schéma
     fantôme (`dueAt`, `completedAt`) — ne voit pas les vraies données ;
   - récap n8n du 16/08 en échec : bot Telegram 403 (jamais `/start`) ;
   - le commit « telegram assistant » annoncé n'existe pas dans git.
4. **Nouveau modèle produit défini et VALIDÉ PAR ARAMIS le 2026-08-16** :
   - accueil = la réponse (« Maintenant / Ensuite / Rendez-vous / En retard /
     Plus tard »), capture = geste depuis n'importe où, triage à friction
     proportionnelle à la confiance, plan du jour minimal, nav 3 entrées avec
     micro central, fiche avec provenance (note d'origine), recherche sur
     notes brutes. **La liste des tâches et la disposition mobile sont
     validées.**
5. **Previews** : `docs/designs/preview-v2/` (bento, tokens DESIGN.md) et
   `docs/designs/preview-v3/` (« tableau des départs »). **Verdict Aramis :
   le modèle produit est bon, mais le copywriting ET le design des deux sont
   rejetés — la peau repart avec Claude Design.**

## Validations — passants / échoués / non lancés

- `npx vitest run` : ✅ 94/94 (lancé cette session).
- `npx tsc --noEmit` / `npx eslint .` : **non lancés** cette session (aucun
  code modifié, rien à valider).
- Previews HTML : ✅ rendues et inspectées visuellement (captures 2×, 10
  écrans par génération) ; servies via tunnel trycloudflare éphémère.
- Modèle produit & disposition mobile : ✅ validés par Aramis (2026-08-16).
- Peau visuelle & copywriting : ❌ rejetés — à refaire via Claude Design.

## Blockers — ce qui bloque

Rien. Telegram/n8n **reporté** par décision d'Aramis (2026-08-16) — ne pas le
reprendre sans qu'il le redemande.

## Next — la prochaine action

1. Refaire la peau + le copywriting en mode Claude Design (voir
   `docs/designs/2026-08-16-brief-design-v4.md`) — le modèle produit et la
   disposition mobile validés ne changent pas.
2. Puis phase 2 technique : schéma additif (`raw`, `durationMin`,
   `duePrecision`, `confidence`, `projectId` nullable), `/api/parse` v2 sans
   invention, `triage.ts` + `plan.ts` testés.
3. Déploiement prod uniquement sur accord explicite d'Aramis.
