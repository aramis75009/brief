# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-23 (matin) · Déploiement desktop V1 + audio/IA du 22/08

| | |
|---|---|
| **Agent** | Hermes Agent (glm-5.2 via Ollama Cloud) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `8f58884` (head) — déployé en prod |
| **Prod** | https://brief.srv1899780.hstgr.cloud — `brief-app-1 Healthy` |
| **Tests** | `npx vitest run` ✅ 261 passed | 1 skipped (validé par Claude Code avant push) |

## Goal — l'objectif

Déployer en production la version desktop V1 (commit `8f58884` de Claude Code)
ainsi que le travail audio/IA/sheets du 22/08 (jamais déployé jusqu'ici). La prod
était sur `06e90e5` — 23 commits de retard, deux sessions cumulées.

## Current state — ce qui a été fait

### Déploiement

1. **Fast-forward copie VPS** (`/opt/data/Projets/brief`) : `bb9891f` → `8f58884`
2. **Vérification prod avant déploiement** : branche `feat/ui-redesign-claude`,
   HEAD `06e90e5`, conteneur healthy, `.env.production` présent avec VAPID key,
   `git status` propre
3. **Sauvegarde** : `bash deploy/backup.sh` → `brief-data-20260823-105621.tar.gz` (144K)
4. **Git pull** sur `/docker/brief` : `06e90e5` → `8f58884` (fast-forward, 20 fichiers, +4478/-180 lignes)
5. **Build Docker** : `docker compose --env-file .env.production up -d --build`
   - Next.js 16.3.0 (Turbopack), build en 43s
   - 3 warnings Turbopack (dynamic filesystem access dans `store.ts` — pré-existants, non bloquants)
   - Conteneur `brief-app-1` recréé, démarré, **Healthy** à 10:57:30 UTC

### Vérifications post-déploiement (toutes ✅)

| Check | Résultat |
|---|---|
| `brief-app-1` status | ✅ Up, Healthy |
| Container StartedAt | ✅ `2026-08-23T10:57:30Z` (après commit `8f58884`) |
| Git HEAD prod | ✅ `8f58884` |
| HTTP 200 URL publique | ✅ `https://brief.srv1899780.hstgr.cloud/` |
| VAPID key dans le bundle | ✅ `BHvZ6NNa1WlbNRBO...` trouvé dans chunk JS |
| PIN gate sans PIN | ✅ 401 (refusé) |
| PIN gate avec PIN | ✅ 200 (accepté) |
| Routes API (items, overview, projects, agenda) | ✅ toutes 200 |
| Composants desktop dans le bundle | ✅ `desktop` trouvé dans chunks JS |
| Manifest PWA mobile | ✅ inchangé (portrait, standalone, Brief) |
| Labels Traefik | ✅ intacts ( Host `brief.srv1899780.hstgr.cloud`, port 3000) |

### Ce qui est maintenant en prod (23 commits, 2 sessions)

**Session du 22/08 (Hermes Agent, déjà pushée mais jamais déployée) :**
- Stockage audio vocal (`/api/audio` upload + serve)
- Assistant IA (`/api/chat` via Ollama Cloud, `deepseek-v4-flash:0731`)
- 6 sheets câblés (Help, Notifications, Voice, Privacy, Subscription, Chat)
- Notifications push réelles (enablePush, sendTestPush, readPushState)
- Fil d'origine complet sur la fiche tâche (audioOrigin)
- Sous-tâches générées par le parseur LLM
- Sélecteur de projet dans la capture
- Couleurs boutons Tâche/RDV/Idée (bleu/vert/jaune)
- Couleurs projets = couleurs Apple Calendar exactes
- Calendrier "Fake" visible dans l'agenda
- Recherche améliorée (tuiles agrandies, pastilles, micro vocal)
- Performance iPhone (React.memo, formateurs module-level, useCallback)

**Session du 23/08 nuit (Claude Code, desktop V1) :**
- 5 écrans desktop (`DesktopShell`, `DesktopHeader`, `DesktopDashboard`,
  `DesktopCalendar`, `DesktopTasks`, `DesktopIdeas`, `DesktopSettings`)
- Bascule mobile/desktop via `useIsDesktop` (matchMedia 1024px, SSR-safe)
- Command palette ⌘K
- Dashboard 3 cartes (Capture animée / Aujourd'hui / Avancement+En retard)
- Densité "tout tient sur un écran sans scroll de page" (h-dvh overflow-hidden)
- CaptureSheet `variant: "sheet" | "modal"` (modale centrée sur desktop)
- `desktopDashboard.ts` — calculs purs (16 tests)
- 3 bugs corrigés (décalage jour UTC, bascules 0×0, justify-center + overflow)

## Decisions — choix critiques ou irréversibles

(Aucune nouvelle décision dans cette session — déploiement seul. Les décisions
des deux sessions déployées sont dans leurs passations respectives, archivées
dans `docs/handoffs/`.)

## Changed — fichiers et composants

Aucun fichier modifié dans cette session. Déploiement seul.

## Validations

| Commande | Résultat |
|---|---|
| `docker compose --env-file .env.production up -d --build` | ✅ Build réussi, conteneur Healthy |
| `curl -sI https://brief.srv1899780.hstgr.cloud/` | ✅ HTTP 200 |
| `curl -X POST -H "x-brief-pin: <PIN>" /api/session` | ✅ 200 |
| `curl -X POST /api/session` (sans PIN) | ✅ 401 |
| VAPID dans bundle JS | ✅ présent |
| Traefik labels | ✅ intacts |

## Blockers

Aucun. Prod saine sur `8f58884`.

## Points à connaître ( transmis par Claude Code, non bloquants)

1. **Le prototype fait foi sur DESIGN.md §7** (nav horizontale, pas le rail
   248px décrit) — pas corrigé, à faire dans une session dédiée au design system.
2. **Horizon 7 jours / Ton mur / aperçu Idées / Chaîne & sync** retirés du
   Dashboard sur demande d'Aramis (« on verra ce qu'on en fait ») — pas
   supprimés du code, juste plus affichés. Ne pas les faire réapparaître sans
   qu'il le redemande.
3. **Deux items de test** créés dans `.data/items.json` **local au Mac
   d'Aramis** (pas la prod) pendant la QA desktop de Claude Code : « Vérifier
   le test desktop » (Frip & Trend) et « Appeler le plombier pour le devis »
   (My Flip). Sans conséquence pour la prod.
4. **Kanban explicitement hors périmètre V1** — `TODOS.md` sépare les deux.
5. **Tests de Claude Code** : `npx vitest run` ✅ 261 passed | 1 skipped,
   `npx tsc --noEmit` ✅, `npm run build` ✅ — validés avant push, non rejoués
   sur le VPS (déploiement seul, pas de modification de code).

## Next — la prochaine action

1. **Vérification visuelle sur iPhone** : Aramis doit force-quitter l'app PWA
   et la rouvrir pour voir les changements. Sur un écran ≥1024px (Mac, iPad
   landscape), la version desktop doit apparaître (nav pilule horizontale, pas
   le cadre téléphone). Sur iPhone, rien ne doit changer.
2. **Vérifier le FIL D'ORIGINE + sous-tâches** sur une nouvelle dictée (bug
   FormData corrigé, race condition corrigé — session du 22/08).
