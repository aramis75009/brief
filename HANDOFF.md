# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-18 · CalDAV multi-calendriers déployé, routage vérifié

| | |
|---|---|
| **Agent** | Hermes Agent · `deepseek/deepseek-v4-flash-0731` via OpenRouter |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits** | `6a32b7b`, `ecd8d55`, `14c06bd`, `a96bd90`, `07e416b`, + docs |

## Goal — l'objectif

Aramis ne distinguait pas ses domaines dans l'app Calendrier (tout dans
« Personnel »). Objectif : **router chaque projet Brief vers son propre
calendrier iCloud** (sa couleur), retirer les tâches cochées dès qu'elles
sont terminées, et avoir un seul exemplaire de chaque événement au bon endroit.

## Decisions — choix critiques ou irréversibles (cf. DECISIONS.md 18/08)

Mapping projet → calendrier (final) :
- Frip & Trend → « Vinted Frip&Trend » (existant)
- My Flip → **« My Flip » créé (orange)** — le projet Dropshipping a été
  supprimé par Aramis (« plus d'actualité »), son calendrier n'est plus utilisé
- Perso → « Personnel » (défaut) · Sport → « Sport »
- Web@académie → « Web@académie » (créé, rouge) · IA → « IA » (créé, vert)
- Projet inconnu / null → « Personnel » (fallback)

Mise en vente = projet Frip & Trend : la tâche « Mètre en vente sur Vestiaire
Collective… » (Perso) a été déplacée vers `frip-trend` (via `PATCH
/api/items/:id`), donc vers le calendrier Vinted Frip&Trend.

## Current state — ce qui a été fait

1. **Calendriers iCloud créés par MKCOL** (HTTP 201) : « My Flip » (orange,
   `…/1EAD6462818A4019B680CE74A38EDF8C/`), « Web@académie », « IA ».
2. **`src/lib/caldav.ts`** — routage par projet + **3 correctifs trouvés par la
   vérification indépendante** :
   - `discoverCalendars` **décode le displayname** (iCloud renvoie
     `Vinted Frip&amp;Trend`) pour qu'il corresponde au mapping.
   - **Href absolu résolu par `new URL(href, homeHref)`** (l'ancrage sur
     l'origine) — auparavant le `/` de tête était dépouillé puis collé au
     chemin du home → chemin dupliqué → `calendar-query 400` (rien n'était écrit).
   - **Deux phases : nettoyage PUIS écriture.** iCloud renvoie 412 (conflit) si
     un UID existe déjà sur le compte (l'ancien exemplaire resté dans
     « Personnel ») : on supprime d'abord les copies hors cible, ensuite on met
     à jour les calendriers de destination. Un seul exemplaire par UID.
   - Le balayage couvre **tous** les calendriers découverts, pas seulement ceux
     qui ont encore des items : une tâche cochée qui était la dernière de son
     calendrier (ex. Anaïs, Perso) en est retirée aussi. `targetByUid` décide.
3. **Déployé en prod** : VPS `/docker/brief` fast-forwardé sur
   `feat/task-completion`, conteneurs rebuildés, `brief-app-1` healthy.

## Validations — passants / échoués / non lancés

| Commande / vérif | Résultat |
|---|---|
| `npx vitest run` | ✅ **106/106** (9 fichiers) |
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npx eslint src/lib/caldav.ts …` | ✅ 0 erreur |
| MKCOL création calendriers | ✅ HTTP 201 |
| Passage de synchro réel (route cron) | ✅ `desired=8 put=8 failures=0` |
| **Relu iCloud indépendante** (curl brut, pas le module) | ✅ 8 événements répartis : Vinted Frip&Trend 4, My Flip 1, Web@académie 1, IA 1, Sport 1 ; **Anaïs (cochée) absente** ; aucun résidu « Personnel » |

**Non lancé :** la vérification visuelle sur l'iPhone par Aramis (couleurs des
calendriers dans l'app Calendrier) — effet sur canal externe.

## Blockers — ce qui bloque

Rien. Le calendrier « Dropshipping » n'existe pas/plus sur iCloud (le projet a
été supprimé par Aramis) — rien d'orphelin à nettoyer. D'autres calendriers du
compte (Permis, Fake, Rappels ⚠️, Vente Privée, Travail) sont balayés à chaque
passage mais sans événement `brief-*` → sans effet.

## Next — la prochaine action

1. Aramis regarde l'app Calendrier sur iPhone : couleurs et répartition par
   domaine. Cocher une tâche dans Brief → elle disparaît du calendrier au
   passage suivant (≤15 min).
2. S'il veut associer d'autres projets existants à leur propre calendrier,
   ajuster `DEFAULT_CALENDAR_MAPPING` (ou `BRIEF_CALDAV_MAPPING` JSON).
3. Refonte visuelle (peau Claude Design) toujours en attente (modèle validé).

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-18** | **CalDAV multi-calendriers déployé + routage vérifié** | **Hermes Agent** | *(cette passation)* |
| 2026-08-18 | CalDAV multi-calendriers (un calendrier par projet) — implémenté, à déployer | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-multicalendriers.md) |
| 2026-08-17 | PIN mémoire + synchro CalDAV Apple | Hermes Agent | [fiche](docs/handoffs/2026-08-17-pin-memoire-et-caldav-apple.md) |
| 2026-08-16 | Audit complet et refonte produit | Claude Code | [fiche](docs/handoffs/2026-08-16-audit-complet-et-refonte-produit.md) |
| 2026-08-15 | Workflow Telegram et n8n | Hermes Agent | [fiche](docs/handoffs/2026-08-15-workflow-telegram-n8n.md) |
| 2026-08-14 | Déploiement prod + correctif projets invisibles | **Hermes** | [fiche](docs/handoffs/2026-08-14-deploiement-et-correctif-projets.md) |
| 2026-08-14 | Système de passation + correctif fuseau | Claude Code | [fiche](docs/handoffs/2026-08-14-systeme-passation-et-fuseau.md) |
| 2026-08-14 | Saisie clavier et modification des items | **Hermes** | [fiche](docs/handoffs/2026-08-14-saisie-clavier-et-edition-items.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |