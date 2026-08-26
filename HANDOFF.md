# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-26 (soir) · Auth Supabase (email + mdp) DÉPLOYÉE en prod — PIN retiré

| | |
|---|---|
| **Agent** | **Hermes Agent** — *je passe la main* (passation précédente : Claude Code, 26/08 après-midi) |
| **Branche** | `feat/email-password-auth` = **prod depuis le 26/08 soir** (fast-forward depuis `feat/ui-redesign-claude`) |
| **Commits** | `a620f49` = HEAD local + origin + **prod déployée et vérifiée** (dont `a13af27` flux mdp oublié, `80361c7` passation, `c13217c` base auth) |

## Goal — l'objectif

Le PIN partagé (`BRIEF_PIN`) est remplacé par une auth par utilisateur
(email + mot de passe, Supabase Auth) — le code de Claude Code (14 tâches +
revue de branche, tout fusionné) était prêt et provisionné côté Supabase ;
**Hermes a fait le déploiement VPS** (étapes a→e de la passation précédente),
vérifié, et la **prod sert désormais l'auth**. Il reste à Aramis de se
connecter une fois en réel (étape e, cf. « Next ») et à traiter les points
différés de `TODOS.md` § P0 bis.

## Current state — ce qui a été fait

### 0. ✅ Desktop : onglet « Tâches & RDV » + avancement semaine fiabilisé (26/08 soir, commit `a620f49`, déployé)

Demande d'Aramis : les RDV étaient zappés par le desktop (l'écran Tâches ne
montrait que les `kind: "task"` alors que le mobile a des CTA Tâches /
Rendez-vous / Idées). Corrigé :

- **Onglet « Tâches » → « Tâches & RDV »** (`DesktopHeader` + `DesktopTasks`) :
  liste les tâches ET les RDV par défaut, avec un **filtre par type**
  (Tout / Tâches / RDV) à côté des filtres d'état existants. Sur « RDV »,
  les filtres d'état disparaissent (les RDV n'ont pas de « En retard »).
  Les lignes RDV portent une pastille « RDV · <date> » en teinte meet.
- **CTA du hero Dashboard cliquables** (`DesktopDashboard`) : les barres
  « Tâches / RDV / Idées » ouvrent l'onglet pré-filtré
  (`onGoTasksKind` → `DesktopShell` state `tasksKind` → `initialKind`).
- **Avancement de la semaine** : `weekProgressByProject` compte désormais
  les RDV (`kind: "event"`) en plus des tâches — les barres reflètent la
  vraie semaine. Le compteur « cette semaine » du hero était calculé sur
  l'horizon **7 jours glissants** de `/api/overview` → remplacé par
  `weekOpenCounts` (**lundi→dimanche**, mêmes bornes que les barres).
  Le donut « Aujourd'hui » n'a pas été touché (il était déjà correct).
- Nouveaux helpers purs dans `src/lib/desktopDashboard.ts` :
  `filterAgendaItems` (filtre par type), `weekOpenItems` / `weekOpenCounts`
  (bornes semaine partagées). Le badge de l'onglet compte tâches + RDV.

### 1. ✅ Déploiement VPS — effectué et vérifié (Hermes, 26/08 soir)

Les étapes a→e de la passation précédente ont été exécutées :

- **a. `.env.production`** (`/docker/brief`) : ajout des deux variables
  Supabase — `NEXT_PUBLIC_SUPABASE_URL` et
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clé publishable complète,
  récupérée auprès d'Aramis, vérifiée par longueur + correspondance exacte).
  La **Secret key** (`sb_secret_…`) n'est entrée nulle part.
- **b. Résolution vérifiée** : `docker compose --env-file .env.production
  config` résout les deux variables (URL 40 car., clé 46 car., aucun
  `${...}` littéral).
- **c. Build + up** : `docker compose --env-file .env.production up -d
  --build` — exit 0, **healthcheck jamais testé en vrai jusqu'ici : il
  passe** (`healthy`), le conteneur `cron` a démarré (il attend ce healthy).
- **d. Vérifications post-déploiement** :
  - `curl -i https://brief.srv1899780.hstgr.cloud/api/auth/session` → **401**
    `{"error":"Session invalide ou expirée."}` (pas de 500 → variables
    présentes au build).
  - `docker inspect --format '{{.State.Health.Status}}' brief-app-1` →
    **healthy**.
  - `GET /` → 200. `POST /api/auth/login` avec identifiants bidon → 401
    « Email ou mot de passe incorrect. » (signe qu'il faut maintenant
    `authorized_users` → la liste blanche est réellement consultée).
  - Rappels : log cron `[cron] checked=56 … failures=0`. Sync CalDAV :
    réponse `skipped` normale (fenêtre 15 min), jetons machine inchangés.
- **Bascule de branche** : `/docker/brief` est passé de
  `feat/ui-redesign-claude` (`d2d9316`) à **`feat/email-password-auth`
  (`c13217c`)** en fast-forward (bundle+scp+ff, le remote HTTPS sans
  credentials). `feat/ui-redesign-claude` reste sur GitHub, intacte et en
  retard de 25 commits — **ne pas la merger ni l'avancer sans demande
  explicite** (elle n'est plus la branche servie).
- **Sauvegarde** : `brief-20260826-094904.tar.gz` (1.1M) dans
  `/var/backups/brief/` avant le redéploiement.

### 1. Design et implémentation — complets, fusionnés (Claude Code)

- **Spec** : `docs/superpowers/specs/2026-08-26-email-password-auth-design.md`.
- **Plan** : `docs/superpowers/plans/2026-08-26-email-password-auth.md` (14
  tâches, corrigé en cours de route — voir Decisions).
- **Maquette approuvée par Aramis** (écran de connexion, logo animé) :
  `https://claude.ai/code/artifact/5655973d-ef06-4ed1-8585-90c6af776456`.
- Les 14 tâches sont passées par un cycle complet implémenteur → relecteur,
  avec boucles de correction quand nécessaire (détail exhaustif dans le
  ledger SDD, supprimé avec le worktree — l'historique git fait foi
  maintenant, `git log --oneline d2d9316..c803c96`).
- **Revue de branche complète** (Opus) a trouvé 3 défauts critiques de
  **déploiement**, invisibles à l'échelle d'une seule tâche — tous corrigés
  et revérifiés (voir Decisions). Verdict final : **Ready to merge — Yes.**
- **Fusion locale faite** : `feat/email-password-auth-sdd` → `feat/email-password-auth`
  (un conflit dans `DECISIONS.md`, résolu en gardant la version la plus
  complète). Worktree nettoyé, branche technique supprimée.

### 2. Ce que ça change concrètement

| | Avant | Après |
|---|---|---|
| Garde `/api/*` | `requirePin(req)` (PIN partagé, header `x-brief-pin`) | `await requireSession()` (JWT Supabase, cookie httpOnly) |
| Écran de connexion | `PinGate.tsx` (supprimé) | `AuthGate.tsx` (email + mot de passe) |
| Session | localStorage + cookie JS, PIN en clair | Cookie httpOnly, rafraîchi par `src/proxy.ts` (Next 16 : `middleware.ts` → `proxy.ts`, renommage pris en compte) |
| Autorisation | N'importe qui avec le PIN | Table `authorized_users` (Postgres/Supabase), liste blanche à l'entrée |
| Routes machine (cron/capture/digest) | Jeton machine dédié | **Inchangé** |

### 3. ✅ Provisionnement Supabase terminé (Claude Code, 26/08)

Projet `brief`, `https://nqakaefcwdpotnatcdvb.supabase.co`,
Frankfurt/eu-central-1, healthy :

1. ✅ Projet créé.
2. ✅ Providers : Email seul actif (déjà le défaut sur ce projet, rien à changer).
3. ✅ `supabase/migrations/0001_authorized_users.sql` appliquée.
4. ✅ Compte d'Aramis créé (`aramis.begnene@gmail.com`, invité par email),
   inséré dans `authorized_users` (vérifié : 1 ligne).
5. ✅ Clé de signature JWT : **déjà asymétrique (ECC P-256) nativement** sur
   ce projet — pas de migration à faire.
6. ✅ Site URL = `https://brief.srv1899780.hstgr.cloud`, Redirect URL
   `https://brief.srv1899780.hstgr.cloud/**` ajoutée.

## Decisions — choix critiques ou irréversibles

- **Email + mot de passe, pas email + code OTP.** Le brainstorming initial
  était parti sur un code à usage unique envoyé par email ; Aramis a corrigé
  en cours de route (« email plus mdp »). Design et maquette refaits en
  conséquence — voir la conversation, pas archivée séparément.
- **`authorized_users` = liste blanche à l'entrée, pas un verrou en continu.**
  Retirer une ligne bloque les futures connexions mais ne révoque **pas**
  une session déjà ouverte (le cookie httpOnly continue d'être rafraîchi par
  `src/proxy.ts` jusqu'à expiration naturelle). Pour couper l'accès
  immédiatement, désactiver/supprimer dans `auth.users` côté Supabase.
  Nuance ajoutée à `DECISIONS.md` après que la revue finale l'ait signalée.
- **`requireSession()` ne vérifie PAS `authorized_users` à chaque requête**,
  seulement au login (`/api/auth/login`). Sans inscription libre dans
  Brief, `auth.users` EST déjà la liste blanche ; `authorized_users` sert
  surtout de métadonnées (nom, dernière connexion) + défense en profondeur
  au moment de la connexion, pas un contrôle permanent — ce qui garde
  `requireSession()` sans appel réseau par requête (une fois la clé JWT
  passée en asymétrique).
- **Deux défauts de plan trouvés au pré-scan SDD, corrigés avant tout
  dispatch** : la policy RLS de `authorized_users` ne couvrait que `select`
  alors que le login fait aussi un `update` (RLS aurait bloqué silencieusement,
  0 ligne, aucune erreur) → policy `update` ajoutée. `PinGate.tsx` n'était
  jamais explicitement supprimé dans le plan initial alors qu'il devenait
  orphelin → ajouté à la tâche de nettoyage final.
- **Pas de bouton de déconnexion pendant longtemps — revenu dessus.** Le plan
  supposait à tort qu'un bouton « Verrouiller » existait déjà (faux, vérifié
  par grep). Première décision : ne pas en ajouter (hors périmètre). La
  revue de branche finale a renversé cette décision à raison : contrairement
  à l'ancien PIN (effaçable par l'utilisateur), le nouveau cookie httpOnly
  ne peut être terminé par **aucune** action utilisateur sans un bouton.
  Ajouté : `AccountSheet.tsx` a maintenant une ligne « Se déconnecter ».
