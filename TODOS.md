# TODOS — Brief

Registre du travail différé. **Rien de différé ne vit ailleurs** (ré-écrit
le 2026-08-29 lors du grand ménage, sections « ✅ FAIT / DÉPLOYÉ » archivées
dans `docs/handoffs/`).

---

## P0 — En cours (branches actives)

### Landing page SaaS multi-utilisateur

**Quoi :** Brief va devenir un SaaS multi-utilisateur. Une preview d'accueil
est faite dans `docs/landing/multi-user-v1.html` (style MyFlip, tokens
fidèles au design system v1, rail vocal en carte phare). **À retravailler**
avant mise en ligne.

- **Prix 0/6/12 € = placeholders** à trancher avec Aramis.
- **CTA non branché** sur le futur signup Supabase multi-user.
- **Mockup téléphone** à actualiser une fois l'app stabilisée.
- **Découpage** en composants Next.js + route `/` marketing (non livré).
- **Dark mode + SEO/perf** non traités.
- Règle : la landing est un **modèle de travail**, pas une page finie. Voir
  `docs/landing/README.md` pour la checklist complète.

### Pivot multi-utilisateur Brief — lot 1 fait, lots 2 et 3 à faire

**Quoi :** chaque utilisateur crée son compte et a **son** Brief (dictées,
tâches, idées propres, sans partage par défaut).

Design complet et six décisions arbitrées :
[`docs/superpowers/specs/2026-08-31-pivot-multi-utilisateur-design.md`](docs/superpowers/specs/2026-08-31-pivot-multi-utilisateur-design.md).

- ✅ **Lot 1 — cloisonnement** (31/08, branche `feat/multi-user-store`) :
  fichiers par compte sous `users/<userId>/`, fabrique `storeForUser`,
  `requireStore()`, crons qui itèrent, migration au démarrage. **Pas encore
  déployé.**
- ⬜ **Lot 2 — jetons machine par compte** : table `machine_tokens` (hachés,
  révocables), écran dans les Réglages. Aujourd'hui `capture` et `digest`
  écrivent chez `BRIEF_OWNER_USER_ID` — un seul Brief joignable par machine.
- ⬜ **Lot 3 — CalDAV par compte** : table `caldav_credentials` chiffrée
  (AES-256-GCM), écran de saisie, mapping projet → calendrier par utilisateur.
  Aujourd'hui les quatre variables `BRIEF_CALDAV_*` sont globales et
  mono-compte : **un seul compte iCloud pour toute l'app**.

---

## P1 — Desktop (livrée V1, en recettage)

### Recettage desktop — retirer les écarts Claude Design

- **Calendrier desktop** (`DesktopCalendar.tsx`) : affichage des événements
  sur **voies** (pas de superposition). Livré, en recettage par Aramis.
  Refonte complète à venir (décision du 26/08, livrable Claude Design
  attendu).
- **Fiche tâche desktop** (`DesktopTaskDetail.tsx`) : livrée et recettée,
  refonte Claude Design à venir (décision du 26/08).
