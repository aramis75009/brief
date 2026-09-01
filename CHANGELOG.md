# Changelog

Format : une entrée par version, la plus récente en haut. Version à quatre
chiffres (`MAJEUR.MINEUR.CORRECTIF.MICRO`), source de vérité dans `VERSION` —
`package.json` en porte la traduction npm à trois chiffres, npm refusant le
quatrième.

> **Les entrées antérieures à `1.1.0.0` sont reconstituées** depuis
> `git log` et les passations de `docs/handoffs/`. Elles n'ont pas été écrites
> au moment des faits : elles situent, elles ne font pas foi. À partir de
> `1.1.0.0`, chaque entrée est écrite pendant la PR qui la livre.

---

## 1.2.0.0 — 2026-09-01

### Chaque compte possède ses données — lot 1 du pivot multi-utilisateur (PR #14)

Brief n'écrivait qu'un seul jeu de fichiers, pour tout le monde. Un second
compte Supabase autorisé y voyait donc les tâches, les rendez-vous et les
dictées du premier. Ce lot donne à chaque compte ses propres fichiers, sous
`BRIEF_DATA_DIR/users/<userId>/`, et rend impossible pour une route d'aller
lire ceux d'un autre.

> ⚠️ **Ce déploiement déplace des données.** Lancer `deploy/backup.sh` AVANT,
> puis poser `SUPABASE_SECRET_KEY` et `BRIEF_OWNER_USER_ID` dans
> `.env.production`. Sans la seconde, le serveur démarre et paraît sain : la
> migration refuse de deviner, et la synchro calendrier ne tourne plus.

**Ajouté**

- `storeForUser(userId)` — seul constructeur d'un `Store`, dont les fichiers
  vivent sous `users/<userId>/`. La file d'écritures sérialisée est désormais
  **par compte** : un passage de cron lent chez l'un ne bloque plus la requête
  interactive d'un autre.
- `requireStore()` (`src/lib/guard.ts`) — la garde de session ET la résolution
  d'identité en un appel, ce qui rend impossible d'avoir l'une sans l'autre.
- `listAuthorizedUserIds()` (`src/lib/supabase/admin.ts`) — l'inventaire des
  comptes pour les crons, qui n'ont pas de session. C'est le seul fichier du
  projet à porter la clé service-role.
- `sweepUsers` (`src/lib/cron-sweep.ts`) — un compte en échec n'interrompt
  jamais les suivants, et l'ordre tourne d'un passage à l'autre pour qu'aucun
  compte ne soit systématiquement le dernier servi.
- **Migration automatique au démarrage** (`src/instrumentation.ts`) : les
  fichiers d'avant deviennent le Brief du compte propriétaire. Idempotente,
  non destructive (les originaux partent dans `_pre-multiuser/`), et elle ne
  devine jamais — sans `BRIEF_OWNER_USER_ID` elle s'arrête et l'écrit.
- Deux invariants outillés : aucune route ne lit `process.env.BRIEF_DATA_DIR`
  et aucune n'appelle `storeForUser` elle-même
  (`src/lib/no-direct-store-access.test.ts`).

**Corrigé**

- **N'importe quel compte autorisé pouvait écouter les dictées d'un autre.**
  Les deux routes `/api/audio` recomposaient un répertoire global depuis
  `BRIEF_DATA_DIR` sans passer par le store, et les identifiants
  (`audio_<timestamp base36>`) sont énumérables. Elles demandent maintenant
  leur chemin au store du compte connecté.
- **Le cron CalDAV aurait écrit l'agenda entier du propriétaire chez chaque
  autre compte.** Les identifiants iCloud sont globaux jusqu'au lot 3 ; le
  passage ne traite donc que `BRIEF_OWNER_USER_ID` et répond 503 s'il manque.
- **Une panne Supabase n'éteint plus les rappels de tout le monde.** La liste
  des comptes lève quand Supabase est injoignable, et rendait la route
  inopérante ; elle se replie sur le propriétaire et le journalise comme
  dégradé. Une liste vide rendue *sans* erreur (clé sur le mauvais projet,
  table renommée) déclenche le même repli.
