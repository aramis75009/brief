# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-19 · Refonte UI Claude Design (en cours)

| | |
|---|---|
| **Agent** | Hermes Agent · `glm-5.2` via Ollama Cloud |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Ancienne branche prod** | `feat/task-completion` — ne plus servir, en retard |
| **Commits récents** | `7d0dd1b` (tri + search) · `71db753` (review Claude Design) · `2ff4dd7` (scroll + timezone) · `691b5dc` (cleanup) · `357c95e` (backend) · `f6edc92` (BriefApp) · `ccc20e0` (screens) · `94b9541` (types) · `b5b83b0` (shared) · `ebb6f96` (tokens) |
| **Prod** | https://brief.srv1899780.hstgr.cloud — saine, conteneur healthy |
| **GitHub** | https://github.com/aramis75009/brief/tree/feat/ui-redesign-claude |

## Goal — l'objectif

Reconstruire toute l'UI mobile de Brief à l'identique du design system produit
par Claude Design (fichier `Brief Design System.dc.html`). Le backend (API
routes, store JSON, CalDAV, reminders, Telegram, PIN, queue) est conservé
intact. Seule la couche visuelle est remplacée.

## Contexte — pourquoi

L'ancienne UI (General Sans, palette corail/lilas, console bento) est abandonnée.
Aramis a reçu un design system complet de Claude Design : Plus Jakarta Sans,
palette task/meet/idea (bleu/vert/jaune), rail vocal, 4 stages de capture,
BottomNav flottante, widgets iOS (section 05 — retirée du périmètre, PWA only).

## Ce qui a été fait

