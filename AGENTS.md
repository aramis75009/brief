# Brief — contrat commun à tous les agents

Organiseur personnel piloté à la voix. Tu parles, Whisper transcrit, un LLM
découpe la note en tâches et rendez-vous datés, tu relis, Brief les garde. Les
rappels partent en Web Push depuis le serveur.

**Ce fichier est lu par Claude Code, par Hermes et par Codex.** C'est le seul
que tous chargent. Une règle qui n'est pas ici n'est appliquée par personne.

| Fichier | Quand le lire |
|---|---|
| **`HANDOFF.md`** | **Toujours, en premier.** Où en est le projet, maintenant. |
| **`DECISIONS.md`** | **Toujours, en deuxième.** Les choix critiques d'Aramis et leur POURQUOI. Ne pas re-débattre ce qui y est inscrit. |
| `AGENTS.md` | Ce fichier. Les règles qui ne changent pas. |
| `TODOS.md` | Ce qui est différé. Rien de différé ne vit ailleurs. |
| `README.md` | Fonctionnement, routes, déploiement, variables d'environnement. |
| `DESIGN.md` | **Avant toute décision visuelle.** Polices, couleurs, espacements, rayons, durées. |
| `CLAUDE.md` / `HERMES.md` | Le spécifique à ton agent. |
| `docs/handoffs/` | Les passations passées, à la demande. |

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
| Stockage | fichiers JSON, écriture atomique (`temp` + `rename`), file d'écritures sérialisée — `src/lib/store.ts`. Chemin par `BRIEF_DATA_DIR`. |
| Rappels | conteneur `cron` → `/api/cron/reminders` toutes les 60 s → Web Push — `src/lib/reminders.ts`, `src/lib/webpush.ts`. |
| Hébergement | VPS Hostinger, `docker-compose.yml` (app + cron + volume `brief-data`), sauvegarde par `deploy/backup.sh`. |
| Client | PWA installée sur iPhone. |
| Stack | Next.js 16 (App Router), React 19, Tailwind v4, Vitest. |

### ⚠️ La production tourne sur `feat/task-completion`, pas sur `main`

Le VPS (`/docker/brief`) est branché sur cette branche. `main` est en retard.
Vérifie avant de supposer. C'est ce qui a fait perdre du temps à Hermes le
2026-08-14.

---

## Invariants — les casser produit des bugs silencieux

**Aucun de ces points ne lève d'erreur quand on le viole.** C'est pour ça
qu'ils sont écrits.

### Sécurité

**Toute route sous `/api/` commence par la garde PIN.** Sans exception :

```ts
const denied = requirePin(req);
if (denied) return denied;
```

L'URL de déploiement est publique ; `src/lib/guard.ts` est la seule barrière.
L'écran PIN et la mémorisation locale (localStorage) ne sont que de l'UX, ils ne
protègent rien — depuis le 2026-08-17, le code est saisi une fois par appareil
puis mémorisé (`DECISIONS.md`).

`/api/cron/reminders` et `/api/capture` portent un **jeton machine**, pas le
PIN : un secret déposé dans une crontab ou un raccourci iOS ne doit pas ouvrir
la même porte que le code qu'on tape, et doit pouvoir être révoqué seul.

### Données et dates

- **La priorité 1 est la PLUS HAUTE** (convention iCalendar). Une seule échelle
  dans tout le code. Ne pas en réintroduire une seconde sans conversion testée.
- **Une date illisible devient « pas d'échéance », jamais une date approchée.**
  Un rappel absent se voit ; un rappel au mauvais moment ne se voit pas.
- **`new Date("2026-02-31")` ne renvoie pas une date invalide** — JavaScript
  fait déborder le mois et rend le 3 mars. D'où `isRealCalendarDate()`.
- **Aucun calcul de date ne passe par les méthodes locales de `Date`.** Ni
  `setHours`, ni `getDay`, ni `setDate`, ni `getMonth` : elles lisent le fuseau
  de la **machine**, et la production tourne en UTC. Tout passe par
  `src/lib/zoned.ts`, qui travaille dans `Europe/Paris`. Quatre fichiers ont dû
  être corrigés le 2026-08-14 pour cette raison, dont trois sans aucun test.
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

### Interface

- **Tailwind v4 ne compile pas les utilitaires arbitraires contenant `env()`.**
  Les safe areas passent par `.safe-top` / `.safe-bottom` dans `globals.css`.
- **Le reset CSS doit rester dans `@layer base`.** Hors layer, il l'emporte sur
  les utilitaires Tailwind — c'est ce qui affichait un bouton noir sur noir.
- **iOS ne notifie que les PWA installées à l'écran d'accueil.** En onglet
  Safari, l'abonnement peut réussir sans qu'aucune notification n'arrive.
- Lire `DESIGN.md` avant toute décision visuelle, et ne pas s'en écarter sans
  accord explicite.

### Déploiement