- **3 défauts critiques trouvés uniquement à la revue de branche complète**
  (invisibles à l'échelle d'une tâche) — tous corrigés dans une seule vague
  de correctifs, revérifiée :
  1. `/api/capture` appelait `/api/parse` en HTTP interne avec l'ancien
     header PIN (route désormais protégée par session) → 401 → capture
     cassée en silence. Corrigé par extraction de la logique de
     structuration dans `src/lib/parse.ts`, appelée directement (plus
     d'appel HTTP interne du tout).
  2. `Dockerfile` : `HEALTHCHECK` visait `POST /api/session` (supprimée) →
     conteneur jamais sain → `cron` (rappels Web Push) ne démarre jamais.
     Corrigé : `GET /api/auth/session`. **Testé en vrai au déploiement
     Hermes : passe.**
  3. `NEXT_PUBLIC_SUPABASE_URL`/`..._PUBLISHABLE_KEY` jamais câblées dans
     `Dockerfile`/`docker-compose.yml` (piège déjà documenté pour la clé
     VAPID, oublié pour Supabase) → site entièrement injoignable au
     déploiement. Corrigé, calqué sur le motif VAPID existant. **Testé en
     vrai au déploiement Hermes : les variables sont résolues et le site
     répond.**
- **Une branche technique (`feat/email-password-auth-sdd`) a servi de
  worktree** parce que `feat/email-password-auth` était déjà extraite dans
  la copie principale (git interdit une même branche dans deux worktrees).
  Fusionnée puis supprimée à la fin — ne pas la chercher, elle n'existe
  plus.

## Changed — fichiers et composants

Diff complet : `git diff d2d9316..c803c96 --stat` (~50 fichiers). Nouveaux :
`src/lib/supabase/server.ts` (pas de `client.ts` — jamais nécessaire, tout
passe par les routes `/api/auth/*` côté serveur), `src/lib/parse.ts`, `src/proxy.ts`,
`src/app/api/auth/{login,logout,session,forgot-password}/`,
`src/components/AuthGate.tsx`, `supabase/migrations/0001_authorized_users.sql`.
Supprimés : `src/lib/pin.ts`, `src/components/PinGate.tsx`,
`src/app/api/session/route.ts`. Modifiés : les 17 autres routes `/api/*`
(garde), `Dockerfile`/`docker-compose.yml` (healthcheck + build args),
`src/components/{BriefApp,AccountSheet}.tsx`, `AGENTS.md` (invariant
sécurité), `DECISIONS.md`, `eslint.config.mjs` (`argsIgnorePattern`).

Côté déploiement (cette passation) : `.env.production` du VPS a gagné les
deux variables `NEXT_PUBLIC_SUPABASE_*` (jamais commitées) ; `/docker/brief`
est désormais branché sur `feat/email-password-auth` @ `c13217c` ;
`docs/handoffs/2026-08-26-email-password-auth-claude-code.md` **NEW** —
archive de la passation précédente.

## Validations — passants / échoués / non lancés

### ✅ Passants

| Commande / geste | Résultat |
|---|---|
| `npx vitest run` (Claude Code, merge) | 27 files, **345 passed** \| 1 skipped |
| `npx vitest run` (Hermes, 26/08 soir) | **356 passed** (flux mdp oublié + desktop Tâches & RDV) |
| `npx eslint src` | 0 errors, 29 warnings (baseline pré-existante) |
| `npx tsc --noEmit` | propre |
| `docker compose --env-file .env.production config` | variables Supabase résolues |
| `docker compose --env-file .env.production up -d --build` | exit 0, **brief-app-1 healthy** (healthcheck exercé pour la 1re fois en vrai) |
| `GET /api/auth/session` (sans cookie) | **401** « Session invalide ou expirée. » |
| `GET /` | 200 |
| `POST /api/auth/login` (identifiants bidon) | **401** « Email ou mot de passe incorrect. » |
| Rappels (cron) | `[cron] checked=56 … failures=0` |
| Sync CalDAV (jeton machine) | route répond, `skipped` (fenêtre 15 min) |
| Sauvegarde | `brief-20260826-094904.tar.gz` créée et lue |

### ⚠️ Non lancés / à vérifier

1. **Étape e — test de connexion réel** : se connecter une fois sur
   `https://brief.srv1899780.hstgr.cloud` avec `aramis.begnene@gmail.com` +
   le mot de passe choisi via le lien d'invitation Supabase (déjà reçu par
   email). **C'est Aramis qui peut le faire** (il détient le mot de passe).
   Rien d'autre ne bloque la migration.