### Phase 0 — Fondations (commit `ebb6f96`)
- `layout.tsx` : Plus Jakarta Sans + JetBrains Mono via `next/font/google` (remplace General Sans + woff2 locaux)
- `globals.css` : nouveaux tokens (bg #F4F4F2, surface #FFFFFF, ink #101010, task-100 #CFE0FF, meet-100 #CBE9D6, idea-100 #FBE2AE, danger #E23A2E), keyframes (wave, idle, collapse, pop, rail, shimmer, ping, fade, sheet), `focus-visible` global (outline 2px ink offset 2px), `--radius-8` ajouté
- `icons.tsx` : 20+ SVG repris du design system (MicIcon, CheckIcon, ChevronLeft/Right, Home, Search, Idea, Plus, Close, Play, Stop, Bell, Help, Clock, Calendar, Dots, Star, TaskCheck) + legacy (ProjectDot, ToastIcon, etc.) pour transition
- `tailwind.config.ts` : **supprimé** (globals.css `@theme static` est la seule source de vérité en Tailwind v4)

### Phase 1 — Composants partagés (commit `b5b83b0`)
- `Skeleton.tsx` : SkeletonRow, SkeletonCard, SkeletonList (shimmer)
- `EmptyState.tsx` : cercle dashed + titre + description + bouton optionnel
- `Card.tsx` : **supprimé** (jamais importé)
- `Chip.tsx` : pill avec variantes task/meet/idea/neutral
- `VoiceBadge.tsx` : marqueur 3 barres "créé à la voix" (small/medium)
- `Waveform.tsx` : 4 variantes — Active (21 barres animate-wave), Idle (5 barres animate-idle), Collapsed (effondrement), Static (fil d'origine avec segment actif)
- `BottomNav.tsx` : nav basse flottante (Accueil/Recherche/FAB/Idées), slots 52×48
- `CaptureBar.tsx` : pill fixe "Dis-moi ce que tu as en tête…" (uniquement sur écrans-listes)
- `AccountAvatar.tsx` : cercle initiales + anneau

### Phase 3.1 — Types (commit `94b9541`)
- `types.ts` : ajout de `SubTask`, `AudioOrigin`, `ItemStatus` ("active"|"idea"|"archived"), `Screen` ("home"|"task"|"agenda"|"ideas"|"search")
- `DraftItem` étendu avec `subtasks?`, `audioOrigin?`, `status?` (tous optionnels — pas de migration)

### Phase 2 — Écrans (commit `ccc20e0`)
- `HomeScreen.tsx` : 4 tuiles 2×2 + liste "Aujourd'hui" filtrée par date (zonedParts) + triée par heure croissante + comptages today + checkbox fond blanc bord ink/18 coche ink + boutons header 44×44
- `TaskDetailScreen.tsx` : fil d'origine (waveform statique + segment + citation surlignée + siblings) + sous-tâches avec barre de progression + boutons Terminer/Reporter/Supprimer + dueLabel en Intl.DateTimeFormat avec timezone
- `AgendaScreen.tsx` : vue semaine calendaire + navigation prev/next (weekOffset state) + events groupés par jour puis matin/après-midi (zonedParts pour timezone) + badge "Calendrier Apple"
- `IdeasScreen.tsx` : cartes idée + "Convertir en tâche" + archiver + opacity 0.65 basée sur ancienneté (>48h)
- `SearchScreen.tsx` : barre + filtres + résultats avec highlight + mode navigation (query vide = affiche tout)

### Phase 3 — Sheets (commit `ccc20e0`)
- `CaptureSheet.tsx` : 4 stages (idle/listening/transcribing/done) avec waveform, rail vocal, items pop, role=dialog aria-modal
- `AccountSheet.tsx` : profil + toggles (CalDAV, structuration auto, rappels) + nav (voix, confidentialité, abonnement) + role=dialog aria-modal

### Phase 4 — Orchestrateur (commit `f6edc92`)
- `BriefApp.tsx` : réécrit (697→~460 lignes), navigation par Screen, CaptureBar conditionnel (home/ideas/search seulement), sheets en overlay
- `PhoneFrame.tsx` : refondu (canvas #EFEEEA, cadre iOS)
- `Toast.tsx` : refondu (pill blanche + ombre + border)
- `PinGate.tsx` : inchangé logiquement, refondu visuellement à faire

### Phase 5 — Backend (commit `357c95e`)
- `src/app/api/search/route.ts` : nouvelle route GET /api/search?q=… (cherche dans title, notes, audioOrigin.text, audioOrigin.highlight)
- `src/app/api/agenda/route.ts` : nouvelle route GET /api/agenda?week=… (items groupés par jour et matin/après-midi)
- `src/app/api/items/route.ts` : coerce() accepte subtasks, audioOrigin, status. GET supporte ?status=idea|active|archived|not-idea

### Phase 6 — Nettoyage (commit `691b5dc`)
- Supprimés : OverviewScreen, TasksScreen, TaskSheet, CaptureScreen, ReviewScreen, SettingsScreen, TabBar, DoneBox
- Supprimés : GeneralSans-*.woff2 (4 fichiers)
- Supprimés : docs/designs/preview-v2 à v7, prompt-direction-artistique-v*.md, preview-systeme.html, organiseur-autonome.md

### Corrections après review Claude Design (commit `71db753`)
- Tuile Tâches → cliquable (onScrollToTasks)
- Agenda → bouton "Semaine suivante" avec state (weekOffset)
- Agenda → events groupés par jour (pas mélangés sur toute la semaine)
- CaptureBar → seulement sur home/ideas/search
- Ideas opacity → basée sur ancienneté >48h à 0.65 (AA)
- focus-visible global : outline 2px ink offset 2px
- Header buttons 44×44 avec fond blanc + bordure
- Checkbox : fond blanc bord ink/18 coche ink (était noir/blanc)
- CaptureBar : pl-[18px] pr-1.5 (était px-[18px])
- BottomNav slots : 52×48 (était 48×48)
- --radius-8 token ajouté
- dueLabel : Intl.DateTimeFormat avec timezone
- fmtClock : minutes correctes (plus de 0:75)
- Sheets : role=dialog aria-modal aria-label
- tailwind.config.ts supprimé, Card.tsx supprimé

### Corrections supplémentaires (commit `7d0dd1b`)
- Tri des tâches d'aujourd'hui par heure croissante
- Recherche : affiche tout par défaut (mode navigation), filtre quand on tape
- Header padding pour éviter le débordement de l'avatar

## Validations

| Commande / vérif | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ propre |
| `npx vitest run` | ✅ 123/123 (10 fichiers) |
| Déploiement VPS | ✅ `brief-app-1 Healthy` |
| Prod en ligne | ✅ https://brief.srv1899780.hstgr.cloud |

## Ce qui n'est PAS fait (prochain agent)

### Priorité 1 — Synchronisation CalDAV (bloquant)
Le problème central : les tâches/RDV synchronisés avec Apple Calendar ne remontent pas correctement dans Brief. Aramis a reporté une tâche "Rush CSS Codecademy — finir la leçon" pour le 19 août 07:00-10:00 (9h-12h en Paris), mais rien n'apparaît dans l'app. Le cron CalDAV tourne (toutes les 60s) mais les events ne sont pas visibles.

**Investigations à mener :**
1. Vérifier le contenu de `data/items.json` sur le VPS — est-ce que les events CalDAV sont bien écrits par le sync ?
2. Vérifier les logs du cron : `docker exec brief-cron-1` et les logs de l'app pour les erreurs caldav-sync
3. Vérifier que `src/lib/caldav.ts` lit bien les events (VEVENT) et pas juste les VTODO
4. Vérifier le format des dates : les events CalDAV reviennent en UTC, il faut s'assurer qu'ils sont stockés avec l'offset et affichés en Europe/Paris
5. Vérifier que les events Apple Calendar (qui viennent de Google Calendar sync vers Apple) apparaissent dans le calendrier iCloud CalDAV
6. L'agenda affiche des tâches mais elles sont "mauvaises" (anciennes, mauvaises heures) — c'est lié au fait que le sync ne fonctionne pas correctement

**Commandes utiles :**
```bash
# Voir les données sur le VPS
HOME=/opt/data/home ssh -i /opt/data/home/.ssh/id_ed25519 root@186.241.16.37 \
  "docker exec brief-app-1 cat /app/data/items.json | head -200"

# Voir les logs caldav
HOME=/opt/data/home ssh -i /opt/data/home/.ssh/id_ed25519 root@186.241.16.37 \
  "docker logs brief-app-1 2>&1 | grep -i caldav | tail -20"

# Lancer le sync manuellement
HOME=/opt/data/home ssh -i /opt/data/home/.ssh/id_ed25519 root@186.241.16.37 \
  "curl -fsS -m 30 -H 'Authorization: Bearer \$BRIEF_MACHINE_TOKEN' http://127.0.0.1:3000/api/cron/caldav-sync"
```

### Priorité 2 — Bugs UI mineurs
1. **Avatar Recherche débordement** : l'AccountAvatar (46px + anneau -3px) dans le header de SearchScreen déborde sur le haut de l'écran. Réduire la taille ou ajouter du padding-top.
2. **Agenda : cliquer sur les jours** : la grille de la semaine affiche les jours mais on ne peut pas cliquer dessus pour voir les events d'un jour spécifique. Ajouter un onClick qui filtre les events par jour sélectionné.
3. **Tuile "Demander à l'IA"** : ouvre le CaptureSheet au lieu d'un assistant dédié (volontaire pour l'instant).
4. **Voice search** : `onVoiceSearch` est un TODO dans SearchScreen.

### Manquants vs le brief v4 (reportés volontairement)
- Hiérarchie temporelle NOW/Ensuite/RDV/En retard/Plus tard (le design a une liste plate "Aujourd'hui")
- Écran "C'est noté" dédié (le stage Done du CaptureSheet fait office)
- Triage à une question
- Plan du jour
- Registre (Tout)
- États micro refusé / hors-ligne / échec IA (micro refusé géré dans CaptureSheet)
- Desktop responsive
- Thème sombre
- DESIGN.md et AGENTS.md pas mis à jour avec les nouveaux tokens

### Architecture
- L'app est sur la branche `feat/ui-redesign-claude` qui **sert le VPS en prod**
- L'ancienne branche `feat/task-completion` est obsolète
- Le backup des données est dans `/docker/brief/backups/brief-data-20260819-001206.tar.gz` sur le VPS
- Le design system source est dans `/opt/data/brief-design-claude/Brief Design System.dc.html`

## Invariants critiques à respecter

- **Toute route /api/ commence par `requirePin`** (sauf cron qui utilise `requireMachineToken`)
- **Aucun calcul de date ne passe par les méthodes locales de Date** — tout passe par `src/lib/zoned.ts` (Europe/Paris)
- **Les variables NEXT_PUBLIC_* doivent être passées au build** (--env-file .env.production)
- **Le volume brief-data est l'unique copie des items** — sauvegarder avant tout déploiement
- **Le cron tourne dans un conteneur séparé** (alpine + curl vers /api/cron/reminders et /api/cron/caldav-sync toutes les 60s)
- **Le reset CSS doit rester dans @layer base** (sinon il écrase les utilitaires Tailwind)
- **Les safe areas (.safe-top .safe-bottom .safe-x) sont écrites à la main** (Tailwind v4 ne compile pas env())

## Déploiement

```bash
# Backup
HOME=/opt/data/home ssh -i /opt/data/home/.ssh/id_ed25519 root@186.241.16.37 \
  "cd /docker/brief && docker run --rm -v brief_brief-data:/data -v \$(pwd)/backups:/backup alpine tar czf /backup/brief-data-$(date +%Y%m%d-%H%M%S).tar.gz -C /data ."

# Deploy
HOME=/opt/data/home ssh -i /opt/data/home/.ssh/id_ed25519 root@186.241.16.37 \
  "cd /docker/brief && git pull origin feat/ui-redesign-claude && docker compose --env-file .env.production up -d --build"
```

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-19** | **Refonte UI Claude Design (en cours)** | **Hermes Agent** | *(cette passation)* |
| 2026-08-18 | Cookie PIN posé par le serveur (Set-Cookie) | Hermes Agent | [fiche](docs/handoffs/2026-08-18-pin-cookie-server.md) |
| 2026-08-18 | Suppressions d'occurrences adoptées (EXDATE) + ancre de série | Hermes Agent | [fiche](docs/handoffs/2026-08-18-exdate-adoption.md) |
| 2026-08-18 | PIN mémorisé fiabilisé (cookie + localStorage) | Hermes Agent | [fiche](docs/handoffs/2026-08-18-pin-cookie.md) |
| 2026-08-18 | Récurrences de publication bornées fin août | Hermes Agent | [fiche](docs/handoffs/2026-08-18-recurrences-bornees.md) |
| 2026-08-18 | Calendrier = source de vérité + semaine récurrente | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-source-de-verite.md) |
| 2026-08-18 | CalDAV multi-calendriers déployé + routage vérifié | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-multicalendriers-deploye.md) |
| 2026-08-18 | CalDAV multi-calendriers (un calendrier par projet) — implémenté, à déployer | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-multicalendriers.md) |
| 2026-08-17 | PIN mémoire + synchro CalDAV Apple | Hermes Agent | [fiche](docs/handoffs/2026-08-17-pin-memoire-et-caldav-apple.md) |
| 2026-08-16 | Audit complet et refonte produit | Claude Code | [fiche](docs/handoffs/2026-08-16-audit-complet-et-refonte-produit.md) |
| 2026-08-15 | Workflow Telegram et n8n | Hermes Agent | [fiche](docs/handoffs/2026-08-15-workflow-telegram-n8n.md) |
| 2026-08-14 | Déploiement prod + correctif projets invisibles | Hermes Agent | [fiche](docs/handoffs/2026-08-14-deploiement-et-correctif-projets.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |