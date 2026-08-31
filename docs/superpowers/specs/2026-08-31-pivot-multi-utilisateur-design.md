# Spec — Pivot multi-utilisateur de Brief

| | |
|---|---|
| **Date** | 2026-08-31 |
| **Auteur** | Claude Code (Opus 5), avec Aramis (brainstorming) |
| **Base** | `main` @ `bf58eb2` |
| **Branche** | `feat/multi-user-store` (lot 1), puis une branche par lot |
| **Statut** | Design arbitré avec Aramis — en attente de relecture, puis plan d'implémentation |

## Goal

**Cloisonner les données de Brief par utilisateur.** L'authentification
Supabase existe et fonctionne depuis le 2026-08-26, mais aucune donnée ne
porte d'identifiant de compte : les 18 exports de `src/lib/store.ts` sont
globaux, et **tous les comptes autorisés ouvrent le même Brief**. Un second
compte verrait, modifierait et pourrait supprimer les tâches d'Aramis ainsi
que sa synchro CalDAV.

Deux raisons de le faire, dans cet ordre :

1. **Aramis** a demandé un compte de recette le 31/08 et a découvert que ce
   compte serait une seconde clé de son Brief réel, pas un bac à sable.
2. **Aucun agent ne peut recetter un écran authentifié** (blocage rencontré
   trois fois le 31/08). Une fois les données cloisonnées, un compte agent ne
   voit que les siennes et le recetter n'expose plus rien.

## Non-goals

- **Pas d'inscription libre.** La liste blanche `authorized_users` reste le
  seul portail ; les comptes sont créés à la main depuis le dashboard
  Supabase. La landing SaaS (`docs/landing/multi-user-v1.html`, prix
  0/6/12 €) reste un chantier séparé et non commencé.
- **Pas de partage entre comptes.** Aucune notion d'équipe, d'invitation ou
  de tâche partagée. Chaque compte est étanche.
- **Pas de migration des données vers Postgres.** Les données restent des
  fichiers JSON sur le VPS (voir *Décision 1*). Supabase ne porte que
  l'identité et les secrets.
- **Pas de suppression de compte ni d'export RGPD.** Hors périmètre tant
  qu'il n'y a pas d'inscription libre.
- **Pas de quotas ni de facturation.**

## Les six décisions d'Aramis (31/08)

Arbitrées en brainstorming, à reporter dans `DECISIONS.md` avant la première
ligne de code.

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| 1 | Où vivent les données ? | **Fichiers JSON par utilisateur** sur le VPS + Supabase pour l'identité et les secrets | Garde l'écriture atomique, la file sérialisée, `backup.sh` et « Brief possède ses données » (`AGENTS.md`). À 2-5 comptes, migrer 18 exports et ~20 routes vers SQL coûterait plus que ça ne rapporte. |
| 2 | Combien de comptes, ouverts à qui ? | **2 à 5**, créés à la main, dont des comptes agents | Le but immédiat est de débloquer la recette, pas d'ouvrir un SaaS. |
| 3 | Les identifiants CalDAV ? | **Un jeu par utilisateur**, chiffré au repos, saisi dans les Réglages | Choix explicite d'Aramis. C'est le morceau le plus lourd — d'où sa mise en **lot 3**. |
| 4 | Les jetons machine ? | **Un jeton par utilisateur**, haché en base, révocable | Une capture Telegram ou iOS doit savoir dans quel Brief elle écrit. |
| 5 | Comment les crons itèrent-ils ? | **Boucle interne, un seul appel** | Aramis n'a pas de SSH vers le VPS : éditer la crontab à chaque compte passerait par un message à Hermes. |
| 6 | Comment le `userId` atteint-il le store ? | **Fabrique de store** (`storeForSession()` / `storeForUser()`) | Une seule porte où l'identité est résolue. Le cloisonnement se vérifie par un `grep` au lieu de reposer sur 22 fichiers disciplinés. |

## Architecture

### Partition des fichiers

```
BRIEF_DATA_DIR/
├── users/
│   └── <userId>/                 # userId = `sub` du JWT Supabase (UUID)
│       ├── items.json
│       ├── projects.json
│       ├── boards.json
│       ├── tags.json
│       ├── objectives.json
│       ├── settings.json
│       ├── push-subscriptions.json
│       └── caldav-last-sync.json
└── _pre-multiuser/               # les fichiers d'avant la migration, intacts
```

> ⚠️ **Le `userId` entre dans un chemin de fichier — c'est nouveau.** Aucun
> chemin n'est dynamique aujourd'hui. `storeForUser()` **valide le format
> UUID** (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`)
> et lève sinon. Sans cette validation, un `sub` malformé donne une traversée
> de répertoire. Le JWT est signé par Supabase, donc le risque est faible —
> mais le coût de la garde est de trois lignes et son absence ne lève aucune
> erreur.

### La file d'écriture devient une file par utilisateur

`store.ts` sérialise aujourd'hui **toutes** les écritures du serveur derrière
une unique `writeChain`. Avec des crons qui itèrent sur N comptes, un passage
CalDAV lent bloquerait la requête interactive d'un autre utilisateur.

La chaîne devient une `Map<userId, Promise>`. La garantie actuelle est
conservée à l'identique **par utilisateur** : deux lecture-modification-écriture
d'un même compte ne s'écrasent pas — ce dont `updateObjectivesAtomically`
dépend, puisqu'il lit `items.json` *et* `objectives.json` dans la même
séquence. La file couvre donc **le compte**, jamais le fichier.

### La fabrique de store

`store.ts` cesse d'exporter des fonctions libres et exporte un type + une
fabrique. `push-store.ts` **fusionne dans la fabrique** — son en-tête
annonçait déjà cette bascule (« garder l'API inchangée pour que le changement
ne touche que ce fichier »). `parseSubscription`, fonction pure, reste un
export libre.

```ts
export type Store = {
  // items
  readItems(): Promise<Item[]>;
  saveItems(items: Item[]): Promise<void>;
  patchItem(id: string, patch: Partial<Item>): Promise<Item | null>;
  deleteItem(id: string): Promise<boolean>;
  patchItems(patches: { id: string; patch: Partial<Item> }[]): Promise<number>;
  updateItemsAtomically(fn: (items: Item[]) => { id: string; patch: Partial<Item> }[]): Promise<Item[]>;
  // projets, board, réglages, tags, objectifs — mêmes signatures qu'aujourd'hui, sans userId
  // push
  readSubscriptions(): Promise<PushSubscriptionRecord[]>;
  saveSubscription(sub: Omit<PushSubscriptionRecord, "createdAt">): Promise<void>;
  removeSubscription(endpoint: string): Promise<void>;
  // caldav
  readLastCalDavSync(): Promise<number | null>;
  writeLastCalDavSync(at: number): Promise<void>;
};

/** Le store d'un compte. Lève si `userId` n'est pas un UUID. */
export function storeForUser(userId: string): Store;
```

Et une porte unique côté route, dans `src/lib/guard.ts` :

```ts
/** { userId, store } si la session est valide, une Response 401 sinon. */
export async function requireStore(): Promise<{ userId: string; store: Store } | Response>;

/** Variante à garde MIXTE : session utilisateur OU jeton machine de LECTURE. */
export async function requireStoreOrMachineToken(
  req: Request,
  kind: "digest",
  opts?: { allowQueryToken?: boolean },
): Promise<{ userId: string; store: Store } | Response>;
```

Patron de route après le pivot :

```ts
const session = await requireStore();
if (session instanceof Response) return session;
const { store } = session;
const items = await store.readItems();
```

Un seul appel fait la garde **et** rend le store lié : il devient impossible
d'avoir l'un sans l'autre, et impossible de se tromper de compte à
l'intérieur d'une route. Les routes qui ne touchent pas au store
(`/api/transcribe`, `/api/parse`, `/api/audio/*`) gardent `requireSession()`
tel quel.

> **Invariant vérifiable :** aucun fichier sous `src/app/api/` ne doit appeler
> `storeForUser` directement. Seuls les crons et la migration y ont droit. Un
> test le fige (voir *Tests*).

### Schéma Supabase

Deux tables nouvelles, **entièrement fermées**. Vérifié le 31/08 : le
navigateur ne parle jamais directement à Supabase (aucun `createBrowserClient`,
aucun import `@supabase` hors des routes `/api/*`), donc rien n'oblige à
ouvrir ces tables au rôle `authenticated`.

Conforme au skill `supabase-postgres-best-practices` : identifiants en
minuscules, `text` / `timestamptz`, `bigint generated always as identity` en
clé primaire, index sur les colonnes de clé étrangère, contraintes ajoutées de
façon idempotente.

**Le lot 1 n'applique aucune migration SQL** : il ne lit que
`authorized_users`, qui existe depuis le 26/08. Chaque table arrive avec le
lot qui l'utilise.

```sql
-- supabase/migrations/0003_caldav_credentials.sql   (lot 3)

-- Identifiants CalDAV, un jeu par compte.
create table public.caldav_credentials (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  username           text not null,
  password_encrypted text not null,          -- "v1.<iv>.<tag>.<ciphertext>", jamais en clair
  root_url           text not null default 'https://caldav.icloud.com/',
  calendar_mapping   jsonb not null default '{}'::jsonb,
  fallback_calendar  text not null default 'Personnel',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.caldav_credentials enable row level security;
alter table public.caldav_credentials force  row level security;
revoke all on public.caldav_credentials from anon, authenticated;
-- AUCUNE policy, volontairement : seul le serveur y accède, via la clé
-- service-role qui contourne RLS. Une table sans policy est fermée à tout
-- rôle non-BYPASSRLS — c'est la propriété recherchée, pas un oubli.

-- supabase/migrations/0002_machine_tokens.sql      (lot 2)

-- Jetons machine, hachés. Le jeton en clair n'existe qu'une fois, à sa création.
create table public.machine_tokens (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('capture', 'digest')),
  token_sha256 text not null unique,
  label        text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index machine_tokens_user_id_idx on public.machine_tokens (user_id);

alter table public.machine_tokens enable row level security;
alter table public.machine_tokens force  row level security;
revoke all on public.machine_tokens from anon, authenticated;
```

`authorized_users` **ne change pas**. Elle sert déjà de liste blanche et
devient l'inventaire que les crons parcourent.

### La clé service-role entre dans l'application

Les crons n'ont aucune session : lire les identifiants CalDAV de tous les
comptes impose une clé `SUPABASE_SECRET_KEY` (service-role), celle qui
contourne RLS.

- Elle vit dans **un seul module**, `src/lib/supabase/admin.ts`, marqué
  `server-only`, qui lève avec un message explicite si elle manque.
- Ce module n'exporte **pas** le client brut : il exporte les quelques
  fonctions métier qui en ont besoin (`listAuthorizedUserIds`,
  `readCalDavCredentials`, `upsertCalDavCredentials`, `findMachineToken`,
  `createMachineToken`, `revokeMachineToken`). Chacune filtre explicitement
  sur un `user_id`.
- **Le filet RLS n'existe pas sur ce chemin.** C'est le prix de l'accès
  machine, et c'est pourquoi la surface est réduite à six fonctions dans un
  fichier.

### Chiffrement des secrets

`src/lib/crypto.ts`, AES-256-GCM via le `crypto` natif de Node — aucune
dépendance ajoutée.

- Clé : `BRIEF_ENCRYPTION_KEY`, 32 octets encodés en base64, hors dépôt.
- Format stocké : `v1.<iv_b64>.<tag_b64>.<ciphertext_b64>`. Le préfixe de
  version réserve la place d'une rotation de clé sans migration destructrice.
- `encryptSecret(plain): string` / `decryptSecret(stored): string`.
  `decryptSecret` lève sur un format inconnu ou un tag invalide — jamais de
  retour silencieux d'une chaîne vide.

C'est de la **défense en profondeur** : même fermées, ces lignes restent
lisibles depuis le dashboard Supabase, et un mot de passe d'application iCloud
en clair y serait une faute.

## Composants

| Fichier | Nature |
|---|---|
| `src/lib/store.ts` | **Réécrit.** 18 fonctions libres → `type Store` + `storeForUser(userId)`. File d'écriture par utilisateur. Absorbe `push-store.ts` et le timestamp CalDAV. |
| `src/lib/push-store.ts` | **Supprimé.** Fusionné dans la fabrique ; `parseSubscription` déménage dans `src/lib/push-subscription.ts` (pure, testée sans disque). |
| `src/lib/guard.ts` | **Modifié.** Ajoute `requireStore()` et `requireStoreOrMachineToken()`. `requireSession()` et `readSessionClaims()` restent. Nouveau `sessionUserId()`. |
| `src/lib/supabase/admin.ts` | **Nouveau.** Client service-role + six fonctions métier. `server-only`. |
| `src/lib/crypto.ts` | **Nouveau (lot 3).** AES-256-GCM, `encryptSecret` / `decryptSecret`. |
| `src/lib/machine-tokens.ts` | **Nouveau (lot 2).** Génération (32 octets aléatoires, base64url), hachage SHA-256, résolution jeton → `userId`. |
| `src/lib/cron-auth.ts` | **Modifié.** `requireMachineToken` garde son rôle pour `BRIEF_CRON_TOKEN` / `BRIEF_CALDAV_TOKEN` (globaux). Nouveau `resolveMachineToken(req, kind)` qui rend un `userId` pour capture/digest. |
| `src/lib/migrate-multiuser.ts` | **Nouveau.** Migration idempotente des fichiers globaux vers `users/<owner>/`. |
| `src/instrumentation.ts` | **Nouveau.** `register()` appelle la migration une fois au démarrage, avant la première requête. |
| `src/lib/reminders.ts` | **Modifié.** `runReminders(store, now)` au lieu de lire le store global. |
| `src/lib/caldav.ts` | **Modifié.** `runCalDavSync(store, credentials)`. Les quatre variables d'environnement CalDAV et le mapping deviennent des champs de `credentials`. |
| `src/app/api/cron/reminders/route.ts` | **Modifié.** Boucle sur les comptes. |
| `src/app/api/cron/caldav-sync/route.ts` | **Modifié.** Boucle sur les comptes ayant des identifiants. |
| `src/app/api/capture/route.ts`, `digest/route.ts`, `agenda/route.ts` | **Modifiés.** Le jeton identifie le compte. |
| ~17 autres routes sous `src/app/api/` | **Modifiées.** `requireSession()` → `requireStore()`, puis `store.xxx()`. |
| `src/app/api/settings/caldav/route.ts` | **Nouveau (lot 3).** `GET` / `PUT` / `DELETE` des identifiants CalDAV du compte. |
| `src/app/api/settings/tokens/route.ts` | **Nouveau (lot 2).** `GET` (liste sans les jetons) / `POST` (crée, rend le jeton **une seule fois**) / `DELETE` (révoque). |
| `supabase/migrations/0002_machine_tokens.sql` | **Nouveau (lot 2).** |
| `supabase/migrations/0003_caldav_credentials.sql` | **Nouveau (lot 3).** |

## Les crons

Les deux routes gardent leur **jeton global** (`BRIEF_CRON_TOKEN`,
`BRIEF_CALDAV_TOKEN`) : ces jetons déclenchent un *passage*, ils ne désignent
pas un utilisateur. Seuls `capture` et `digest` deviennent par compte.

```ts
const userIds = await listAuthorizedUserIds();          // service-role
const results = [];
for (const userId of rotate(userIds, passIndex)) {
  if (Date.now() - startedAt > BUDGET_MS) {             // 40 s sur maxDuration 50
    console.warn(`[cron] budget atteint, ${restants} comptes reportés au passage suivant`);
    break;
  }
  try {
    results.push(await runReminders(storeForUser(userId)));
  } catch (e) {
    // Un compte qui échoue ne doit jamais empêcher les suivants.
    console.error(`[cron] compte ${userId} en échec :`, e);
  }
}
```

Deux points de vigilance, tous deux invisibles s'ils sont ratés :

1. **Un échec par compte est isolé.** Sans le `try`, un `items.json` corrompu
   chez un utilisateur éteindrait les rappels de tous les autres.
2. **L'ordre tourne d'un passage à l'autre** (`rotate`). Si le budget de temps
   coupe toujours au même endroit, les derniers comptes ne seraient jamais
   traités et leurs rappels deviendraient `stale` — c'est-à-dire abandonnés
   silencieusement par `pendingReminders`. À 2-5 comptes c'est théorique ;
   la rotation coûte trois lignes et supprime la classe de bug.

Le journal reste chiffré, mais **par compte** : un cron dont la sortie est
vide ne permet pas de distinguer « rien à faire » de « cassé depuis trois
jours ».

## Migration des données de production

`src/instrumentation.ts` → `register()` → `migrateToMultiUser()`, une fois au
démarrage, **avant que le serveur accepte la première requête** (garantie de
Next 16, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`).

`register()` s'exécute aussi en runtime Edge : la migration est gardée par
`if (process.env.NEXT_RUNTIME !== "nodejs") return;` puisqu'elle utilise
`node:fs`.

```
si  users/<owner>/ existe                    → ne rien faire   (déjà migré)
sinon si aucun fichier global n'existe       → ne rien faire   (installation neuve)
sinon si BRIEF_OWNER_USER_ID absent/invalide → ÉCHOUER BRUYAMMENT, ne rien toucher
sinon → copier les 8 fichiers vers users/<owner>/,
        puis déplacer les originaux vers _pre-multiuser/,
        et journaliser chaque fichier déplacé
```

- **Idempotente** : rejouer le démarrage ne refait rien.
- **Non destructive** : les originaux partent dans `_pre-multiuser/`, ils ne
  sont jamais supprimés. `deploy/backup.sh` les emporte comme le reste.
- **Ne devine jamais.** Si des données globales existent mais que
  `BRIEF_OWNER_USER_ID` est absent, la migration s'arrête avec une erreur
  visible plutôt que d'attribuer le Brief d'Aramis à un compte au hasard.
  L'app démarre quand même — un Brief vide se voit, une donnée attribuée au
  mauvais compte, non.

`BRIEF_OWNER_USER_ID` = l'UUID Supabase d'Aramis, à récupérer dans
`authorized_users` et à poser dans `.env.production` par Hermes.

## Découpage en lots

Trois branches, trois PR, trois déploiements. Le lot 1 est le seul qui touche
aux données existantes ; les deux suivants sont additifs.

### Lot 1 — Le cloisonnement (`feat/multi-user-store`)

Partition des fichiers, fabrique de store, `requireStore()`, portage des ~20
routes, migration automatique, boucle des crons. **CalDAV et les jetons
machine continuent de fonctionner comme aujourd'hui**, rattachés à
`BRIEF_OWNER_USER_ID`.

C'est un lot **mécanique et sans changement de comportement visible** : à la
fin, Brief se comporte exactement comme avant pour Aramis, et un second compte
ouvre un Brief vide. C'est ce qui débloque la recette agent.

*Secret à poser : `SUPABASE_SECRET_KEY`, `BRIEF_OWNER_USER_ID`.*

### Lot 2 — Les jetons machine par compte (`feat/multi-user-tokens`)

Table `machine_tokens`, écran de gestion dans les Réglages, bascule de
`/api/capture` et `/api/digest` (et de la garde mixte de `/api/agenda`) sur le
jeton porteur d'identité. Les variables globales `BRIEF_CAPTURE_TOKEN` et
`BRIEF_DIGEST_TOKEN` sont acceptées en repli pendant ce lot, puis retirées à
la fin — **le raccourci iOS et Telegram sont reconfigurés une seule fois**.

### Lot 3 — CalDAV par compte (`feat/multi-user-caldav`)

Table `caldav_credentials`, `crypto.ts`, écran de saisie dans les Réglages
(identifiant iCloud, mot de passe d'application, mapping projet → calendrier),
bascule de `runCalDavSync` sur les identifiants du compte, retrait des quatre
variables d'environnement globales.

*Secret à poser : `BRIEF_ENCRYPTION_KEY`.*

**Pourquoi en dernier** : c'est le morceau le plus lourd (coffre à secrets,
UI, rotation de clé, mapping par compte) et il ne sert personne avant qu'un
second utilisateur *humain* arrive — un compte agent n'a pas de calendrier
Apple. Le mettre en tête retarderait de plusieurs jours le déblocage de la
recette, qui est la raison d'être du chantier.

## Tests

Les 531 tests existants sont le filet principal du lot 1 : ils passent
aujourd'hui contre le store global et doivent passer après contre la fabrique.
Un test qui change de sens dans ce portage est un signal, pas une corvée.

Nouveaux tests :

| Cible | Ce qui est prouvé |
|---|---|
| `store.test.ts` | Deux stores de comptes différents ne se voient pas : écrire chez A ne change rien chez B. **Le test central du chantier.** |
| `store.test.ts` | `storeForUser("../etc")` et `storeForUser("")` lèvent. |
| `store.test.ts` | La file par utilisateur : deux `updateItemsAtomically` concurrents sur le même compte ne s'écrasent pas ; sur deux comptes, ils ne se bloquent pas. |
| `guard.test.ts` | `requireStore()` rend 401 sans session, et le store du bon compte avec. |
| `migrate-multiuser.test.ts` | Migration : cas neuf, cas à migrer, cas déjà migré (idempotence), cas `BRIEF_OWNER_USER_ID` absent (ne touche rien). |
| `crypto.test.ts` | Aller-retour chiffrement ; un tag altéré lève ; un format inconnu lève. |
| `machine-tokens.test.ts` | Un jeton résout vers son compte ; un jeton révoqué ne résout plus ; un jeton d'un autre `kind` est refusé. |
| `cron/reminders.route.test.ts` | Un compte en échec n'empêche pas les suivants ; le budget de temps reporte au lieu de tronquer. |
| `no-direct-store-access.test.ts` | **Aucun fichier sous `src/app/api/` n'appelle `storeForUser`.** Fige l'invariant de cloisonnement. |

## Risques

| Risque | Parade |
|---|---|
| **La migration attribue le Brief d'Aramis au mauvais compte.** Irréversible en pratique (CalDAV vivant). | Migration non destructive (`_pre-multiuser/`), échec bruyant si `BRIEF_OWNER_USER_ID` manque, `backup.sh` lancé par Hermes avant le déploiement. |
| **Une route oubliée continue de lire le store global.** Ne lève aucune erreur : elle lirait un fichier absent et rendrait une liste vide. | La suppression des exports libres de `store.ts` casse le typecheck — une route oubliée **ne compile pas**. C'est la raison principale de préférer la fabrique. |
| **La clé service-role contourne RLS.** Une requête sans filtre `user_id` lit tout. | Surface réduite à six fonctions dans un seul fichier `server-only`, chacune filtrant explicitement. |
| **Le `userId` entre dans un chemin de fichier.** | Validation UUID stricte dans `storeForUser`, testée. |
| **Un compte en échec éteint les rappels de tous.** | `try/catch` par compte + rotation de l'ordre, testés. |
| **Deux secrets nouveaux à poser sur le VPS, sans SSH depuis le Mac.** | Ils sont annoncés lot par lot dans la passation ; le lot 1 échoue au démarrage avec un message explicite si `SUPABASE_SECRET_KEY` manque, plutôt que de partir en silence. |

## Déploiement

**Lot 1** — aucune migration SQL.

1. Hermes lance `deploy/backup.sh` **avant** le déploiement.
2. `SUPABASE_SECRET_KEY` et `BRIEF_OWNER_USER_ID` posées dans
   `.env.production` du VPS.
3. Build + `up`. La migration des fichiers s'exécute au démarrage ; son
   journal est la preuve à lire en premier.
4. Vérification : Aramis retrouve ses tâches ; un second compte créé pour les
   agents ouvre un Brief vide.

**Lot 2** — `0002_machine_tokens.sql` appliquée avant le déploiement ; les
jetons régénérés depuis les Réglages, puis le raccourci iOS et Telegram
reconfigurés une fois.

**Lot 3** — `0003_caldav_credentials.sql` appliquée, `BRIEF_ENCRYPTION_KEY`
posée, identifiants iCloud ressaisis depuis les Réglages, puis les quatre
variables CalDAV globales retirées de `.env.production`.

> ⚠️ `NEXT_PUBLIC_*` sont inlinées **au build** (`AGENTS.md`).
> `SUPABASE_SECRET_KEY` et `BRIEF_ENCRYPTION_KEY` sont des variables serveur,
> lues à l'exécution — elles n'ont pas besoin d'être présentes au build, mais
> leur absence au démarrage doit faire échouer bruyamment, pas silencieusement.

## Ce qui reste ouvert

- **Le second compte agent n'est créé qu'après le lot 1 déployé et vérifié.**
  Aujourd'hui il donnerait un accès complet aux vraies données d'Aramis.
- Le mapping projet → calendrier CalDAV est aujourd'hui une variable
  d'environnement globale avec huit entrées en dur
  (`DEFAULT_CALENDAR_MAPPING`). Au lot 3 il devient un réglage par compte ; la
  table en dur reste le défaut du compte d'Aramis.