- ~~**Kanban desktop** : tags `unplaced` dans la mauvaise colonne~~ —
  **périmé**, vérifié le 31/08 : le filtre tenait déjà compte du `columnId`.
  `DesktopKanban.tsx` a été réécrit depuis (PR #9).
- **Teintes iOS saturées** (`DesktopTaskDetail.tsx:40`) : 10 couleurs
  saturées (`#FF3B30`…) apparaissent dans la liste d'affectation projet —
  doivent être remplacées par les teintes `p1–p8` du design system.
- **Saisie d'idées par le clavier** dans `CaptureBar` desktop : fonctionne,
  à recetter.

### Bugs desktop ouverts (de la session 2026-08-25)

- **Bouton « Rien à structurer »** reste visible sur une dictée vide —
  masqué côté mobile, à faire aussi sur desktop.
- **`<button>` imbriqué** dans `TodayRow` / `RowCheckbox` : erreur HTML
  (hydration React), à corriger quand on y touche.

### ~~⚠️ Bug Kanban — drag & drop pas Trello~~ — **livré (PR #9)**

Signalé par Aramis le 30/08 : « on ne peut pas déplacer les cartes comme on
veut ». Livré le 31/08 : carte déplaçable entre colonnes et **à une position
précise** dans une colonne, colonnes déplaçables, « Non placées » devenue une
cible de dépôt, clavier (Espace / flèches / Espace). Plan et recette :
`docs/plans/2026-08-31-kanban-trello-calendrier.md`.

Trois bugs trouvés en chemin et corrigés dans la même PR : supprimer une
colonne **faisait disparaître ses cartes** (`columnId` mort), le bouton « + »
d'une colonne **supprimait la colonne**, et l'action `reorder` de
`PATCH /api/board` n'avait aucun appelant — puis, une fois branchée, ne
réordonnait rien.

### ⚠️ Les étiquettes ne se voient pas dans la fiche tâche (Aramis, 31/08)

**Signalé après la recette de la PR #9. Non reproduit, non investigué** —
Aramis a demandé explicitement de garder ça pour un lot ultérieur.

Deux choses distinctes dans le même signalement :

1. **Bug.** On configure des étiquettes dans **Réglages**, et elles
   **n'apparaissent pas** quand on ouvre le détail d'une tâche. Le lien entre
   les deux écrans ne se fait pas.
2. **Design.** Le bouton d'ajout d'une étiquette **n'est pas assez visible**
   dans la fiche.

À ne pas traiter comme acquis : le Kanban affiche bien les étiquettes en haut
des cartes (`KanbanCard.tsx`), donc la donnée existe et le rendu marche
ailleurs. Le problème est probablement entre `DesktopSettings` (création) et
la fiche tâche (lecture) — mais c'est une hypothèse, pas un diagnostic.

### ⚠️ « Reporter » perd l'heure et ne retire pas l'occurrence du jour (Aramis, 31/08)

**Signalé à l'oral, non reproduit, non investigué** — noté ici pour ne pas le
perdre. Deux symptômes dans le même geste :

1. La tâche part bien au **lendemain**, mais **pas à la même heure** que la date
   d'origine.
2. L'occurrence **d'aujourd'hui ne disparaît pas** — elle apparaît donc deux
   fois.

Constaté sur un **RDV**. Aramis l'a déplacé à la main dans l'app Calendrier.

Piste à ne PAS traiter comme acquise : `caldavSyncedDue` est déjà signalé comme
divergeant en silence d'iCloud quand une écriture locale touche `due`
(`docs/plans/2026-08-31-kanban-trello-calendrier.md`, « Signalé, non traité »
#1) — et le bouton « Repousser +1j » de `DesktopCalendar.tsx` y est nommément
cité. Les deux observations peuvent être la même cause, ou pas.

### Quatre intentions déterrées par le ménage du 31/08 (code mort supprimé, intention conservée)

Ces quatre-là n'étaient pas des oublis de nettoyage : c'est du travail
commencé et jamais fini. Le code mort est parti, l'intention est ici.

1. **« Réessayer » après un échec, jamais construit.** `fail()` acceptait un
   callback de réessai **et le jetait**. Deux appels en construisaient un
   (structuration d'une dictée, envoi d'items) — inatteignables : `Toast` ne
   prend que `{ message, kind }` et il est en `pointer-events-none`, donc même
   pas cliquable. Un échec de capture vocale n'offre aucun recours.
2. **La file d'attente hors-ligne est invisible.** `queueSnapshot` était
   souscrit dans `BriefApp` et **jamais rendu**. Un item mis en file quand le
   réseau tombe n'apparaît nulle part : l'utilisateur ne sait pas qu'il a
   quelque chose en attente. `src/lib/queue.ts` fonctionne, c'est l'affichage
   qui manque.
3. **`loadProjects({ silent: true })` n'a jamais été silencieux.** L'option
   était déclarée, jamais lue. Deux appels la passaient en croyant éviter un
   état de chargement visible.
4. **`groupByProject` n'est utilisé que par ses propres tests.** La fonction
   vit dans `src/lib/desktopDashboard.ts`, elle est testée, et **aucun écran
   ne l'appelle**. Soit un écran l'attend, soit elle doit partir — mais du
   code testé qui ne sert à rien coûte de la confiance mal placée.


### Réglages mobile — les 3 bascules décoratives d'`AccountSheet`

**Quoi :** `AccountSheet.tsx` (mobile) porte encore trois bascules qui ne font
rien — « Calendrier Apple », « Structuration auto », « Rappels du matin ». Le
desktop a été traité le 30/08 (store `settings.json` + `/api/settings`, voir
`DECISIONS.md`) ; le mobile a été **volontairement laissé de côté** (Aramis :
« le mobile est en stand-by, on s'occupe du desktop »).

- « Calendrier Apple » et un éventuel « Digest » : brancher sur le store
  existant, il n'y a plus rien à concevoir côté serveur.
- « Structuration auto » : n'a pas d'équivalent desktop — préférence par
  appareil (localStorage, patron `queue.ts`) plutôt que `settings.json`.
- « Rappels du matin » (heure fixe 8:00) : demande un vrai réglage d'heure,
  donc un troisième champ dans `Settings`. À concevoir.

---

## P1 — Mobile (iPhone PWA)

### Micro et raccourci

- **Micro iOS de la PWA** reste capricieux au premier accès — la demande de
  permission ne s'affiche pas toujours. Workaround actuel : saisie clavier.
  À reprendre proprement (raccourci iOS dédié fonctionne).
- **Raccourci iOS sur bouton Action** : fonctionne, reste à fiabiliser
  (network timeout + notification silencieuse en cas d'échec).

### Workflow Telegram ↔ Hermes ↔ Brief

**Quoi :** brancher les interactions Telegram sur les items Brief (récap
matinal n8n déjà en prod) pour créer / modifier des items depuis Telegram.
Stade : design écrit (`docs/research/`), pas de code.

---

## P2 — Prévu, pas urgent

### Stocker les enregistrements vocaux

**Annoncé par Aramis le 2026-08-19** comme le prochain chantier. Garder le
fichier audio attaché à l'item (`data/audio/`), pour qu'il puisse réécouter
la dictée. Non chiffré.

### Workflow conversationnel n8n

Évolutions du hub d'automatisations n8n (récap 8h30 + 18h30 déjà en prod) :
intégration Brief native (pas uniquement digest), réponses aux questions
Brief, notifications ciblées.

### Dette connue

Leçons du passé à garder sous la main (à consulter avant de coder sur un
sujet proche) :

- **CalDAV flottant** : `docs/handoffs/2026-08-19-caldav-floating-dtstart.md`
  — un `DTSTART` ICS sans `Z` ni tirets a crashé toute l'app le 19/08. Le
  fix est en 3 couches dans `store.ts` + `caldav.ts`. **Toujours tester
  la donnée, pas seulement l'API.**
- **`<button>` imbriqué** dans `TodayRow` — voir P1.
- **Drag & drop Kanban** : recetté partiellement, à vérifier edge cases.
- **Bouton mort → câbler une vraie feature**, jamais supprimer (règle
  Aramis).
- **Traefik `exposedbydefault=false`** : vérifier les labels si le site
  ne répond pas.

### « Retiré — ne pas réintroduire »

- **`BRIEF_PIN` / `x-brief-pin` / `requirePin()`** : supprimés le 26/08,
  ne pas réintroduire. La garde est `requireSession()` (Supabase Auth JWT).
- **Ancien système corail / General Sans** : supprimé le 20/08, ne pas
  ressusciter.
- **Branche `feat/ui-redesign-claude`** : absorbée puis supprimée à la fin
  août — ne pas la recréer.

---

## P3 — Recherches ouvertes

### Notes de session — 30/08 (Aramis, « idée floue à retravailler ensemble »)

> Dictée de fin de session par Aramis. « Bara » = travail (slang d'Aramis).
> Les points 1, 2, 4 sont livrés sur `feat/graphe-objectifs-moteur`
> (**PR #3, en recette** — voir `docs/handoffs/` et `DECISIONS.md` 30/08 soir).

1. ~~**Objectifs = moteur du graphe** / auto-complétion~~ — **livré (PR #3)**.
2. ~~**Les RDV dans le graphe**~~ — **livré (PR #3)** : toggle « RDV », un nœud
   par série.
3. ~~**Kanban = copie Trello**~~ — **livré (PR #9)** : glisser-déposer complet
   (cartes et colonnes), composeur « + » par colonne, limite WIP indicative,
   suppression de colonne qui renvoie ses cartes en « Non placées ».
   *Reste* : le Kanban **mobile**, hors périmètre assumé.
4. ~~**Objectifs personnalisables après création** (horizon, description)~~ —
   **livré (PR #3)** : édition inline titre / horizon / notes, bouton rouvrir.
   *Reste* : liste des dépendances **dans l'éditeur d'objectif** (le retrait
   ne se fait que par le « × » du graphe pour l'instant).
5. **Raccourcis de navigation** dans l'app : naviguer entre les onglets
   avec les flèches (← →). **Non commencé.**
6. **Revoir le calendrier** — peut-être ne pas vouloir copier le calendrier
   Apple (ça fait doublon) mais une autre interface. **Non commencé** —
   chantier de conception (brainstorming + livrable Claude Design).
7. ~~**Réglages** : PIN fantôme à retirer + déplacer les réglages sur le
   profil~~ — **livré** (`feat/reglages-desktop-profil`, PR #5) : avatar →
   écran Réglages, onglet retiré, bloc « Compte » (adresse, mot de passe,
   **déconnexion** — qui manquait totalement au desktop), et les bascules
   « Calendrier Apple » / « Digest Telegram » agissent vraiment via
   `settings.json`. *Reste* : le mobile (voir P1).
8. **Vrais messages de modification** adaptés au design system.
   ⚠️ **La parenthèse « aucun système de toast au design v1 » était fausse** —
   vérifié le 31/08 : `Toast.tsx` + `flash()` existent et sont montés en
   desktop (`BriefApp.tsx:182`, `:888`). Le Kanban s'en sert depuis la PR #9
   (dépôt, renommage, suppression, limite : chaque échec parle). *Reste* :
   passer les autres écrans en revue — et **le succès reste muet**, c'est une
   décision, pas un oubli.

### ⚠️ Une récurrence qui se termine ne se voit pas (validé par Aramis le 30/08)

**Quoi :** quand la dernière occurrence d'une série est cochée,
`completionPatch` clôt la série (`{ doneAt, rrule: null }`,
`src/lib/completion.ts:152`) et la tâche **disparaît** — du graphe, du digest,
de partout. Rien ne prévient. Le 30/08, « Poster 20 » et « Reposter 15 » se
sont éteintes comme ça et Aramis l'a vécu comme un bug du graphe.

Attendu : afficher « dernière occurrence » sur la tâche quand la série va se
clore, et le confirmer au moment de la coche. `nextOccurrence` sait déjà le
dire — elle rend `null`. Reste à le remonter jusqu'à l'écran.
9. **Hover sur les endroits clés** : dashboard, kanban, etc. Le graphe a
   gagné du hover (× de retrait sur les arêtes, PR #3), **le Kanban aussi**
   (bouton « ouvrir la fiche » révélé au survol de la carte, PR #9 — c'est ce
   qui a permis à la carte de cesser d'être un `<button>`). *Reste* :
   dashboard et listes.

### Roadmap « Asana personnalisé » (vision Brief)

Vision exprimée par Aramis : un Asana perso — **Kanban, tags, sous-tâches,
dépendances visuelles (graphe nœuds type n8n)**, dark mode à la fin. Le
socle Kanban / tags / sous-tâches existe déjà sur desktop. Non chiffré,
discussion à avoir avec Aramis avant engagement.

### Apprentissage des corrections de destination

Si Aramis corrige souvent une dictée vers `task` vs `idea` (ou inverse),
Brief devrait apprendre la préférence par contexte.

### Rappels déclenchés par un lieu

Geofencing iOS. Non prévu dans la roadmap actuelle, complexité non chiffrée.

### Scraper les concurrents (Asana, Monday, Trello)

Analyse comparative des features desktop pour prioriser la roadmap. Pas
commencé.

---

## Comment utiliser ce registre

- **Ne pas y déplacer de choses finies.** Archiver dans `docs/handoffs/`.
- **Un TODO sans P0/P1/P2/P3 n'existe pas ici.**
- **Si tu termines un TODO**, archive-le dans une passation `docs/handoffs`
  et retire la section d'ici.
- **Ne pas mettre en P0 plus de 2 sujets à la fois** — sinon rien n'est
  prioritaire.