- **`--env-file .env.production` n'est pas facultatif.** `env_file:` injecte des
  variables dans un conteneur au démarrage ; il n'alimente pas l'interpolation
  `${...}` du `docker-compose.yml`.
- **Les variables `NEXT_PUBLIC_*` doivent être passées AU BUILD.** Le
  compilateur les inline dans le bundle. Absente au build, la clé VAPID publique
  vaut `undefined` dans le navigateur et l'abonnement échoue sans que le serveur
  ne voie rien.
- **Traefik tourne en `exposedbydefault=false`.** Sans les labels, le conteneur
  démarre et reste invisible depuis Internet : aucune erreur, juste un 404.
- **Le volume `brief-data` reste l'unique copie de l'état complet des items**
  (titre, projet, priorité, fait/non-fait, rappels). Le calendrier Apple ne
  reflète que le **planning** (horaires/récurrences) des items datés — c'est
  une vue autoritaire sur les horaires (décision 18/08), pas l'état complet.
  Aucun téléphone n'en garde de réplique complète.

---

## Vérifier avant d'affirmer

**Ne jamais écrire « c'est corrigé » sans avoir lancé la commande qui le prouve
et montré sa sortie.** Distinguer explicitement ce qui est *vérifié* de ce qui
est *supposé*.

```bash
npx vitest run          # la suite complète — tourne en UTC, voir ci-dessous
npx tsc --noEmit        # types
npx eslint .            # lint
```

**La suite tourne en UTC, pas dans ton fuseau** — `vitest.config.mts` le force.
Ce n'est pas un détail de configuration : les conteneurs n'ont pas de `TZ` et
tournent en UTC, alors que le développement se fait à Paris. Le 2026-08-14, la
suite était verte sur le Mac et rouge à 7 tests en UTC, et c'était la production
qui avait raison. **Ne retire pas cette ligne pour « réparer » un test.**

**Ne jamais lancer `npm run build` si un `npm run dev` tourne** : ça corrompt
`.next`. Utiliser `npx tsc --noEmit`, puis vérifier dans le navigateur.

---

## Git

- **Ne jamais commiter sur `main` directement.** Brancher d'abord.
- Ne pas commiter ni pousser sans demande explicite d'Aramis.
- **Lister les remotes avant de pousser** (`git remote -v`).
- Messages de commit **en anglais**, format `type: sujet` (`feat:`, `fix:`,
  `chore:`, `docs:`, `deploy:`). Le code, les noms de variables et les messages
  de commit sont en anglais ; les commentaires, la documentation et l'interface
  sont en français.
- **Signer son travail.** Les commits d'agent portent aujourd'hui l'identité
  d'Aramis et sont indistinguables des siens. En attendant mieux, c'est
  `HANDOFF.md` qui porte l'attribution — d'où la ligne **Agent** obligatoire.

---

## Terminer une session — la passation

**Une session n'est pas finie tant que la passation n'est pas écrite.** Ça vaut
pour une session de dix minutes comme pour une journée.

1. **Archiver la passation en place** — déplacer le contenu de `HANDOFF.md`
   vers `docs/handoffs/AAAA-MM-JJ-sujet-court.md`. Ne jamais l'écraser.
2. **Écrire la nouvelle** dans `HANDOFF.md`, avec les sept sections ci-dessous.
3. **Ajouter une ligne** au tableau « Historique des passations », en haut.
4. **Reporter dans `TODOS.md`** ce qui est différé — `HANDOFF.md` dit *où on en
   est*, `TODOS.md` dit *ce qu'on n'a pas fait*.

### Le gabarit

```markdown
# Passation — AAAA-MM-JJ · <sujet en cinq mots>

| | |
|---|---|
| **Agent** | Claude Code / Hermes + modèle / Aramis |
| **Branche** | <branche> |
| **Commits** | <sha courts> |

## Goal — l'objectif
Une phrase. Ce que la session cherchait à obtenir.

## Current state — ce qui a été fait
Ce qui marche. **Et ce qui n'a pas été fait alors qu'on croyait le faire.**

## Decisions — choix critiques ou irréversibles
Chaque décision avec son POURQUOI. Sans le pourquoi, la prochaine session la
re-débat. Ne rien mettre ici qui ne soit ni critique ni irréversible.

## Changed — fichiers et composants
Tableau fichier → nature du changement. Les chemins exacts.

## Validations — passants / échoués / non lancés
**Trois états, pas deux.** « Non lancé » est l'information la plus utile de la
passation : elle dit où regarder en premier quand ça casse.
Coller la sortie réelle des commandes, pas un résumé.

## Blockers — ce qui bloque
Ce qui empêche d'avancer, et ce qu'il faudrait pour débloquer. Écrire
« rien » si rien ne bloque — une section vide se lit comme un oubli.

## Next — la prochaine action
Concrète et immédiate. Pas « améliorer l'UX » mais « relire la branche X ».
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