- **Un passage de rappels qui ne sert aucun compte répond 503, plus 200.** Le
  `curl -fsS` du conteneur cron doit tomber : c'est le seul signal d'échec qui
  sorte du serveur quand plus aucun rappel ne peut partir.
- **La migration ne pouvait plus se rattraper après un démarrage sans
  `BRIEF_OWNER_USER_ID`.** Elle se fiait à l'existence de `users/<owner>/`,
  que la première écriture venue crée ; c'est désormais le répertoire
  d'archive qui fait foi, et lui seul.
- **Les dictées n'étaient pas migrées du tout**, et chaque fiche tâche
  affichait un lecteur audio rendant 404. Un fichier que la migration doit
  sauter reste à la racine et le journal l'avertit — il ne sera jamais repris.
- **Un `BRIEF_OWNER_USER_ID` saisi en majuscules cassait tout, en production
  seulement.** L'identifiant devient un chemin : sur l'ext4 du VPS, migration
  vers `users/A1B2…/` annoncée en succès pendant que les routes lisaient
  `users/a1b2…/`. Le macOS de développement, insensible à la casse, ne montre
  rien. Une seule graphie normalisée désormais.
- **Le budget des crons était calé sur `maxDuration` (40 s) et non sur le vrai
  client**, `curl -fsS -m 30`. Assez de comptes et curl abandonnait, imprimant
  `[cron] passage échoué` chaque minute sur des passages réussis — le seul
  signal d'échec du déploiement devenait du bruit permanent.

**Interne**

- `src/lib/store.ts` n'exporte plus aucune fonction globale : c'est leur
  suppression qui a **prouvé** que tous les appelants étaient portés, le
  typecheck les ayant tous nommés.
- `src/lib/push-store.ts` → `src/lib/push-subscription.ts` (la partie pure).
- Premiers tests de `/api/cron/reminders`, qui n'en avait aucun. 575 → 589
  tests.
- `SUPABASE_SECRET_KEY` et `BRIEF_OWNER_USER_ID` ajoutés à `.env.example` et
  `.env.production.example` ; le contrat `-m 30` ↔ `SWEEP_BUDGET_MS` est écrit
  des deux côtés (`docker-compose.yml` et les deux routes).
- Design et plan du pivot : `docs/superpowers/specs/` et
  `docs/superpowers/plans/`.

---

## 1.1.0.0 — 2026-08-31

### Kanban « copie Trello » (PR #9)

**Ajouté**

- **Glisser-déposer réel** du Kanban desktop : carte déplaçable entre colonnes
  et **à une position précise** dans une colonne, colonnes déplaçables par leur
  pastille, barre « Non placées » devenue une cible de dépôt, déplacement au
  clavier (Espace, flèches, Espace).
- `PATCH /api/board/cards` — le client envoie une **intention** (« entre ces
  deux cartes-là »), jamais des rangs. L'écran ne voit qu'un sous-ensemble de
  chaque colonne ; le serveur relit la colonne complète dans la file
  d'écriture et numérote lui-même.
- `src/lib/kanban.ts` — logique pure du board, testée sans DOM ni disque.
- `Item.columnOrder` : le rang d'une carte survit au rechargement.
- Composeur « + » par colonne, héritant du filtre projet actif.
- Limite WIP par colonne : **indicative** (la colonne pleine accepte le dépôt
  et se signale), comptée sur la colonne complète et non sur les cartes
  visibles.
- Passe de récupération dans `GET /api/board` : les cartes orphelinées par les
  suppressions passées repartent en « Non placées ».

**Corrigé**

- **Supprimer une colonne faisait disparaître ses cartes.** Elles gardaient un
  `columnId` qui ne pointait plus nulle part : affichées ni dans une colonne,
  ni dans « Non placées » (dont le filtre est `!columnId`). Le menu promettait
  pourtant de « vider ».
- **Le bouton « + » d'une colonne supprimait la colonne.** Il appelait
  `onDeleteColumn`. Combiné au bug ci-dessus, un clic faisait disparaître
  toutes les cartes de la liste.
- **`reorder` ne réordonnait rien.** L'action existait sans appelant ; une fois
  branchée, `renumber()` re-triait sur l'ancien `order` juste après le tri
  demandé et l'annulait — réponse 200, board inchangé.
- Un dépôt qui échoue ne revient plus en silence : toast d'erreur et retour à
  l'état serveur. Le succès reste muet, comme Trello.
- La carte cesse d'être un `<button>` : il capturait Espace, que le capteur
  clavier de dnd-kit attend pour saisir.
- L'action `delete` du board réconcilie les objectifs — l'invariant
  « réconciliation après toute écriture d'item, sans liste blanche de champs »
  d'`AGENTS.md` était contourné.

**Interne**

- `updateItemsAtomically` / `updateBoardAtomically` : lecture-modification-
  écriture dans la file d'écriture sérialisée.
- +65 tests (531 au total). `/api/board` avait zéro test avant cette PR.

---

## 1.0.0.0 — 2026-08-30 *(reconstituée)*

L'état de `main` avant le chantier Kanban. Brief est en production sur le VPS
Hostinger, installé en PWA sur l'iPhone, et envoie ses rappels en Web Push.

- **Graphe & Objectifs** (PR #2, #3) : un objectif se complète tout seul quand
  toutes ses dépendances sont faites, il ne bloque rien. Le graphe montre
  tâches, RDV et objectifs ; disposition manuelle persistée par appareil.
- **Accès agenda machine** (PR #4) : `GET /api/agenda` porte une garde mixte
  (session utilisateur **ou** jeton machine), pour que les agents la lisent
  sans navigateur.
- **Réglages desktop derrière l'avatar** (PR #6, #7) : store `settings.json`,
  bloc « Compte » avec la déconnexion qui manquait au desktop, et les bascules
  « Calendrier Apple » / « Digest Telegram » agissent vraiment.
- **Landing page SaaS** servie sur `/landing` (2026-08-29).
- **Occurrences manquées des récurrentes** enfin visibles (2026-08-29).

## 0.9.0.0 — 2026-08-27 *(reconstituée)*

- **Authentification Supabase** (email + mot de passe) remplace le PIN.
  `requireSession()` devient l'unique garde des routes `/api/*` ; `BRIEF_PIN`,
  `x-brief-pin` et `requirePin()` sont supprimés.
- Parcours « mot de passe oublié » complet.

## 0.8.0.0 — 2026-08-26 *(reconstituée)*

- **Design system Claude Design v1** — l'ancien système corail / General Sans
  est abandonné (`DECISIONS.md`).
- Onglet Agenda desktop : tâches et RDV, progression de la semaine.
- Correctifs de récurrence : la complétion repart de l'occurrence cochée, pas
  de celle qu'un cron a avancée.

## 0.7.0.0 — 2026-08-20 *(reconstituée)*

- **Synchro CalDAV bidirectionnelle** avec le calendrier Apple, qui devient la
  source de vérité pour les horaires et les récurrences.
- Correctif du `DTSTART` flottant (`20260820T140000`, sans `Z` ni tirets) qui
  faisait planter **toute l'app** dans tous les navigateurs :
  `Intl.DateTimeFormat.formatToParts()` levait une `RangeError` et React ne
  montait plus. Fix en trois couches. Voir
  `docs/handoffs/2026-08-19-caldav-floating-dtstart.md`.

## 0.5.0.0 — 2026-08-14 *(reconstituée)*

- **Vue desktop** (≥ 1024 px) : Shell, Header, Calendrier, Kanban, fiche tâche,
  Dashboard, Idées, Tâches, palette de commandes.
- Tous les calculs de date passent par `src/lib/zoned.ts` (`Europe/Paris`) —
  les méthodes locales de `Date` lisent le fuseau de la machine, et la
  production tourne en UTC.

## 0.2.0.0 — 2026-08-10 *(reconstituée)*

- **Web Push** depuis le serveur, prouvé sur iPhone verrouillé. iOS ne donne
  aucune API de notification programmée à une PWA : c'est le serveur qui
  possède l'horloge.
- Déploiement VPS Hostinger : `docker-compose` (app + cron + volume), Traefik.

## 0.1.0.0 — 2026-08-06 *(reconstituée)*

- Scaffold Next.js 16 / React 19 / Tailwind v4.
- Capture vocale : Whisper transcrit, un LLM découpe la note en tâches et
  rendez-vous datés.
- Stockage en fichiers JSON, écriture atomique, file d'écritures sérialisée.
