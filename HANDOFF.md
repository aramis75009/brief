# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-26 (après-midi) · PIN → Supabase Auth (email + mot de passe), fusionné, PAS déployé

| | |
|---|---|
| **Agent** | Claude Code (Sonnet 5) |
| **Branche** | `feat/email-password-auth` (fusion de `feat/email-password-auth-sdd`, supprimée après fusion) |
| **Commits** | `c803c96` = HEAD local (merge). Base de la branche : `d2d9316` (tip de `feat/ui-redesign-claude` au démarrage de la session). |

## Goal — l'objectif

Remplacer le PIN partagé unique (`BRIEF_PIN`) par une authentification par
utilisateur (email + mot de passe, Supabase Auth), à la demande d'Aramis
(sécurité + préparation au multi-utilisateur). Brainstorming → spec → plan
d'implémentation en 14 tâches → exécution par subagents (Subagent-Driven
Development) → revue de branche complète → correctifs → fusion locale.

## Current state — ce qui a été fait

### 1. Design et implémentation — complets, fusionnés

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

### 3. ⚠️ NON DÉPLOYABLE EN L'ÉTAT — provisionnement Supabase en cours

**Aramis a créé le projet Supabase pendant cette session** (`brief`,
`https://nqakaefcwdpotnatcdvb.supabase.co`, Frankfurt/eu-central-1, healthy).
**Reste à faire avant tout déploiement** — checklist complète dans `TODOS.md`
(section « P0 bis ») et dans le plan (Task 2, Step 6) :

1. ✅ Fait — créer le projet Supabase.
2. 🔶 En cours — activer email+mot de passe seul (Providers), appliquer
   `supabase/migrations/0001_authorized_users.sql`, créer le compte
   d'Aramis, l'insérer dans `authorized_users`.
3. Migrer la clé de signature JWT vers de l'asymétrique (sinon
   `requireSession()` fait un aller-retour réseau à chaque appel API).
4. Site URL / Redirect URLs Supabase → domaine réel de Brief.
5. `.env.production` sur le VPS : poser les deux clés Supabase, vérifier
   que `docker compose --env-file .env.production config` les résout.
6. Après déploiement : `curl -i https://<domaine>/api/auth/session` → 401
   attendu (un 500 = variable absente au build). Vérifier que le conteneur
   `cron` démarre (le healthcheck ciblait une route supprimée — corrigé,
   jamais testé avec un Docker réel dans cette session, seulement relu).

**Sans les étapes 1-2, Aramis ne peut plus se connecter à sa propre app** —
le PIN est retiré, rien ne le remplace tant que le compte Supabase n'existe
pas.

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
     Corrigé : `GET /api/auth/session`.
  3. `NEXT_PUBLIC_SUPABASE_URL`/`..._PUBLISHABLE_KEY` jamais câblées dans
     `Dockerfile`/`docker-compose.yml` (piège déjà documenté pour la clé
     VAPID, oublié pour Supabase) → site entièrement injoignable au
     déploiement. Corrigé, calqué sur le motif VAPID existant.
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

## Validations — passants / échoués / non lancés

### ✅ Passants (résultat merge, main checkout, vérifié après fusion)

```
npx vitest run     → 27 files, 345 passed | 1 skipped
npx eslint src      → 0 errors, 29 warnings (baseline pré-existante, confirmée
                       identique avant/après toute la migration)
npx tsc --noEmit    → propre une fois le .next périmé de la copie principale
                       supprimé (voir Non lancés)
```

### ⚠️ Non lancés / à vérifier

1. **Aucun déploiement Docker réel dans cette session** — le healthcheck et
   les `build.args` Supabase ont été corrigés et relus attentivement, jamais
   exercés (`docker build`/`docker compose up`, Docker absent de cette
   machine). Checklist de vérification post-déploiement dans `TODOS.md`.
2. **`src/app/layout.tsx:60` — `LayoutProps` introuvable** en `tsc` si le
   `.next/types` n'a pas été régénéré récemment (dépend d'un `next dev`/`build`
   récent, pas du code de cette migration — confirmé disparaître/réapparaître
   selon l'état de `.next`, jamais lié à un changement de code de cette
   branche). Pas bloquant, déjà documenté comme pré-existant par plusieurs
   relectures pendant la session.
3. **Flux « mot de passe oublié » incomplet** — `resetPasswordForEmail` sans
   `redirectTo`, aucun écran de saisie du nouveau mot de passe. Le bouton
   existe dans `AuthGate.tsx` mais ne mène nulle part tant que ça n'est pas
   construit. Voir `TODOS.md`.
4. **`scripts/brief-agents.sh agenda`** cassé (PIN header vers une route
   migrée) — `digest` fonctionne toujours. Voir `TODOS.md`.

## Blockers

**Aucun blocage technique côté code.** Le blocage est le provisionnement
Supabase (en cours avec Aramis au moment de cette passation — voir Current
state §3) : sans lui, un déploiement casserait l'accès d'Aramis à sa propre
app.

## Next — la prochaine action

1. **Terminer le provisionnement Supabase avec Aramis** (Providers email
   seul, migration SQL, compte + `authorized_users`, clé JWT asymétrique,
   Site URL) — checklist exacte dans `TODOS.md` § P0 bis.
2. Poser les deux variables d'env sur le VPS (`.env.production`), déployer,
   suivre la checklist de vérification post-déploiement (`TODOS.md`).
3. Une fois en prod et vérifié : traiter les points différés de `TODOS.md`
   § P0 bis (script agenda, mot de passe oublié, doc README/coordination
   encore périmée) avant qu'un agent ne bute dessus.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-26 (après-midi)** | **PIN → Supabase Auth (email + mot de passe), fusionné, pas déployé** | **Claude Code** | *(cette passation)* |
| 2026-08-26 (matin) | Cinq chantiers poussés et déployés ; refonte Calendrier + Fiche par Claude Design | Hermes Agent | [fiche](docs/handoffs/2026-08-26-matin-chantiers-deployes-hermes.md) |
| 2026-08-25 (soir) | Cinq chantiers front-end : waveform, DnD Kanban, calendrier, fiche, graphe | Claude Code | [fiche](docs/handoffs/2026-08-25-cinq-chantiers-frontend-claude-code.md) |
| 2026-08-25 (matin) | État du repo + défi Kanban/dépendances/Graphe pour Claude Code | Hermes Agent | [fiche](docs/handoffs/2026-08-25-hermes-etat-repo-mission-bugs.md) |
| 2026-08-24 (après-midi) | Vue Graphe et recette de l'existant | Claude Code | [fiche](docs/handoffs/2026-08-24-graphe-recette-claude-code.md) |
| 2026-08-24 (matin) | Kanban, tags, dépendances, fiche tâche, donut fix | Hermes Agent | [fiche](docs/handoffs/2026-08-24-kanban-tags-dependances-fiche.md) |
| 2026-08-23 (matin, 2e) | Desktop V1.1 : Réglages, priorités, IA, projets | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-kanban-tags-deps.md) |
| 2026-08-23 (matin) | Déploiement desktop V1 + audio/IA du 22/08 | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-deploy-desktop-v1.md) |
| 2026-08-23 (nuit) | Version desktop V1 (5 écrans, nav pilule, dashboard 3 cartes) | Claude Code | [fiche](docs/handoffs/2026-08-23-claude-code-desktop-v1.md) |