2. **`src/app/layout.tsx:60` — `LayoutProps` introuvable** en `tsc` si le
   `.next/types` n'a pas été régénéré récemment (dépend d'un `next dev`/`build`
   récent, pas du code de cette migration — confirmé disparaître/réapparaître
   selon l'état de `.next`). Pas bloquant, pré-existant.
3. **Flux « mot de passe oublié » — ✅ COMPLET depuis le 26/08 soir (commit
   `a13af27`, déployé)** : `redirectTo` vers `/auth/reset-password`, échange
   du code dans `src/proxy.ts`, page de saisie du nouveau mot de passe,
   route `POST /api/auth/reset-password` (`updateUser`). 6 tests ajoutés
   (351 au total).
4. **`scripts/brief-agents.sh agenda`** cassé (PIN header vers une route
   migrée) — `digest` fonctionne toujours. Voir `TODOS.md`.
5. **Aucune purge de l'état client à la déconnexion** (`BriefApp.tsx`) — sans
   impact tant qu'un seul compte existe ; à traiter avant un 2e utilisateur.

## Blockers

**Aucun blocage technique.** Le déploiement est terminé et vérifié. Points
d'attention :

- **La prod n'est plus sur `feat/ui-redesign-claude`** — elle sert
  `feat/email-password-auth` (@ `c13217c`). Ne pas merger ni avancer
  `feat/ui-redesign-claude` sans demande explicite d'Aramis (25 commits en
  retard sur la nouvelle prod ; elle n'est plus servie).
