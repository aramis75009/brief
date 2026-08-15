# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-15 · Refonte complète de la page Capture (Bento Hero, copywriting direct & grand format)

| | |
|---|---|
| **Agent** | Hermes Agent v0.20.0 · `google/gemini-3.7-flash` via OpenRouter |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits** | `feat: capture screen overhaul with bento hero card, direct copywriting and modern clean layout` |

## Goal — l'objectif

Transformer l'écran principal **Capture** pour lui donner un design moderne, haut de gamme et épuré :
1. **Suppression des éléments cheap** : retrait définitif du badge `FR` inutile et du titre basique.
2. **En-tête épuré** : Typogramme net `Capture` avec sous-titre explicite.
3. **Carte Bento "Relevé du jour" haute lisibilité** : chiffres forts (`32px` gras) pour les retards (`totals.overdue`), tâches du jour (`totals.today`) et total ouvert (`totals.open`), avec jauge segmentée et bouton d'accès rapide à la Vision.
4. **Zone de Note surélevée (Input Hero)** : carte blanche/tile avec typographie fluide, placeholder exemplaire et raccourci d'effacement discret.
5. **Bouton Micro Héroïque & CTA pleine largeur** : halo interactif, barres de fréquence fluides et grand bouton noir d'organisation IA.

## Current state — ce qui a été fait

- **`src/components/CaptureScreen.tsx`** :
  - Refonte totale du template JSX et des styles Tailwind v4 conformément aux directives de design (General Sans, tokens sémantiques, absence d'ornement inutile).
  - Suppression des anciens textes verbeux pour un copywriting direct (*« Dicte ou saisis ta note, l'IA organise tout »*, *« Organiser avec l'IA »*).

## Decisions — choix critiques ou irréversibles

- **Conserver la parité stricte avec les actions audio & clavier** : la frappe au clavier et la dictée Whisper alimentent le même pipeline de structuration vers `/api/parse`.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/components/CaptureScreen.tsx` | refondu : en-tête épuré, carte bento 3 compteurs, input hero, micro moderne |
| `docs/handoffs/2026-08-15-refonte-vision-focus-et-horizon.md` | **créé** — archive passation précédente |
| `HANDOFF.md` | réécrit — passation courante |

## Validations — passants / échoués / non lancés

Lancées **après** l'implémentation complète :

| Commande | Résultat |
|---|---|
| `npm run lint` | ✅ aucune erreur, aucun warning |
| `npx tsc --noEmit` | ✅ types stricts validés |
| `npx vitest run` | ✅ **94 tests passent** (7 test suites) |

## Blockers — ce qui bloque

Rien.

## Next — la prochaine action

Déployer sur le VPS et tester la saisie et la dictée sur l'iPhone d'Aramis.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-15** | **Refonte page Capture (Bento Hero & design moderne)** | **Hermes Agent** | *(cette passation)* |
| 2026-08-15 | Refonte page Vision (focus actionable, horizon interactif) | Hermes Agent | [fiche](docs/handoffs/2026-08-15-refonte-vision-focus-et-horizon.md) |
| 2026-08-15 | Optimisation complète tâches (recherche, sections, ajout direct, swipe) | Hermes Agent | [fiche](docs/handoffs/2026-08-15-workflow-taches-complet.md) |
| 2026-08-15 | Dates langage naturel coloré, priorités & synthèse | Hermes Agent | [fiche](docs/handoffs/2026-08-15-dates-naturelles-et-priorites-design.md) |
| 2026-08-15 | Tri multi-critères et filtre des tâches terminées | Hermes Agent | [fiche](docs/handoffs/2026-08-15-tri-et-filtre-taches-faites.md) |
| 2026-08-14 | Brief parle à n8n, récap du matin sur Telegram | Claude Code | [fiche](docs/handoffs/2026-08-14-n8n-digest-telegram.md) |
| 2026-08-14 | Déploiement prod + correctif projets invisibles | **Hermes** | [fiche](docs/handoffs/2026-08-14-deploiement-et-correctif-projets.md) |
| 2026-08-14 | Système de passation + correctif fuseau | Claude Code | [fiche](docs/handoffs/2026-08-14-systeme-passation-et-fuseau.md) |
| 2026-08-14 | Saisie clavier et modification des items | **Hermes** | [fiche](docs/handoffs/2026-08-14-saisie-clavier-et-edition-items.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |
