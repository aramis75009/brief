# Spec — Remplacer le PIN par une auth email + mot de passe (Supabase)

| | |
|---|---|
| **Date** | 2026-08-26 |
| **Auteur** | Claude Code, avec Aramis (brainstorming) |
| **Branche** | `feat/email-password-auth` |
| **Statut** | Validé par Aramis (design backend + maquette écran) — prêt pour plan d'implémentation |

## Goal

Remplacer le PIN partagé unique (`BRIEF_PIN`, `src/lib/guard.ts`) par une
identité par utilisateur : email + mot de passe, via Supabase Auth. Deux
raisons données par Aramis : sécurité (le PIN est un secret en clair côté
client) et préparation au multi-utilisateur (un second utilisateur viendra).

## Non-goals

- **Pas d'isolation des données par utilisateur.** `items.json` reste
  partagé entre tous les comptes autorisés, comme aujourd'hui avec le PIN
  unique. Cloisonner les tâches par utilisateur est un chantier séparé, non
  traité ici.
- **Pas d'inscription libre.** Aucun formulaire « créer un compte » dans
  Brief. Les comptes autorisés sont créés à la main par Aramis (tableau de
  bord Supabase), un par un.
- **Pas de SSO (Google, etc.).** Email + mot de passe uniquement.
- **Les routes machine ne changent pas.** `/api/cron/reminders`,
  `/api/capture`, `/api/digest` gardent leurs jetons dédiés
  (`src/lib/cron-auth.ts`) — hors périmètre, aucune de ces routes ne passe
  par Supabase.

## Architecture

Supabase Auth gère l'inscription/connexion par mot de passe (hashage,
sessions JWT). Une table Postgres `authorized_users` sert de liste blanche
en défense en profondeur (indépendante d'un mauvais réglage du dashboard
Supabase) et de point d'extension pour de futures métadonnées par
utilisateur. `src/lib/guard.ts` (`requirePin`) devient `requireSession` :
il vérifie un JWT de session au lieu de comparer un PIN.

Cookies httpOnly (access + refresh token) posés côté serveur, rafraîchis à
chaque requête par `middleware.ts` — persistance comparable à l'actuel
cookie `brief_pin` (pas de re-connexion à chaque ouverture de la PWA).

## Composants

| Fichier | Nature |
|---|---|
| `src/lib/supabase/server.ts` | **Nouveau.** Client Supabase server-side (`@supabase/ssr`), adaptateur cookies Next.js. |
| `src/lib/supabase/client.ts` | **Nouveau.** Client Supabase browser-side. |
| `middleware.ts` | **Nouveau.** Rafraîchit la session à chaque requête (pattern standard `@supabase/ssr`). |
| `src/app/api/auth/login/route.ts` | **Nouveau.** `POST { email, password }` → `signInWithPassword`, puis vérification `authorized_users`. |
| `src/app/api/auth/logout/route.ts` | **Nouveau.** Remplace le bouton « Verrouiller » actuel. |
| `src/app/api/auth/forgot-password/route.ts` | **Nouveau.** `POST { email }` → `resetPasswordForEmail`, réponse toujours générique. |
| `src/lib/guard.ts` | **Modifié.** `requirePin(req)` → `requireSession(req)`, vérification JWT locale (pas d'appel réseau à Supabase par requête — clé publique du projet, vérification asymétrique ES256). Appelé par les **18 routes** qui appellent aujourd'hui `requirePin` (liste : `agenda`, `audio/[id]`, `audio`, `board`, `caldav-status`, `chat`, `items/[id]`, `items`, `overview`, `parse`, `projects`, `push/subscribe`, `push/test`, `search`, `session` *(supprimée, remplacée par `auth/login`)*, `tags/[id]`, `tags`, `transcribe`). |
| `src/components/PinGate.tsx` | **Remplacé** par `src/components/AuthGate.tsx` — écran email + mot de passe, maquette validée : `https://claude.ai/code/artifact/5655973d-ef06-4ed1-8585-90c6af776456`. |
| `src/lib/pin.ts` | **Supprimé.** Plus de secret à mémoriser côté JS — les cookies httpOnly s'en chargent. `apiFetch()` se simplifie : plus besoin d'attacher un header, les cookies same-origin suivent automatiquement ; garde la gestion `UnauthorizedError` sur 401. |
| `src/app/api/session/route.ts` | **Supprimé**, remplacé par `auth/login`. |

## Flux de données

1. **Connexion.** `POST /api/auth/login { email, password }` → `supabase.auth.signInWithPassword(...)`.
   - Échec (email inconnu OU mot de passe faux) → message **générique unique** : « Email ou mot de passe incorrect. » — pas d'indice sur lequel des deux champs est en cause (anti-énumération).
   - Succès → le serveur vérifie ensuite que `session.user.id` a une ligne dans `authorized_users` (défense en profondeur, indépendante d'un mauvais réglage dashboard) ; sinon, session révoquée immédiatement (`signOut`), 403.
   - Cookies httpOnly posés (`@supabase/ssr`), `last_login_at` mis à jour dans `authorized_users`.
2. **Mot de passe oublié.** `POST /api/auth/forgot-password { email }` → `supabase.auth.resetPasswordForEmail(...)`. Réponse **toujours générique** : « Si ce compte existe, un lien de réinitialisation vient d'être envoyé. » — même que l'email existe ou non.
3. **Session courante.** `middleware.ts` rafraîchit silencieusement le cookie de session à chaque requête (pattern `@supabase/ssr` standard) — la session survit à la fermeture de la PWA.
4. **Chaque route `/api/*`.** `requireSession(req)` lit le JWT du cookie, le vérifie **localement** (clé publique du projet, ES256, pas d'appel réseau à chaque requête) → 401 si absent/expiré/invalide.
5. **Déconnexion.** `POST /api/auth/logout` → `supabase.auth.signOut()`, cookies effacés — remplace « Verrouiller ».

## Schéma Postgres — `authorized_users`

```sql
create table public.authorized_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.authorized_users enable row level security;

-- auth.uid() encapsulé dans (select ...) : évalué une fois, pas par ligne
-- (règle "Optimize RLS Policies for Performance" du skill Postgres)
create policy "read own row"
  on public.authorized_users
  for select
  to authenticated
  using (user_id = (select auth.uid()));
```

**Choix délibérés (skill `supabase-postgres-best-practices`) :**
- `user_id uuid references auth.users(id)` plutôt qu'un `id` auto-généré
  séparé + correspondance par email : évite toute comparaison de chaîne
  (casse, espace) et donne une vraie contrainte d'intégrité référentielle
  vers `auth.users`. La règle générale du skill déconseille les UUID
  aléatoires comme clé primaire (fragmentation d'index) — écartée ici en
  connaissance de cause : la table reste minuscule par construction (liste
  blanche invite-only, 1-3 lignes), la fragmentation n'a aucun effet mesurable
  à cette échelle, et faire correspondre la PK à `auth.users.id` prime sur la
  micro-optimisation.
- Politique RLS avec `auth.uid()` enveloppé dans `(select ...)` : évalué une
  fois par requête, pas une fois par ligne.
- Pas de `service_role` côté application : toutes les opérations (lecture de
  sa propre ligne, connexion, reset) passent par la clé publique (anon) +
  RLS. Ajout d'un utilisateur autorisé = geste manuel dans l'éditeur SQL
  Supabase (`insert into authorized_users (user_id) values ('<uuid de
  auth.users>')`), pas de route d'admin dans Brief pour ce chantier.

## Gestion des erreurs

| Cas | Comportement |
|---|---|
| Email inconnu ou mot de passe faux | 401, message générique unique (pas de distinction) |
| Compte Supabase valide mais absent de `authorized_users` | Session révoquée immédiatement, 403 |
| Rate-limit de connexion atteint | Géré nativement par Supabase Auth (réglage projet) |
| Session expirée en cours d'usage | 401 sur une route `/api/*` → le client réaffiche `AuthGate` (même pattern que l'actuel `UnauthorizedError`) |
| Mot de passe oublié | Réponse toujours générique, que l'email existe ou non |

## Migration

1. **Aramis crée le projet Supabase** (dashboard, hors de portée d'un
   agent) : active l'auth par email/mot de passe, désactive les autres
   méthodes (pas de SSO), règle le rate-limit et la durée de session.
2. Aramis crée son propre compte (Authentication → Add user, avec mot de
   passe) et insère sa ligne dans `authorized_users`.
3. Nouvelles variables d'env : `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **build-time**, même piège documenté
   dans `AGENTS.md` pour la clé VAPID (absentes au build, `undefined` dans
   le bundle).
4. **Coupure nette, pas de double système.** `BRIEF_PIN` retiré une fois la
   bascule confirmée en prod, à un moment où Aramis a sa boîte mail sous la
   main (pas en pleine nuit sans accès).
5. `AGENTS.md` (invariant sécurité « garde PIN » → « garde session »),
   `DECISIONS.md` (nouvelle entrée avec le pourquoi), `docs/coordination.md`
   si le PIN y est mentionné : à mettre à jour dans le cadre de ce chantier.

## Tests

- `requireSession()` : JWT valide / absent / expiré / malformé (vitest, JWT
  simulé).
- `authorized_users` : `user_id` présent vs absent → 403.
- Flux `login` / `forgot-password` : test d'intégration marqué `skip` en
  l'absence d'environnement Supabase de test en CI (même traitement que les
  tests CalDAV existants, cf. `HANDOFF.md`).

## Référence visuelle

Maquette approuvée (écran email + mot de passe, logo animé) :
`https://claude.ai/code/artifact/5655973d-ef06-4ed1-8585-90c6af776456`.
