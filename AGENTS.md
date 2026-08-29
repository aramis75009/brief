# Brief — contrat commun à tous les agents

Organiseur personnel piloté à la voix. Tu parles, Whisper transcrit, un LLM
découpe la note en tâches et rendez-vous datés, tu relis, Brief les garde. Les
rappels partent en Web Push depuis le serveur. L'app est **mobile ET desktop**
(PWA installée à l'écran d'accueil iOS + site responsive ≥ 1024 px).

**Ce fichier est lu par Claude Code, par Hermes et par Codex.** C'est le seul
que tous chargent. Une règle qui n'est pas ici n'est appliquée par personne.

| Fichier | Quand le lire |
|---|---|
| **`HANDOFF.md`** | **Toujours, en premier.** Où en est le projet, maintenant. |
| **`DECISIONS.md`** | **Toujours, en deuxième.** Les choix critiques d'Aramis et leur POURQUOI. Ne pas re-débattre ce qui y est inscrit. |
| `AGENTS.md` | Ce fichier. Les règles qui ne changent pas. |
| `TODOS.md` | Ce qui est différé. Rien de différé ne vit ailleurs. |
| `README.md` | Fonctionnement, routes, déploiement, variables d'environnement. |
| `DESIGN.md` | **Tokens et composants du design system v1 (mobile + desktop), écrit à partir de `globals.css` + `src/components/`.** |
| `CLAUDE.md` / `HERMES.md` | Le spécifique à ton agent. |
| `docs/handoffs/` | Les passations passées, à la demande. |

> **Design** : la source de vérité visuelle est le **design system Claude
> Design v1** (`docs/design-system-ref.dc.html` = prototype iOS, `DESIGN.md` =
> tokens + composants actuels mobile + desktop). L'ancien système corail /
> General Sans a été abandonné le 2026-08-20 — ne pas le ressusciter.

---

## Commence par lire HANDOFF.md

Il contient une seule passation : la dernière. Elle te dit l'objectif en cours,
ce qui a été validé, ce qui bloque et la prochaine action.

**Ne recommence pas un travail décrit comme fait. Ne re-débats pas une décision
inscrite dans `Decisions`.**

---

## L'architecture réelle

Brief **possède ses données**. Il n'écrit chez personne et n'a aucun plafond de
projets.

| | |
|---|---|
| **Stockage** | fichiers JSON, écriture atomique (`temp` + `rename`), file d'écritures sérialisée — `src/lib/store.ts`. Chemin par `BRIEF_DATA_DIR`. |
| **Rappels** | conteneur `cron` → `/api/cron/reminders` toutes les 60 s → Web Push — `src/lib/reminders.ts`, `src/lib/webpush.ts`. |
| **Synchro calendrier** | Bidirectionnelle **CalDAV ↔ Apple Calendrier** (source de vérité pour horaires et récurrences) + lecture des éditions faites dans Apple — `src/lib/caldav.ts`, `/api/cron/caldav-sync`. Latence ~15 min. |
| **Hébergement** | VPS Hostinger, `docker-compose.yml` (app + cron + volume `brief-data`), sauvegarde par `deploy/backup.sh`. |
| **Client** | PWA iPhone installée sur l'écran d'accueil + site desktop responsive. |
| **Stack** | Next.js 16 (App Router), React 19, Tailwind v4, Vitest, Supabase Auth (email + mot de passe). |

### ⚠️ La branche de production — lis `status.sh`, ne suppose pas

La prod tourne sur `/docker/brief` (VPS) et est servie par Docker. La branche
de production **a changé plusieurs fois en août** — la seule méthode fiable
est : `bash scripts/coord/status.sh`. Ce script lit la branche **réelle** du
VPS et la compare à `origin`. Ne déduis jamais la branche de prod de ta
mémoire ou d'un vieux doc — vérifie en live.

