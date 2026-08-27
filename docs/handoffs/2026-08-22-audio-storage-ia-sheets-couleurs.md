# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-22 (soir) · Audio storage, assistant IA, sheets, couleurs projets, perf iPhone

| | |
|---|---|
| **Agent** | Hermes Agent (glm-5.2 via Ollama Cloud) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `06e90e5` (head) — 21 commits depuis `245616a` |
| **Prod** | https://brief.srv1899780.hstgr.cloud — `brief-app-1 Healthy` |
| **Tests** | `npx vitest run` ✅ 246 passed ; `npx tsc --noEmit` ✅ |

## Goal — l'objectif

Rendre l'app Brief (PWA iOS) plus fluide, plus rapide, et enrichir la gestion
des tâches : stockage des audios vocaux, transcription sur la fiche, sous-tâches
générées par le parseur, vrai assistant IA, boutons morts câblés, couleurs de
projets alignées sur les calendriers Apple.

## Current state — ce qui a été fait (21 commits, 33 fichiers, +1881/-246 lignes)

### 1. Performance iPhone (branche perf/iphone-fluency, merge fast-forward)

- `React.memo` sur `TodayRow`, `DestinationTile`, `RowCheckbox`,
  `TodayAgendaFallbackRow`, `TodayAgendaGroup` (HomeScreen) et `EventRow`
  (AgendaScreen)
- Formateurs `Intl` module-level (`timeFmt`, `dayLabelFmt`, `agendaTimeFmt`,
  `agendaDayFmt`, `agendaMonthFmt`) — plus de recréation à chaque rendu
- `useMemo` sur `activeItems`/`ideaItems`/`selectedTask` dans BriefApp
- `useCallback` stables (`toggleDoneSimple`, `onOpenAgenda`, `onOpenIdeas`,
  `goBackFromTask`)
- `globals.css` : `touch-action: manipulation` sur body
- Suppression des sources de flou iOS : `opacity:0.65` (cartes idées),
  `content-visibility: auto` (`.cv-auto`), `contain: paint` réduit à
  `contain: layout style`

### 2. Boutons morts câblés — vraies sheets, pas des toasts

6 nouveaux composants sheet conformes au DESIGN.md :
- `InfoSheet.tsx` — wrapper réutilisable (overlay, handle, titre, close)
- `HelpSheet.tsx` — contenu d'aide
- `NotificationsSheet.tsx` — statut push, test, activation
- `VoiceSettingsSheet.tsx` — réglages voix
- `PrivacySheet.tsx` — confidentialité notes vocales
- `SubscriptionSheet.tsx` — abonnement

Câblage dans BriefApp : `helpOpen`, `notificationsOpen`, `voiceSettingsOpen`,
`privacyOpen`, `subscriptionOpen` + handlers. `AccountSheet` reçoit
`onOpenVoice`/`onOpenPrivacy`/`onOpenSubscription`. Toggles cliquables,
NavRows avec onClick.

### 3. Notifications push réelles

- `enablePush()` de `push-client.ts` : service worker, permission iOS,
  `pushManager.subscribe` avec VAPID, envoie l'abonnement au serveur
- `sendTestPush()` : test réel via `/api/push/test`
- `readPushState()` appelé au démarrage (`useEffect` dans BriefApp) pour
  restaurer le statut d'abonnement — fini le retour à "Désactivées"
- Routes `/api/push/test` et `/api/push/subscribe` avec PIN

### 4. Stockage des audios vocaux

- `POST /api/audio` — reçoit multipart FormData (blob + mimeType), garde PIN,
  sauvegarde dans `$BRIEF_DATA_DIR/audio/`, ID `audio_<timestamp36>`,
  extension dérivée du mimeType (.m4a / .webm), écriture atomique
- `GET /api/audio/[id]` — sert l'audio avec Content-Type correct, PIN requis
- `uploadAudio(blob, mimeType)` dans `api.ts` — FormData, PIN injecté
- **Bug critique corrigé** : `jsonFetch()` forçait `Content-Type:
  application/json` sur TOUTES les requêtes avec body, y compris les FormData.
  Ça écrasait le `multipart/form-data` + boundary → l'upload échouait
  silencieusement à chaque fois (400). Fix : skip Content-Type pour FormData.
- **Race condition corrigé** : l'upload était fire-and-forget. Si
  l'utilisateur envoyait avant la fin, `audioIdRef.current` était null.
  Fix : `send()` fait `await audioUploadRef.current` avant de lire l'audioId.

### 5. audioOrigin — FIL D'ORIGINE complet sur la fiche

Quand on dicte, `send()` construit maintenant l'`audioOrigin` :
- `text` : transcription complète
- `highlight` : titre de la tâche (extrait surligné)
- `startSec: 0`, `endSec/durationSec: recorder.seconds`
- `date` : ISO timestamp
- `siblingIds` : IDs des autres items de la même dictée