3. **Améliorer l'assistant IA** : permettre la création de tâches directement
   depuis le chat (appeler `/api/parse` ou `/api/items`).
4. **DESIGN.md §7** à corriger pour refléter la nav horizontale réelle.
5. **Statuer sur Horizon 7 jours / Ton mur / Idées / Chaîne & sync** —
   Aramis doit décider ce qu'on en fait.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-23 (matin)** | **Déploiement desktop V1 + audio/IA du 22/08** | **Hermes Agent** | *(cette passation)* |
| 2026-08-23 (nuit) | Version desktop V1 (5 écrans, nav pilule, dashboard 3 cartes) | Claude Code | [fiche](docs/handoffs/2026-08-23-claude-code-desktop-v1.md) |
| 2026-08-22 (soir) | Audio storage, assistant IA, sheets, couleurs projets, perf iPhone | Hermes Agent | [fiche](docs/handoffs/2026-08-22-audio-storage-ia-sheets-couleurs.md) |
| 2026-08-20 (soir 2) | Coche d'une occurrence dont `due` a déjà avancé (cron) | Hermes Agent | [fiche](docs/handoffs/2026-08-22-hermes-audio-ia-sheets.md) |
| 2026-08-20 (soir) | Occurrence cochée vs `due` avancé par le cron | Claude Code | [fiche](docs/handoffs/2026-08-20-occurrence-cochee-due-avance-cron.md) |
| 2026-08-20 (après-midi) | Séance push corrigée + icône PWA + DESIGN.md restauré | Claude Code | [fiche](docs/handoffs/2026-08-20-phantom-occurrence-icone-design-restaure.md) |
| 2026-08-20 (jour) | Accès agents aux tâches/RDV + query token | Hermes Agent | [fiche](docs/handoffs/2026-08-20-acces-agents-query-token.md) |