**Multi-agents** : ce projet est travaillé par Claude Code (Mac d'Aramis) et
Hermes Agent (VPS) en parallèle. Avant de coder, lis
[`docs/coordination.md`](docs/coordination.md) et applique le réflexe de
synchronisation (fetch + status.sh + HANDOFF.md). Un agent = une branche à
la fois ; GitHub est la vérité centrale.

---

## Invariants — les casser produit des bugs silencieux

**Aucun de ces points ne lève d'erreur quand on le viole.** C'est pour ça
qu'ils sont écrits.

### Sécurité — Supabase Auth (email + mot de passe), pas de PIN

**Toute route sous `/api/` commence par la garde de session Supabase.** Sans
exception :

```ts
const denied = await requireSession();
if (denied) return denied;
```

L'URL de déploiement est publique ; `src/lib/guard.ts` est la seule barrière.
`requireSession()` vérifie le JWT Supabase **localement** (clé publique ES256 ,
pas d'appel réseau). Le rafraîchissement du jeton, quand nécessaire, est géré
par `src/proxy.ts` (middleware) avant que la route ne s'exécute.

**L'ancien mécanisme PIN (`BRIEF_PIN`, `x-brief-pin`, `requirePin()`) est
supprimé** depuis le 2026-08-26. Les commentaires et snippets qui le citent
dans le code sont obsolètes — à signaler pour nettoyage (voir leçon du
2026-08-19 sur les docs qui dérivent du code).

`/api/cron/reminders`, `/api/capture` et `/api/digest` portent un **jeton
machine** (Bearer), pas la session utilisateur : un secret déposé dans une
crontab ou un raccourci iOS ne doit pas ouvrir la même porte que le code
qu'on tape, et doit pouvoir être révoqué seul. Chaque jeton est le sien :
pour l'un, révoquer n'éteint pas les autres. Voir `src/lib/cron-auth.ts`.

### Données et dates

- **La priorité 1 est la PLUS HAUTE** (convention iCalendar). Une seule échelle
  dans tout le code. Ne pas en réintroduire une seconde sans conversion testée.
- **Une date illisible devient « pas d'échéance », jamais une date approchée.**
  Un rappel absent se voit ; un rappel au mauvais moment ne se voit pas.
- **Ne jamais écrire une chaîne de date non-parseable dans `due`.** Si une
  conversion échoue, écrire `undefined` (pas d'échéance) plutôt qu'une chaîne
  brute. Le 2026-08-19, un `due = "20260820T140000"` (DTSTART ICS flottant,
  sans `Z` ni tirets, renvoyé brut par `remoteDueToItem()`) a fait planter
  **toute l'app** dans tous les navigateurs : `new Date()` ne parse pas ce
  format → Invalid Date → `Intl.DateTimeFormat.formatToParts()` → RangeError →
  React ne montait plus. Fix en 3 couches : `remoteDueToItem()` normalise le
  format flottant, `zonedParts()` ne lève plus jamais, `readItems()` normalise
  à la lecture. Voir `docs/handoffs/2026-08-19-caldav-floating-dtstart.md`.
- **Un crash JS client est invisible pour `curl`.** « Le serveur répond 200 »
  ne prouve pas que l'app marche — le navigateur exécute le JS, curl non.
  Quand un utilisateur dit « l'app ne s'ouvre plus » et que tout le réseau
  passe, chercher une erreur runtime côté client (DevTools) ou une donnée
  invalide dans `items.json`.
- **`new Date("2026-02-31")` ne renvoie pas une date invalide** — JavaScript
  fait déborder le mois et rend le 3 mars. D'où `isRealCalendarDate()`.
- **Aucun calcul de date ne passe par les méthodes locales de `Date`.** Ni
  `setHours`, ni `getDay`, ni `setDate`, ni `getMonth` : elles lisent le fuseau
  de la **machine**, et la production tourne en UTC. Tout passe par
  `src/lib/zoned.ts`, qui travaille dans `Europe/Paris`. Quatre fichiers ont
  dû être corrigés le 2026-08-14 pour cette raison, dont trois sans aucun
  test.
- **L'`id` d'un item est généré avant le premier envoi et réutilisé.** Un
  second envoi écrase au lieu de dupliquer : double-clic et rejeu sont
  inoffensifs.
- **CalDAV Apple : le calendrier iCloud est la SOURCE DE VÉRITÉ pour les
  horaires/tâches datées** (décision Aramis du 2026-08-18, `DECISIONS.md` —
  renverse le one-way « Brief → Apple » du 17/08). Sens **bidirectionnel** :
  Brief écrit les nouvelles tâches (capture vocale / API / Telegram) au
  calendrier, MAIS toute édition faite **directement dans l'app Calendrier**
  (horaire, titre, récurrence) **écrase** celle de Brief → Brief **adopte la
  version du calendrier**, pas l'inverse. Latence ~15 min acceptée ; les
  rappels à court terme restent en Web Push. Implémenté : `src/lib/caldav.ts`
  + route cron `caldav-sync`.
- **C'est le serveur qui possède l'horloge.** iOS ne donne aucune API de
  notification programmée à une PWA — ni Notification Triggers, ni Background
  Sync, ni Periodic Background Sync, ni Background Fetch.

### Interface — mobile et desktop

- **Tailwind v4 ne compile pas les utilitaires arbitraires contenant
  `env()`.** Les safe areas passent par `.safe-top` / `.safe-bottom` dans
  `globals.css`.
- **Le reset CSS doit rester dans `@layer base`.** Hors layer, il l'emporte
  sur les utilitaires Tailwind — c'est ce qui affichait un bouton noir sur
  noir.
- **iOS ne notifie que les PWA installées à l'écran d'accueil.** En onglet
  Safari, l'abonnement peut réussir sans qu'aucune notification n'arrive.
- **La bascule mobile ↔ desktop se fait à `1024 px`** via `useIsDesktop()` :
  les composants `src/components/desktop/` (Shell, Header, Calendar, Kanban,
  TaskDetail, Dashboard, Ideas, Tasks, Settings, Command palette, Dependency
  graph) ne s'affichent qu'en vue desktop ; les composants mobiles restent
  inchangés.
- Le design system Claude Design v1 est la source de vérité visuelle : les
  tokens viennent de `docs/design-system-ref.dc.html` (iOS) et les recettes
  du desktop (Kanban, calendar lanes, fiche) sont dans `DESIGN.md`.

### Déploiement

- **`--env-file .env.production` n'est pas facultatif.** `env_file:` injecte
  des variables dans un conteneur au démarrage ; il n'alimente pas
  l'interpolation `${...}` du `docker-compose.yml`.
- **Les variables `NEXT_PUBLIC_*` doivent être passées AU BUILD.** Le
  compilateur les inline dans le bundle. Absente au build, la clé VAPID
  publique vaut `undefined` dans le navigateur et l'abonnement échoue sans
  que le serveur ne voie rien. Même chose pour
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Traefik tourne en `exposedbydefault=false`.** Sans les labels, le
  conteneur démarre et reste invisible depuis Internet : aucune erreur, juste
  un 404.

---

## Commandes

```bash
npm run dev       # développement local (Next dev server, http://localhost:3000)
npm run build     # build de production (sortie standalone pour Docker)
npm test          # la suite Vitest complète (374 tests au 2026-08-29)
npx vitest run    # même chose, sans le script npm
npx tsc --noEmit  # typecheck strict
npx eslint .      # lint
```

**Avant chaque commit : les trois commandes** (`eslint`, `tsc`, `vitest`).
Un « petit correctif d'UI » n'exempte pas les tests.

---

## Avant de pousser — le réflexe de synchronisation

```bash
git fetch origin --prune
bash scripts/coord/status.sh       # compare GitHub / ta copie / prod VPS
# lis HANDOFF.md
# si la prod a avancé, fast-forward AVANT de coder
```

Règles complètes : [`docs/coordination.md`](docs/coordination.md). **Un agent
= une branche à la fois. Jamais de `push --force`, `reset --hard` ou `rebase`
sur une branche partagée sans accord explicite d'Aramis.**

---

## Terminer une session — la passation

**Une tâche n'est pas finie tant que `HANDOFF.md` n'est pas à jour.**

1. Remplace `HANDOFF.md` par la nouvelle passation (la dernière, pas deux).
2. Archive l'ancienne dans `docs/handoffs/YYYY-MM-DD-<sujet>.md`.
3. Remplis : **Agent** (qui tu es, modèle, version), **Branche**, **Base**,
   **Goal**, **Current state**, **Decisions**, **Blockers**, **Next action**,
   **Validations** (les trois états : passant / échoué / **non lancé**).
4. Si un autre agent avait la main, reprends-la explicitement dans la ligne
   *Agent* : « je reprends la main (passation précédente : X) ».

Le gabarit exact est dans la section « Terminer une session » de
`docs/coordination.md`. La section *Validations* est lue par Aramis en premier
quand quelque chose casse — une validation inventée coûte plus cher qu'un
aveu.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