`TaskDetailScreen` affiche le FIL D'ORIGINE complet : label mono, bouton play,
waveform avec segment actif, citation avec extrait surligné en jaune, liens
vers les items frères. Fallback "ENREGISTREMENT VOCAL" pour les items avec
audioId seul (sans audioOrigin).

### 6. Sous-tâches générées par le parseur

- Le prompt de `/api/parse` demande maintenant au LLM de générer des
  `subtasks` quand la note décrit plusieurs étapes pour une même tâche
- Chaque sous-tâche : `{ id, title, done }` — verbe à l'infinitif
- Seulement pour les tâches (pas pour les events ni les idées)
- `coerce()` parse et valide les subtasks (max 10)
- Le type `SubTask` existait déjà dans `types.ts`, `DraftItem.subtasks?`
  aussi — l'API items les persiste déjà

### 7. Assistant IA — tuile "Demander à l'IA"

- `POST /api/chat` — route gardée par PIN, lit items + projets du store,
  construit un system prompt en français avec les tâches/RDV du jour +
  liste des projets, appelle Ollama Cloud
  (`https://ollama.com/v1/chat/completions`, modèle
  `deepseek-v4-flash:0731`, 30s timeout, `stream: false`,
  `max_tokens: 1000`, `temperature: 0.7`)
- `chatWithAssistant(messages)` dans `api.ts` — PIN injecté, 30s timeout
- `ChatSheet.tsx` — vraie UI de chat : bulles (user droite encre/white,
  assistant gauche surface/border), indicateur de frappe animé (3 points),
  auto-scroll, envoi par Enter, message de bienvenue
- BriefApp : `chatOpen` state, `handleChatSend` callback, `onOpenChat` prop
- HomeScreen : la tuile "Demander à l'IA" ouvre le ChatSheet (plus le capture)
- `OLLAMA_API_KEY` + `CHAT_MODEL` ajoutés au `.env.production` du VPS

### 8. Sélecteur de projet dans la capture

- `ProjectSelector.tsx` — bouton compact avec pastille couleur + forme +
  nom du projet + chevron. Dropdown s'ouvre vers le HAUT (pour ne pas être
  coupé). Ferme au clic dehors.
- Intégré dans `CaptureSheet` : chaque brouillon a son sélecteur
- Projet détecté automatiquement par défaut, modifiable au tap

### 9. Couleurs des boutons Tâche / Rendez-vous / Idée

- `TypeSegmented.tsx` : task → bleu (task-100/task-700), meet → vert
  (meet-100/meet-700), idea → jaune (idea-100/idea-700)
- Fini le tout-noir — chaque type porte sa couleur de destination

### 10. Couleurs de projet = couleurs Apple Calendar exactes

Vérifiées le 22/08/2026 dans l'app Calendrier iPhone d'Aramis :

| Projet | Tint | Calendrier Apple | Couleur | Hex |
|---|---|---|---|---|
| Frip & Trend | 1 | Vinted Frip&Trend | bleu | #007AFF |
| My Flip | 2 | My Flip | orange | #FF9500 |
| Web@cadémie | 3 | Web@académie | rouge | #FF3B30 |
| Perso | 4 | Personnel | violet | #AF52DE |
| Sport | 5 | Sport | jaune | #FFCC00 |
| IA | 6 | IA | vert | #34C759 |

Tokens `--color-p1` à `--color-p6` mis à jour dans `globals.css`.

### 11. Calendrier "Fake" visible dans l'agenda