- **`feat/email-password-auth` n'est pas (encore) fusionnée dans
  `feat/ui-redesign-claude` ni dans `main`** : la prod est branchée
  directement dessus. C'est un choix délibéré (passation Claude Code +
  consigne Aramis « ne merge pas dans feat/ui-redesign-claude sans me
  redemander »). Toute évolution de prod passe par cette branche.
- **Le PIN est mort** : les routes `/api/*` refusent le header `x-brief-pin`
  (garde `requireSession()`). Les scripts/raccourcis qui l'utilisaient
  (`brief-agents.sh agenda`, éventuels raccourcis iOS à base de PIN) sont à
  migrer — voir `TODOS.md` § P0 bis.
- **Le remote prod (/docker/brief) reste HTTPS sans credentials** : se
  déployer par bundle+scp+ff.
- **Ne pas lancer `npm run dev` sur ce conteneur** (AGENTS.md) : le port 3000
  appartient au bridge WhatsApp.

## Next — la prochaine action

1. **Aramis : étape e — ✅ FAIT (26/08 soir)** : connexion en réel validée
   (« Tout fonctionne, j'ai pu me reconnecter »). Le flux de bout en bout est
   confirmé — migration auth close. Il a aussi validé le flux « mot de passe
   oublié » réparé le même soir (choix du mot de passe via
   `/auth/reset-password`).
2. **Puis traiter les points différés de `TODOS.md` § P0 bis** (script
   `brief-agents.sh agenda` cassé, purge de l'état client à la déconnexion,
   doc README/coordination/agent-calendar-access encore périmée — le point
   le plus gênant : le tableau des variables d'env de `README.md` omet les
   deux clés Supabase et liste encore `BRIEF_PIN`).
3. **Rétro : le compteur « Charge de la semaine » du hero ne prend plus
   `overview.horizon`** (7 j glissants) mais `weekOpenCounts` (lundi→dimanche)
   — si l'incohérence persiste quelque part, vérifier `overview.totals.week`
   (encore glissant) avant de creuser.
4. Les deux refontes Claude Design (calendrier desktop + fiche tâche) restent
   en attente du livrable `.dc.html` (décision du matin 26/08).

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-26 (soir)** | **Auth Supabase (email + mdp) DÉPLOYÉE — PIN retiré** | **Hermes Agent** | *(cette passation)* |
| 2026-08-26 (après-midi) | PIN → Supabase Auth : code + provisionnement prêts, déploiement pour Hermes | Claude Code | [fiche](docs/handoffs/2026-08-26-email-password-auth-claude-code.md) |
| 2026-08-26 (matin) | Cinq chantiers poussés et déployés ; refonte Calendrier + Fiche par Claude Design | Hermes Agent | [fiche](docs/handoffs/2026-08-26-matin-chantiers-deployes-hermes.md) |
| 2026-08-25 (soir) | Cinq chantiers front-end : waveform, DnD Kanban, calendrier, fiche, graphe | Claude Code | [fiche](docs/handoffs/2026-08-25-cinq-chantiers-frontend-claude-code.md) |
| 2026-08-25 (matin) | État du repo + défi Kanban/dépendances/Graphe pour Claude Code | Hermes Agent | [fiche](docs/handoffs/2026-08-25-hermes-etat-repo-mission-bugs.md) |
| 2026-08-24 (après-midi) | Vue Graphe et recette de l'existant | Claude Code | [fiche](docs/handoffs/2026-08-24-graphe-recette-claude-code.md) |
| 2026-08-24 (matin) | Kanban, tags, dépendances, fiche tâche, donut fix | Hermes Agent | [fiche](docs/handoffs/2026-08-24-kanban-tags-dependances-fiche.md) |
| 2026-08-23 (matin, 2e) | Desktop V1.1 : Réglages, priorités, IA, projets | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-kanban-tags-deps.md) |
| 2026-08-23 (matin) | Déploiement desktop V1 + audio/IA du 22/08 | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-deploy-desktop-v1.md) |
| 2026-08-23 (nuit) | Version desktop V1 (5 écrans, nav pilule, dashboard 3 cartes) | Claude Code | [fiche](docs/handoffs/2026-08-23-claude-code-desktop-v1.md) |
