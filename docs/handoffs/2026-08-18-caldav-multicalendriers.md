# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-18 · CalDAV multi-calendriers : un calendrier Apple par projet

| | |
|---|---|
| **Agent** | Hermes Agent · `deepseek/deepseek-v4-flash-0731` via OpenRouter |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |

## Goal — l'objectif

Aramis ne distinguait pas ses domaines dans l'app Calendrier : **toutes les
tâches Brief atterrissaient dans « Personnel » (`home/`)**, une seule couleur.
Objectif : router chaque projet Brief vers **son propre calendrier iCloud**
(chaque calendrier a sa couleur → la semaine se lit par domaine d'activité).

## Decisions — choix critiques ou irréversibles

Inscrit dans `DECISIONS.md` (2026-08-18) : mapping projet → calendrier.
- Frip & Trend → « Vinted Frip&Trend » (existant)
- My Flip → « Dropshipping » (existant, remplace l'ancien projet)
- Perso → « Personnel » (défaut)
- Sport → « Sport » (existant)
- Web@académie → **« Web@académie » créé** (rouge), remplace l'usage de « Travail »
- IA → **« IA » créé** (vert pomme)
- Projet inconnu / null → « Personnel » (fallback)

## Current state — ce qui a été fait

1. **Calendriers créés sur iCloud (MKCOL, HTTP 201)** :
   - « Web@académie » → `https://p127-caldav.icloud.com:443/16391108573/calendars/1195667C-885A-4195-9377-136271FEC715/`
   - « IA » → `https://p127-caldav.icloud.com:443/16391108573/calendars/B8810CC6-1DA6-4A3D-B2EF-7998673DF512/`
2. **`src/lib/caldav.ts` refondu** :
   - `calendarForProject(projectId)` — table par défaut, surchargeable par
     `BRIEF_CALDAV_MAPPING` (JSON) ; fallback « Personnel ».
   - `discoverCalendars(homeHref)` — liste tous les calendriers du compte
     (displayname → URL absolue), exclut inbox/outbox/notification.
   - `runCalDavSync()` — groupe les items datés par calendrier cible, puis
     PUT/DELETE par calendrier. Un item qui change de projet est déplacé au
     passage suivant (supprimé de l'ancien, écrit dans le nouveau). Garde-fou
     15 min conservé ; `discoveredCalendar` liste les calendriers touchés.
   - Exports préservés pour le test d'intégration (`discoverPrincipal`,
     `discoverCalendarHome`, `discoverCalendarUrl`, `listBriefEvents`).
3. **`src/lib/caldav.test.ts`** : +2 tests `calendarForProject` (mapping +
   fallback). **106/106 tests verts**, tsc 0 erreur, eslint 0 erreur.

## Validations — passants / échoués / non lancés

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ **106/106** (9 fichiers) |
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npx eslint src/lib/caldav.ts src/lib/caldav.test.ts` | ✅ 0 erreur |
| Découverte réelle iCloud (script) | ✅ 13 calendriers listés, noms + URLs corrects |
| MKCOL création calendriers | ✅ HTTP 201 pour les 2 |

**Non lancé :** le déploiement VPS (reste à faire) et le premier passage de
synchro en prod avec le mapping (vérifier `desired` réparti sur plusieurs
calendriers, `failures=0`).

## Blockers — ce qui bloque

Rien.

## Next — la prochaine action

1. Commit + push `feat/task-completion`.
2. VPS : `git pull` + rebuild + `docker compose up -d --build`.
3. Vérifier dans les logs cron : un passage non-skipped avec `put` réparti et
   `failures=0`, puis confirmer sur l'iPhone qu'« IA » et « Web@académie »
   sont bien remplis.
4. Aramis confirme visuellement les couleurs dans l'app Calendrier.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-18** | **CalDAV multi-calendriers (un calendrier par projet)** | **Hermes Agent** | *(cette passation)* |
| 2026-08-17 | PIN mémoire + synchro CalDAV Apple | Hermes Agent | [fiche](docs/handoffs/2026-08-17-pin-memoire-et-caldav-apple.md) |
| 2026-08-16 | Audit complet et refonte produit | Claude Code | [fiche](docs/handoffs/2026-08-16-audit-complet-et-refonte-produit.md) |
| 2026-08-15 | Workflow Telegram et n8n | Hermes Agent | [fiche](docs/handoffs/2026-08-15-workflow-telegram-n8n.md) |
| 2026-08-15 | Refonte UI Bento + Réglages | Hermes Agent | [fiche](docs/handoffs/2026-08-15-refonte-ui-bento-settings.md) |
| 2026-08-15 | Refonte page Capture (Bento Hero) | Hermes Agent | [fiche](docs/handoffs/2026-08-15-refonte-capture-bento-hero.md) |
| 2026-08-15 | Refonte page Vision (focus actionable) | Hermes Agent | [fiche](docs/handoffs/2026-08-15-refonte-vision-focus-et-horizon.md) |
| 2026-08-15 | Workflow tâches complet (recherche, sections, swipe) | Hermes Agent | [fiche](docs/handoffs/2026-08-15-workflow-taches-complet.md) |
| 2026-08-15 | Dates naturelles, priorités & synthèse | Hermes Agent | [fiche](docs/handoffs/2026-08-15-dates-naturelles-et-priorites-design.md) |
| 2026-08-15 | Tri multi-critères et filtre tâches faites | Hermes Agent | [fiche](docs/handoffs/2026-08-15-tri-et-filtre-taches-faites.md) |
| 2026-08-14 | Brief parle à n8n, récap du matin sur Telegram | Claude Code | [fiche](docs/handoffs/2026-08-14-n8n-digest-telegram.md) |
| 2026-08-14 | Déploiement prod + correctif projets invisibles | **Hermes** | [fiche](docs/handoffs/2026-08-14-deploiement-et-correctif-projets.md) |
| 2026-08-14 | Système de passation + correctif fuseau | Claude Code | [fiche](docs/handoffs/2026-08-14-systeme-passation-et-fuseau.md) |
| 2026-08-14 | Saisie clavier et modification des items | **Hermes** | [fiche](docs/handoffs/2026-08-14-saisie-clavier-et-edition-items.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |
