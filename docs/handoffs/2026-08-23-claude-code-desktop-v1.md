# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-23 (nuit) · Version desktop V1

| | |
|---|---|
| **Agent** | Claude Code (Sonnet 5) / Aramis |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | Poussés dans cette session — voir `git log --oneline -6` |
| **Prod (avant déploiement)** | VPS `/docker/brief` était sur `06e90e5` (vérifié par SSH direct, `scripts/coord/status.sh` le donne à tort « injoignable » — voir mémoire `coord-scripts-faux-positifs`). **GitHub était déjà 23 commits devant la prod avant même cette session** (le travail audio/IA de Hermes du 22/08 n'avait pas encore été déployé). **Ce déploiement doit donc inclure le travail du 22/08 ET celui-ci.** |

## Goal — l'objectif

Porter fidèlement le prototype Claude Design `Brief Desktop.dc.html` (projet
claude.ai/design, id `90e528e2-e7a4-45ce-8ede-a063e5982aef`) en composants
React réels, connectés aux vraies données, sans rien casser côté mobile. Puis,
sur retour visuel d'Aramis (deux allers-retours), densifier le Dashboard pour
qu'il tienne sur un écran sans scroll, et le simplifier.

## Current state — ce qui a été fait

Import du prototype via l'outil `DesignSync` (MCP Claude Design, `/design-sync`)
— 5 écrans, nav horizontale, palette ⌘K, modale de capture, toast, entièrement
spécifiés en CSS inline avec une logique JS de démo (données statiques). Porté
en composants React sous `src/components/desktop/`, branchés sur l'état et les
callbacks déjà existants dans `BriefApp.tsx` — **aucune deuxième source de
vérité** : les cinq écrans desktop lisent `sent`/`overview`/`todayAgenda`/
`projects`, exactement les mêmes qu'HomeScreen/AgendaScreen/IdeasScreen.

### Bascule mobile/desktop

`src/lib/useIsDesktop.ts` — `matchMedia('(min-width: 1024px)')` via
`useSyncExternalStore`, SSR-safe (`false` côté serveur, comme `useHydrated`).
Dans `BriefApp.tsx`, après les gates hydration/PIN : `isDesktop ?
<DesktopShell/> : <PhoneFrame/>`. **Aucun fichier/composant mobile modifié**
dans son rendu — `HomeScreen`, `AgendaScreen`, `IdeasScreen`, `TaskDetailScreen`,
`SearchScreen`, `BottomNav` sont byte-identiques. Vérifié en navigateur à
390×844 : PIN persiste, HomeScreen inchangé, zéro erreur console.

### Les cinq écrans (`src/components/desktop/`)

- **DesktopHeader.tsx** — marque, nav pilule (badges tâches/RDV/idées), ⌘K,
  cloche (→ `NotificationsSheet` existant), avatar (→ `AccountSheet`
  existant), Dicter.
- **DesktopDashboard.tsx** — hero (charge de la semaine, calculée depuis
  `overview.horizon`) + **3 cartes** (état final, après simplification — voir
  « Deux allers-retours » plus bas) : Capture (version animée de Claude
  Design, waveform `idle`), Aujourd'hui, Avancement + En retard fusionnés
  dans la même carte (donut + `weekProgressByProject` + `overdueItems()`).
- **DesktopCalendar.tsx** — grille semaine (56px/heure, 7h→21h, DESIGN.md §7)
  ou mois. **Une seule source d'occurrences** : `fetchAgendaDay()` (même
  fusion items+CalDAV que mobile), un fetch par jour visible, en parallèle,
  mis en cache par date — aucune expansion RRULE/override recalculée ici.
  Panneau de détail à droite (« sélection ») : résout un `Item` réel si ouvert
  depuis un autre écran, sinon une `AgendaItem` posée directement dans le
  calendrier.