- `EXTRA_AGENDA_CALENDARS = ["Fake"]` ajouté à `agendaCalendarNames()`
- Les événements du calendrier "Fake" (ex: "Commander les sacs Nike sur
  HippoBuy") apparaissent maintenant dans l'agenda Brief

### 12. Recherche améliorée

- Tuiles de résultats agrandies (padding, icônes 14→16px, texte 15→16px)
- Pastilles de couleur de projet + forme sur chaque résultat
- Micro vocal branché (`useRecorder` + `transcribeAudio`)

## Decisions — choix critiques ou irréversibles

- **Stockage audio sur le volume `brief-data`** : les blobs audio sont
  persistés dans `$BRIEF_DATA_DIR/audio/` avec écriture atomique. L'`audioId`
  est attaché à l'item, l'`audioOrigin` contient les métadonnées (texte,
  highlight, durée, siblings).
- **`jsonFetch` ne force pas Content-Type sur FormData** : règle absolue —
  le navigateur doit set `multipart/form-data` avec son boundary.
- **`send()` attend l'upload audio** : `await audioUploadRef.current` avant
  de lire l'audioId. Sans ça, le race condition perd l'audio.
- **Assistant IA via Ollama Cloud** : modèle `deepseek-v4-flash:0731`,
  clé `OLLAMA_API_KEY` dans `.env.production`. Le system prompt inclut le
  contexte des tâches/RDV du jour + projets.
- **Couleurs de projet = couleurs Apple Calendar** : vérifiées
  visuellement le 22/08/2026. Ne pas changer sans reverifier dans l'app
  Calendrier iPhone.
- **Calendrier "Fake" inclus dans l'agenda** : Aramis y pose des tâches.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/app/api/audio/route.ts` | **NEW** — POST upload audio (multipart, PIN, atomic write) |
| `src/app/api/audio/[id]/route.ts` | **NEW** — GET audio (PIN, Content-Type) |
| `src/app/api/chat/route.ts` | **NEW** — POST chat IA (Ollama Cloud, contexte items+projets) |
| `src/components/InfoSheet.tsx` | **NEW** — wrapper sheet réutilisable |
| `src/components/HelpSheet.tsx` | **NEW** — sheet d'aide |
| `src/components/NotificationsSheet.tsx` | **NEW** — sheet notifications (statut, test, activation) |
| `src/components/VoiceSettingsSheet.tsx` | **NEW** — sheet réglages voix |
| `src/components/PrivacySheet.tsx` | **NEW** — sheet confidentialité |
| `src/components/SubscriptionSheet.tsx` | **NEW** — sheet abonnement |
| `src/components/ChatSheet.tsx` | **NEW** — UI chat IA (bulles, typing, auto-scroll) |
| `src/components/ProjectSelector.tsx` | **NEW** — sélecteur projet compact (dropdown vers le haut) |
| `src/components/BriefApp.tsx` | memo, useCallback, sheets, audioOrigin, chat, push state |
| `src/components/HomeScreen.tsx` | memo, onHelp/onNotifications/onOpenChat props |
| `src/components/AgendaScreen.tsx` | memo EventRow, formateurs module-level |
| `src/components/TaskDetailScreen.tsx` | section audioId-only, FIL D'ORIGINE |
| `src/components/CaptureSheet.tsx` | ProjectSelector intégré |
| `src/components/TypeSegmented.tsx` | couleurs task/meet/idea |
| `src/components/SearchScreen.tsx` | tuiles agrandies, pastilles projet, micro vocal |
| `src/components/AccountSheet.tsx` | toggles cliquables, NavRows onClick, onOpen* props |
| `src/app/globals.css` | tokens couleurs p1-p6, touch-action, contain, chatdot anim |
| `src/lib/api.ts` | uploadAudio, chatWithAssistant, FormData Content-Type fix |
| `src/lib/types.ts` | audioId? sur DraftItem |
| `src/app/api/parse/route.ts` | prompt subtasks, coerce subtasks |
| `src/app/api/items/route.ts` | accept audioId |
| `src/lib/caldav.ts` | EXTRA_AGENDA_CALENDARS (Fake) |
| `src/lib/push-client.ts` | enablePush, sendTestPush, readPushState (existant, utilisé) |

## Validations

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ **246 passed** |
| `npx tsc --noEmit` | ✅ propre |
| `npm run build` | ✅ |
| Prod HTTP | ✅ 200 |
| `brief-app-1` | ✅ Healthy |

## Blockers

Aucun. Prod saine.

## Next — la prochaine action

1. **Version desktop V1** : Claude Code doit reprendre le design system
   (`Brief Design System.dc.html` + `DESIGN.md`) pour créer une version
   desktop responsive de Brief. Le prototype interactif est dans
   `docs/design-system-ref.dc.html` (copié depuis le zip fourni par Aramis).
   Le design system définit : tokens (couleurs, typo, radius, spacing),
   prototype navigable (Home, Détail tâche, Agenda, Idées, Recherche,
   Compte, Voix→tâches), recettes Tailwind.
2. **Vérifier visuellement sur iPhone** : le FIL D'ORIGINE + sous-tâches
   sur une nouvelle dictée (bug FormData corrigé, race condition corrigé).
3. **Améliorer l'assistant IA** : permettre la création de tâches
   directement depuis le chat (appeler `/api/parse` ou `/api/items`).

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-22 (soir)** | **Audio storage, assistant IA, sheets, couleurs projets, perf iPhone** | **Hermes Agent** | *(cette passation)* |
| 2026-08-20 (soir 2) | Coche d'une occurrence dont `due` a déjà avancé (cron) | Hermes Agent | [fiche](docs/handoffs/2026-08-22-hermes-audio-ia-sheets.md) |
| 2026-08-20 (soir) | Occurrence cochée vs `due` avancé par le cron | Claude Code | [fiche](docs/handoffs/2026-08-20-occurrence-cochee-due-avance-cron.md) |
| 2026-08-20 (après-midi) | Séance push corrigée + icône PWA + DESIGN.md restauré | Claude Code | [fiche](docs/handoffs/2026-08-20-phantom-occurrence-icone-design-restaure.md) |
| 2026-08-20 (jour) | Accès agents aux tâches/RDV + query token | Hermes Agent | [fiche](docs/handoffs/2026-08-20-acces-agents-query-token.md) |