- **DesktopTasks.tsx** — **écran neuf, n'existe pas sur mobile.** Filtres
  (Toutes/Aujourd'hui/En retard/Faites), groupé par projet, répartition par
  priorité, ajout rapide sans voix (`quickAddTask`, demain 09:00, priorité 2).
- **DesktopIdeas.tsx** — grille de cartes. « Planifier demain » fixe une vraie
  échéance (`promoteIdeaTomorrow`, demain 09:00, priorité 2) — **différent du
  bouton mobile** qui convertit sans échéance. Assumé : sur desktop, l'idée
  quitte réellement la boîte.
- **DesktopSettings.tsx** — cartes de destination (couleur+forme+charge
  réelle depuis `overview.byProject`) + toggles Chaîne. Trois bascules
  (CalDAV/Digest/PIN) sont **décoratives**, comme sur `AccountSheet` mobile
  (aucune des deux versions ne les câble à un vrai réglage serveur) ; seule
  « Rappels push » agit réellement (même chemin que `NotificationsSheet`).
- **CommandPalette.tsx** (⌘K) — recherche dans `sent` par titre + 4 commandes
  statiques (Dicter, Calendrier, Idées, Alléger). Raccourci global (⌘K/Esc)
  géré par `DesktopShell`.

### Réutilisation, pas duplication

- `CaptureSheet.tsx` : nouveau prop `variant?: "sheet" | "modal"` — change
  **seulement l'enveloppe extérieure** (feuille du bas vs modale centrée
  720px). Les 4 étapes (idle/listening/transcribing/done, avec `TypeSegmented`
  + `ProjectSelector` + `datetime-local` déjà éditables) sont inchangées.
  Testé en vrai : dictée texte → LLM → revue éditable centrée → enregistrement
  → toast, dans la modale desktop.
- Toutes les feuilles partagées (Capture, Compte, Aide, Notifications, Voix,
  Confidentialité, Abonnement, Chat, Toast) restent possédées par `BriefApp.tsx`
  — extraites dans une fonction `renderSharedSheets()` appelée par les deux
  branches (mobile et desktop), chacune enveloppée dans son propre
  `fixed inset-0` (nécessaire sur desktop : le tableau de bord peut dépasser
  la hauteur de viewport, un `absolute` sans ancêtre positionné se serait
  scrollé hors champ).
- `src/lib/desktopDashboard.ts` — calculs purs testés (16 tests,
  `desktopDashboard.test.ts`) : `overdueItems`, `weekProgressByProject`,
  `leastUrgentId`, `filterTasks`, `groupByProject`, `priorityBreakdown`,
  `mondayOf`. Tous passent par `zoned.ts`/`buckets.ts` — **même définition
  d'« en retard »/« cette semaine » que `/api/overview`**, jamais recalculée.

### Deux allers-retours de retouche visuelle (après le premier rendu)

**1. Densité « tout tient sur un écran, jamais de scroll de page ».** Aramis a
fourni 4 captures d'un dashboard RH de référence (« Crextio ») en demandant de
s'en inspirer pour la DENSITÉ (proportions de cartes, gros chiffres) — **pas**
la palette (dégradé jaune refusé, `DESIGN.md` interdit les dégradés). Réponse :
- `DesktopShell.tsx` : `h-dvh overflow-hidden` (plus `min-h-dvh`) ; la zone
  d'écran est `flex-1 min-h-0`.
- Chaque écran (`DesktopDashboard`/`Calendar`/`Tasks`/`Ideas`/`Settings`)
  passe en `h-full`, avec un scroll INTERNE par carte/colonne
  (`min-h-0 overflow-y-auto`) plutôt qu'un scroll de page — une liste
  inhabituellement longue (beaucoup de tâches un jour chargé) défile dans sa
  carte, la page ne bouge jamais.
- Piège rencontré et corrigé : `justify-center` combiné à `overflow-y-auto`
  sur un flex-col rend le DÉBUT du contenu inaccessible au scroll si ça
  déborde (bug CSS connu du centrage flex + overflow) — coupait le haut ET
  le bas de la carte « Chaîne & sync » à l'époque où elle existait encore.
  Retenir : ne jamais combiner les deux ; ancrer en haut (`justify-start`/
  par défaut) dès qu'une zone peut défiler.
- Le décalage d'un jour dans « Horizon 7 jours » (`day.date.slice(8,10)` lisait
  le jour UTC au lieu du jour Paris) et les bascules `ToggleRow` de Réglages
  qui s'effondraient à 0×0 (`<button>` enveloppant un `<span>` dimensionné,
  sans dimension propre) ont été trouvés et corrigés pendant cette QA — voir
  détail dans « Bugs trouvés et corrigés » plus bas.

**2. Simplification du Dashboard (sur retour direct d'Aramis, capture annotée).**
Le Dashboard passe de 8 cartes (3 lignes) à 3 cartes (1 ligne) :
- **Retirés du rendu** (pas du modèle de données — `weekProgressByProject`,
  `overview.horizon`, `overview.peak` restent dans `desktopDashboard.ts`/
  `Overview`, juste plus consommés ici) : Horizon 7 jours, Ton mur, la
  prévisualisation Idées, et Chaîne & sync. **« On verra ce qu'on en fait »**
  — décision volontairement provisoire, pas un abandon.
- **Capture** retrouve la version animée de Claude Design (26 barres,
  `animation: idle`, `rgba(255,255,255,.3)` sur fond encre — supprimée par
  erreur lors du portage initial) et sa taille de base (padding 22px, plus le
  padding resserré à 18px de la passe de densité).
- **En retard** rejoint la carte Avancement, dans l'espace qui restait vide
  sous les barres de progression (Aramis l'a entouré sur une capture) — un
  séparateur `1px` sépare les deux sections dans la même carte.
- **Logo** : le pictogramme micro + texte « Brief » du header est remplacé par
  `public/icon-192.png` (l'icône PWA réelle), 36×36, `borderRadius: 10`.
- **Nettoyage en cascade** : `DesktopShell` ne calcule plus `goCalendarDay`
  (plus personne ne l'appelle) ni le state `calendarGoTo` — retirés avec le
  prop `goToDateKey` de `DesktopCalendar.tsx`, plutôt que de laisser du code
  mort. Le prop `pendingCount` de `DesktopShell`/`BriefApp` (n'existait que
  pour Chaîne & sync) est retiré aussi. `npx eslint` confirmait chaque retrait
  (`no-unused-vars`) avant de committer.

## Decisions — choix critiques ou irréversibles

- **Le prototype `.dc.html` fait foi, pas `DESIGN.md` §7.** Le prototype (nav
  horizontale en pilule dans le header) contredit `DESIGN.md` §7 (« rail de
  navigation 248px à gauche »). Le prototype est postérieur (21/08, généré
  après validation d'Aramis via Claude Design/Hermes) et bien plus concret —
  suivi tel quel. `DESIGN.md` §7 est maintenant partiellement obsolète sur ce
  point ; à corriger dans une session dédiée au design system, pas ici.
- **« Ouvrir une tâche » sur desktop = naviguer vers Calendrier + sélectionner.**
  Le prototype n'a PAS de troisième écran de détail séparé (contrairement à
  la description abstraite du drawer 428px dans `DESIGN.md` §7) : le panneau
  de détail du Calendrier EST la fiche desktop, pour tous les items, même
  ouverts depuis le Dashboard ou Tâches. Suivi tel quel — réduit le périmètre
  sans rien perdre (toutes les infos de la fiche mobile y sont).
- **Calendrier : un fetch par jour visible (`fetchAgendaDay`), jamais de
  RRULE/override recalculé côté client.** Alternative rejetée : réimplémenter
  l'expansion récurrente client-side (plus rapide en requêtes, mais **une
  deuxième définition d'occurrence** — exactement la classe de bug que le
  projet a payée plusieurs fois en août, voir `AGENTS.md`). Coût accepté :
  jusqu'à ~42 requêtes parallèles en vue mois. Pas mesuré comme lent en local ;
  à surveiller en prod si le VPS souffre.
- **Kanban explicitement hors périmètre V1.** `TODOS.md` liste « Version
  Desktop & Vue Kanban » comme un seul chantier tranché le 2026-08-15 ; le
  prototype fourni par Aramis ne contient aucun board Kanban/drag-and-drop —
  seulement les 5 écrans livrés ici. Kanban reste à spécifier séparément.
  `TODOS.md` mis à jour pour séparer les deux.
- **Horizon 7 jours / Ton mur / aperçu Idées / Chaîne & sync retirés du
  Dashboard, décision volontairement provisoire.** Mots d'Aramis : « le reste
  tu le mets de côté, on verra ce qu'on va en faire. » Ne pas réinterpréter
  ça comme un abandon définitif ni les faire réapparaître sans qu'il le
  redemande — la logique (`weekProgressByProject`, `overview.horizon`,
  `overview.peak`) reste dans `desktopDashboard.ts`/`Overview`, prête à être
  reconsommée le jour venu.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/components/desktop/DesktopShell.tsx` | **NEW** — cadre desktop (header + nav + 5 écrans + palette), remplace `PhoneFrame` à ≥1024px |
| `src/components/desktop/DesktopHeader.tsx` | **NEW** — bandeau (marque, nav, ⌘K, cloche, avatar, Dicter) |
| `src/components/desktop/DesktopDashboard.tsx` | **NEW**, puis réduit à 3 cartes (Capture animée/Aujourd'hui/Avancement+En retard) sur retour d'Aramis |
| `src/components/desktop/DesktopCalendar.tsx` | **NEW** — écran Calendrier semaine/mois + panneau détail (419 lignes) |
| `src/components/desktop/DesktopTasks.tsx` | **NEW** — écran Tâches, n'existe pas sur mobile (187 lignes) |
| `src/components/desktop/DesktopIdeas.tsx` | **NEW** — écran Idées (112 lignes) |
| `src/components/desktop/DesktopSettings.tsx` | **NEW** — écran Réglages (132 lignes) |
| `src/components/desktop/CommandPalette.tsx` | **NEW** — palette ⌘K (144 lignes) |
| `src/components/desktop/types.ts` | **NEW** — type `DesktopScreen` |
| `src/lib/useIsDesktop.ts` | **NEW** — hook de bascule mobile/desktop |
| `src/lib/desktopDashboard.ts` | **NEW** — calculs purs (retards, progression, filtres, priorité) |
| `src/lib/desktopDashboard.test.ts` | **NEW** — 16 tests |
| `src/components/CaptureSheet.tsx` | `variant?: "sheet" \| "modal"` sur l'enveloppe extérieure uniquement |
| `src/components/BriefApp.tsx` | branche `isDesktop`, `archiveIdea`/`promoteIdeaTomorrow`/`quickAddTask`, `renderSharedSheets()` |
| `src/components/desktop/DesktopShell.tsx` | `h-dvh overflow-hidden` (densité) ; `pendingCount`/`goCalendarDay`/`calendarGoTo` retirés (code mort) |
| `src/components/desktop/DesktopCalendar.tsx` | `h-full` + scroll interne par colonne ; prop `goToDateKey` retiré (plus appelé) |
| `src/components/desktop/DesktopTasks.tsx` | `h-full` + scroll interne (liste tâches, colonne priorité) |
| `src/components/desktop/DesktopIdeas.tsx` | `h-full` + scroll interne (grille de cartes) |
| `src/components/desktop/DesktopSettings.tsx` | `h-full` + scroll interne ; bug bascules 0×0 corrigé |
| `src/components/desktop/DesktopHeader.tsx` | logo PWA (`icon-192.png`) remplace le pictogramme micro + texte « Brief » |

## Validations — passants / échoués / non lancés

```
npx tsc --noEmit          → ✅ propre
npx eslint <fichiers touchés> → ✅ 0 erreur (0 warning sur les fichiers touchés — les 17 restants sont pré-existants, non liés)
TZ=UTC npx vitest run     → ✅ 261 passed | 1 skipped (262) — baseline 245+1, +16 nouveaux
npm run build             → ✅ « Compiled successfully » — lancé APRÈS avoir arrêté `npm run dev` (règle AGENTS.md)
```

QA visuelle manuelle via `/browse` (gstack), serveur `npm run dev -- -p 3100`,
sur trois passes (portage initial, densité, simplification) : 5 écrans,
palette ⌘K, modale de capture (dictée texte → LLM → revue éditable →
enregistrement réel), quick-add Tâches, sélection Calendrier — testés en
conditions réelles (PIN local, LLM réel via `/api/parse`), zéro erreur console
à chaque capture. Testé à 1440×900, 1728×1117 (16") et 390×844 (mobile,
non-régression). Aucun bug connu restant.

**Bugs trouvés et corrigés pendant cette session (déjà dans le code, pas des
TODO) :**
1. `DesktopDashboard.tsx`, Horizon 7 jours (retiré depuis, mais le bug avait
   déjà été corrigé avant le retrait — noté pour mémoire) : `day.date.slice(8,10)`
   lisait le jour UTC d'un ISO string au lieu du jour Europe/Paris (minuit
   Paris = 22h UTC l'été) → décalage d'un jour. Corrigé via `zonedParts()`
   avant que la carte ne soit retirée du rendu.
2. `DesktopSettings.tsx` : les 4 bascules (`ToggleRow`) s'effondraient à 0×0 —
   un `<button>` enveloppant un `<span>` dimensionné, sans dimension propre,
   se réduit à zéro au lieu d'hériter du contenu. Fusionné en un seul élément
   (le `<button>` porte directement les styles du pilule), comme
   `RowCheckbox` le fait déjà ailleurs dans le code.
3. `justify-center` + `overflow-y-auto` sur un flex-col coupait le haut ET le
   bas du contenu débordant (bug CSS connu, pas seulement notre code) — touché
   sur l'ancienne carte Chaîne & sync avant son retrait. Retenir pour toute
   nouvelle zone scrollable desktop : ancrer en haut, jamais centrer.

## Blockers

Rien. Poussé sur `feat/ui-redesign-claude` dans cette session, à la demande
explicite d'Aramis (« tu peux push et deploie »).

**Le déploiement VPS reste à faire — c'est le relais explicite d'Aramis vers
Hermes Agent.** Je (Claude Code, sur le Mac) n'ai pas d'accès SSH/docker au
VPS depuis cet environnement — seule la vérification en lecture
(`ssh -i ~/.ssh/brief_vps root@186.241.16.37 'cd /docker/brief && git rev-parse HEAD'`,
voir mémoire `coord-scripts-faux-positifs`) est possible d'ici. **Hermes doit
lancer, sur le VPS** :
```bash
cd /docker/brief && git pull origin feat/ui-redesign-claude \
  && docker compose --env-file .env.production up -d --build
```
Avant `git pull` : la prod est encore sur `06e90e5`, donc ce pull ramène
**23+ commits d'un coup** — le travail audio/IA du 22/08 (jamais déployé) PLUS
la version desktop V1 de cette session. Après déploiement : vérifier
`brief-app-1` *healthy*, `curl` un 200 sur l'URL publique, et que le bundle
inclut bien `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (déjà un piège connu — voir
`AGENTS.md`, invariant « Déploiement »).

Deux items de test créés dans `.data/items.json` **local** (pas la prod — ce
répertoire n'existe que sur ce Mac, `BRIEF_DATA_DIR` n'est pas posé dans
`.env.local`, fallback `./.data`) pendant la QA : « Vérifier le test desktop »
(Frip & Trend) et « Appeler le plombier pour le devis » (My Flip). Sans
conséquence, mais à savoir si le prochain `npm run dev` local affiche des
tâches inattendues.

## Next — la prochaine action

**C'est Hermes Agent qui reprend la main pour la suite** (demande explicite
d'Aramis, 23/08 matin) :

1. **Déployer** — `cd /docker/brief && git pull origin feat/ui-redesign-claude
   && docker compose --env-file .env.production up -d --build`. Voir
   « Blockers » ci-dessus pour le contexte (23+ commits d'un coup, deux
   sessions jamais déployées).
2. **Vérifier en prod** : `brief-app-1` *healthy*, un `curl` en 200 sur l'URL
   publique, le PIN gate fonctionne, et à l'ouverture sur un écran ≥1024px la
   version desktop apparaît (pas le cadre téléphone). Vérifier aussi qu'un
   iPhone voit toujours la version mobile inchangée.
3. **Écrire la prochaine passation** avant de repartir — même si c'est « juste »
   un déploiement, `AGENTS.md` l'exige (archiver celle-ci dans
   `docs/handoffs/`, en écrire une nouvelle).
4. Plus tard, sans urgence : `DESIGN.md` §7 à corriger pour refléter la nav
   horizontale réelle (au lieu du rail 248px décrit) — et statuer sur Horizon
   7 jours / Ton mur / aperçu Idées / Chaîne & sync (« on verra ce qu'on en
   fait », pas encore tranché).

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-23 (nuit)** | **Version desktop V1** | **Claude Code** | *(cette passation)* |
| 2026-08-22 (soir) | Audio storage, assistant IA, sheets, couleurs projets, perf iPhone | Hermes Agent | [fiche](docs/handoffs/2026-08-22-audio-storage-ia-sheets-couleurs.md) |
| 2026-08-20 (soir 2) | Coche d'une occurrence dont `due` a déjà avancé (cron) | Hermes Agent | [fiche](docs/handoffs/2026-08-22-hermes-audio-ia-sheets.md) — nom de fichier trompeur, contenu vérifié le 23/08 |
| 2026-08-20 (soir) | Occurrence cochée vs `due` avancé par le cron | Claude Code | [fiche](docs/handoffs/2026-08-20-occurrence-cochee-due-avance-cron.md) |
| 2026-08-20 (après-midi) | Séance push corrigée + icône PWA + DESIGN.md restauré | Claude Code | [fiche](docs/handoffs/2026-08-20-phantom-occurrence-icone-design-restaure.md) |
| 2026-08-20 (jour) | Accès agents aux tâches/RDV + query token | Hermes Agent | [fiche](docs/handoffs/2026-08-20-acces-agents-query-token.md) |
