# Brief

Organiseur personnel piloté à la voix. Tu parles, Whisper transcrit, un LLM
découpe la note en tâches et rendez-vous datés, tu relis, Brief les garde. Les
rappels partent en **Web Push** depuis le serveur — iOS ne fournit aucune API
de notification programmée à une application web, c'est donc au serveur de
décider de la seconde d'envoi.

Brief ne dépend d'aucun service de tâches tiers : il possède ses données,
sans plafond de projets. L'app est **mobile ET desktop** — PWA installée à
l'écran d'accueil iOS + site responsive ≥ 1024 px, portée par `useIsDesktop()`
et les composants `src/components/desktop/`.

Next.js 16 (App Router) · React 19 · Tailwind v4 · Supabase Auth · hébergé en
**VPS Docker** (pas Vercel).

## Chaîne

```
micro → /api/transcribe → /api/parse → écran Revue → /api/items → stockage
        (Groq Whisper)     (Groq LLM)   (édition)                  ↓
                           dates absolues              cron → Web Push → iPhone
                                                           + sync CalDAV Apple
```

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis remplis les valeurs
npm run dev                  # http://localhost:3000
```

Le micro exige un contexte sécurisé : `localhost` convient, une IP de LAN non.

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `GROQ_API_KEY` | Transcription et structuration. | — (obligatoire) |
| `TRANSCRIBE_PROVIDER` | `groq` ou `voicebox`. | `groq` |
| `TRANSCRIBE_MODEL` | Modèle de transcription. | `whisper-large-v3` |
| `PARSE_MODEL` | Modèle de structuration. | `openai/gpt-oss-20b` |
| `CHAT_MODEL` | Modèle de l'assistant conversationnel (`/api/chat`). | — |
| `OLLAMA_API_KEY` | Chat IA quand le modèle est servi via Ollama Cloud. | — |
| `VOICEBOX_URL` | Base d'un Voicebox local. Implémenté, non testé. | — |
| `NEXT_PUBLIC_APP_NAME` | Titre affiché. Exposé au navigateur. | `Brief` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase. **Lue côté SERVEUR uniquement** malgré le préfixe (voir note). | — (obligatoire) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique « anon » Supabase. **Lue côté SERVEUR uniquement** malgré le préfixe (voir note). | — (obligatoire) |
| `SUPABASE_SECRET_KEY` | Clé **service-role** Supabase — celle qui contourne RLS. Lue à l'EXÉCUTION (pas au build). Sert uniquement aux crons, qui n'ont pas de session et doivent lister les comptes (`src/lib/supabase/admin.ts`). ⚠️ La clé la plus puissante du projet. | — (obligatoire) |
| `BRIEF_OWNER_USER_ID` | UUID Supabase du compte propriétaire. Deux rôles : la migration au démarrage lui attribue les données d'avant le multi-utilisateur, et les jetons machine `capture` / `digest` écrivent dans son Brief jusqu'au lot 2. Absente, la migration ne touche à rien et le dit. | — (obligatoire) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clé publique Web Push. Exposée au navigateur. **Build-time.** | — |
| `VAPID_PRIVATE_KEY` | Clé privée Web Push. **Jamais exposée.** | — |
| `VAPID_SUBJECT` | Contact `mailto:` exigé par le protocole VAPID. | — |
| `BRIEF_DATA_DIR` | Dossier des données serveur (projets, items, abonnements). Docker : `/app/data`. | `.data` |
| `BRIEF_CRON_TOKEN` | Jeton Bearer du planificateur de rappels (`/api/cron/*`). Distinct de la session utilisateur. | — |
| `BRIEF_CAPTURE_TOKEN` | Jeton Bearer du raccourci iOS (`/api/capture`). | — |
| `BRIEF_DIGEST_TOKEN` | Jeton Bearer de lecture machine — `/api/digest` (n8n) **et** `/api/agenda` (agents), depuis le 2026-08-30. | — |
| `BRIEF_CALDAV_USER` | Login CalDAV Apple. | — |
| `BRIEF_CALDAV_PASSWORD` | Mot de passe app-spécifique iCloud. | — |
| `BRIEF_CALDAV_ROOT` | Racine CalDAV (défaut iCloud). | — |
| `BRIEF_CALDAV_CALENDAR_PATH` | Chemin du calendrier cible. | — |
| `BRIEF_CALDAV_MAPPING` | Surcharge JSON de la correspondance kind → calendrier. | — |

`VOICEBOX_URL` n'est pas posée sur le VPS public : le service tourne sur le
LAN d'Aramis, injoignable depuis une fonction cloud.

⚠️ **Le préfixe `NEXT_PUBLIC_` des deux variables Supabase est trompeur.**
Elles ne sont lues que côté serveur — [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts)
et [`src/proxy.ts`](src/proxy.ts) ; il n'y a **pas** de client Supabase
navigateur dans Brief, l'authentification passe par `/api/auth/*`. Conséquence
pratique : ces valeurs **ne se lisent pas dans le bundle** de la prod, et un
poste de développement qui ne les a pas ne peut pas ouvrir de session — donc
pas de recette navigateur des écrans authentifiés. Les copier depuis
`/docker/brief/.env.production`.

⚠️ **Une variable définie deux fois dans un `.env` : c'est la PREMIÈRE qui
gagne** (`@next/env`, comme `scripts/brief-agents.sh`). Coller une valeur
corrigée à la fin du fichier ne corrige donc rien, et le symptôme est un 401
qui ressemble à une route cassée. Constaté le 2026-08-30 sur le Mac.

## Sécurité

L'URL de déploiement est publique. Depuis le 2026-08-26, la seule barrière
est [`src/lib/guard.ts`](src/lib/guard.ts) : `requireSession()` vérifie le
JWT Supabase Auth en temps constant (clé publique ES256, validation locale,
pas d'appel réseau). Le rafraîchissement du jeton est géré par
[`src/proxy.ts`](src/proxy.ts) avant que la route ne s'exécute. **Toute
nouvelle route sous `/api/` doit commencer par :**

```ts
const denied = await requireSession();
if (denied) return denied;
```

L'**ancien mécanisme PIN** (`BRIEF_PIN`, `x-brief-pin`, `requirePin()`,
`POST /api/session`) est **supprimé depuis le 2026-08-26** — ne pas le
réintroduire. Les commentaires morts qui le citaient dans le code ont été
nettoyés le 2026-08-29.

Les routes « machine » (`/api/cron/reminders`, `/api/capture`,
`/api/digest`, `/api/cron/caldav-sync`) portent un **jeton Bearer dédié**, pas
la session utilisateur. Un secret stocké en clair dans une crontab ou un
raccourci iOS ne doit pas ouvrir la même porte qu'une session Humain, et
doit pouvoir être révoqué seul.

## Routes

Pages publiques (sans session) :

| Page | Rôle |
|---|---|
| `/` | L'app (PWA) — l'écran de connexion Supabase s'affiche si aucune session. |
| `/landing` | Landing SaaS — fichier statique `public/landing.html`, réécrit depuis `/landing` par `next.config.ts`. CTA « Ouvrir Brief » → `/`. |

Toutes les routes `/api/*` exigent soit `requireSession()` (humain), soit un
jeton Bearer (machine). Tableau en lecture seule : voir
[`src/app/api/`](src/app/api/) pour le code exact.

| Route | Entrée | Sortie |
|---|---|---|
| **Auth** | | |
| `POST /api/auth/login` | `{ email, password }` | `{ session }` Supabase |
| `POST /api/auth/logout` | — | `{ ok: true }` |
| `POST /api/auth/forgot-password` | `{ email }` | email de reset |
| `POST /api/auth/reset-password` | `{ password }` + token URL | `{ ok: true }` |
| `GET /api/auth/session` | — | `{ user? }` (lit le JWT cookie) |
| **Capture / parsing** | | |
| `POST /api/transcribe` | multipart `file` + `mimeType` | `{ text }` |
| `POST /api/parse` | `{ text }` | `{ items }` — dates absolues, `kind` task/event |
| `POST /api/capture` | `{ text, structure? }` | **machine** — raccourci iOS |
| **Données** | | |
| `GET /api/items` | — | `{ items }` (tous les items, filtrable) |
| `POST /api/items` | `{ items }` | `{ results, saved, total }` — `207` si partiel |
| `GET /api/items/[id]` | — | un item |
| `PATCH /api/items/[id]` | champs | item mis à jour |
| `DELETE /api/items/[id]` | — | suppression |
| `GET /api/projects` | — | `[{ id, name, tint, hints }]` |
| `GET /api/overview` | — | charge par projet, activité 7 jours |
| `GET /api/agenda` | `?date=YYYY-MM-DD` | la vue Agenda du jour |
| `GET /api/board` | — | le Kanban (desktop) |
| `GET /api/objectives` | — | `[{ id, projectId, title, horizon, achievedAt }]` |
| `POST /api/objectives` | `{ title, projectId, horizon? , notes? }` | objectif créé (`201`) |
| `PATCH /api/objectives` | `{ id, title?, horizon?, achievedAt?, notes? }` | objectif mis à jour |
| `DELETE /api/objectives` | `{ id }` | suppression |
| `GET /api/search` | `?q=` | recherche plein-texte |
| `GET /api/tags` | — | tags existants |
| `GET /api/tags/[id]` | — | tag |
| **CalDAV Apple** | | |
| `GET /api/caldav-status` | — | état de la synchro (dernière réussie, erreurs) |
| `GET /api/cron/caldav-sync` | Bearer | **machine** — tire/pousse `src/lib/caldav.ts` |
| **Web Push** | | |
| `POST /api/push/subscribe` | `{ subscription }` | enregistre l'abonnement |
| `POST /api/push/test` | `{ title, body, subscription? }` | envoi immédiat |
| **IA / divers** | | |
| `POST /api/chat` | `{ messages }` | l'assistant conversationnel (tuile « Demander à l'IA ») |
| `POST /api/audio` | multipart | stocke un enregistrement |
| `GET /api/audio/[id]` | — | lit un enregistrement |
| **Planificateur** | | |
| `GET /api/cron/reminders` | Bearer | **machine** — passage d'envoi des rappels Web Push |
| `GET /api/digest` | Bearer | **machine** — récap du jour (n8n → canal) |

### Le récap du matin — `GET /api/digest`

Conçu pour un automate qui met en forme et envoie sur un canal que Brief n'a
pas (WhatsApp, Telegram, un mail). Brief notifie déjà par Web Push item par
item ; ceci répond à une autre question — « qu'est-ce qui pèse sur ma
journée » — en un seul message.

```json
{ "generatedAt": "2026-08-15T06:30:00.000Z",
  "counts":  { "overdue": 1, "today": 2 },
  "overdue": [{ "id": "…", "title": "Relancer le fournisseur", "project": "My Flip",
                "projectId": "my-flip", "kind": "task",
                "due": "2026-08-12T09:00:00+02:00", "allDay": false, "priority": 1 }],
  "today":   [ … ] }
```

Les deux listes sont triées : priorité 1 d'abord (la plus haute), puis échéance
la plus ancienne. Les tâches terminées, sans échéance ou postérieures à
aujourd'hui n'y figurent pas — un récap qui déverse l'Inbox chaque matin
finit ignoré.

**Le découpage se fait ici, pas chez l'appelant.** Un nœud Code n8n s'exécute
dans le fuseau de son conteneur (`GENERIC_TIMEZONE`, `Europe/Berlin` sur le
VPS — le bon décalage par accident). Ce réglage vit hors du dépôt : une
régression n'y produirait aucun test rouge. Voir
[`src/lib/buckets.ts`](src/lib/buckets.ts).

## Pièges à connaître

- **La priorité 1 est la PLUS HAUTE** (convention iCalendar). Une seule échelle
  dans tout le code — ne pas en réintroduire une seconde sans conversion testée.
- **Brief résout les dates lui-même.** `/api/parse` injecte l'instant courant
  dans le prompt et exige une date ISO absolue avec fuseau. Aucune date en
  français n'est stockée : c'est cette valeur que le planificateur interroge.
- **Une date illisible devient « pas d'échéance »**, jamais une date approchée.
  Un rappel absent se voit ; un rappel au mauvais moment ne se voit pas.
- **Le classement tâche / rendez-vous est visible et modifiable à la revue.**
  Une erreur du modèle n'est signalée nulle part ailleurs.
- **L'`id` d'un item est généré avant le premier envoi et réutilisé.** Un
  second envoi écrase au lieu de dupliquer : double-clic et rejeu sont
  inoffensifs.
- **iOS ne notifie que les PWA installées à l'écran d'accueil.** En onglet
  Safari, l'abonnement peut réussir sans qu'aucune notification n'arrive.
- **Tailwind v4 ne compile pas les utilitaires arbitraires contenant `env()`.**
  Les safe areas passent par `.safe-top` / `.safe-bottom` dans `globals.css`.
- **Le reset CSS doit rester dans `@layer base`.** Hors layer, il l'emporte sur
  les utilitaires Tailwind — c'est ce qui affichait un bouton noir sur noir.
- **CalDAV Apple est la source de vérité pour les horaires** (décision
  2026-08-18) : toute édition directe dans Calendrier écrase l'état Brief à la
  prochaine sync. Voir `docs/handoffs/2026-08-18-caldav-source-de-verite.md`.
- **Un crash JS client est invisible pour `curl`** (leçon 2026-08-19) : un
  serveur 200 ne prouve pas que l'app s'ouvre — vérifier en DevTools.

## Déploiement — VPS

C'est la cible réelle. Vercel ne convient pas : le stockage y est éphémère et
aucun cron à la minute n'y tourne.

Prérequis, **dans cet ordre** — l'inverse fait échouer l'obtention du
certificat en boucle :

1. Un domaine avec un enregistrement **A** vers l'IP du VPS, propagé
   (`dig +short <domaine>` doit renvoyer l'IP).

   **Pas besoin d'en acheter un.** Hostinger attribue à chaque VPS un hostname
   public gratuit `srvXXXXXX.hstgr.cloud`, **avec un wildcard** : n'importe
   quel sous-domaine (`brief.srvXXXXXX.hstgr.cloud`) résout déjà vers l'IP,
   en A et en AAAA, sans rien créer. Et `hstgr.cloud` figure sur la
   [Public Suffix List](https://publicsuffix.org/list/), donc chaque
   `srvXXXXXX.hstgr.cloud` compte comme un domaine enregistré distinct pour
   Let's Encrypt : quota propre, aucune concurrence avec les autres clients.
   Passer à un domaine acheté plus tard ne coûte qu'une ligne de
   `.env.production` et un `docker compose up -d`.
2. Les ports **80 et 443** ouverts. Le 80 porte le défi HTTP-01 de Let's
   Encrypt : le fermer casse aussi le renouvellement.
3. **Un reverse proxy.** Le VPS actuel en a déjà un — un Traefik en réseau
   host (`/docker/traefik`) qui sert aussi n8n. Brief s'y branche par les
   labels de `app` ; il n'y a pas de proxy dans ce dépôt. Sur une machine
   nue, prendre `deploy/Caddyfile`.

```bash
cp .env.production.example .env.production   # puis remplir, BRIEF_DOMAIN inclus
docker compose --env-file .env.production up -d --build
```

Quatre choses à ne pas rater :

**`--env-file .env.production` n'est pas facultatif.** `env_file:` injecte des
variables dans un conteneur au démarrage ; il n'alimente pas l'interpolation
`${...}` du `docker-compose.yml`, que Compose ne lit que depuis le shell ou
un fichier nommé `.env`. Sans le drapeau, la clé VAPID publique arrive vide au
build. Le fichier contient désormais des gardes `:?` qui font échouer Compose
plutôt que de produire une image silencieusement cassée.

**Le volume.** `brief-data` est l'**unique** copie de ton organisation —
contrairement à une synchronisation CalDAV, aucun téléphone n'en garde de
réplique. Le perdre, c'est tout perdre.

**La clé VAPID publique doit être passée AU BUILD.** Les variables
`NEXT_PUBLIC_*` sont inlinées dans le bundle par le compilateur. Absente au
build, elle vaut `undefined` dans le navigateur et l'abonnement aux
notifications échoue sans que le serveur ne voie rien. Même chose pour les
deux variables Supabase. Le `docker-compose.yml` les passe en `args`, pas
seulement en `env_file`.

**Le HTTPS n'est pas optionnel.** Le micro et les notifications exigent un
contexte sécurisé. Le conteneur `app` n'écoute que sur `127.0.0.1:3000` —
utile pour diagnostiquer depuis le VPS, jamais joignable de l'extérieur.
C'est Traefik qui termine le TLS, via les labels de `app`, et qui renouvelle
seul.

⚠️ Traefik tourne en `exposedbydefault=false`. Sans les labels, le conteneur
démarre parfaitement et reste **invisible depuis Internet** : aucune erreur,
juste un 404 du proxy. C'est le premier endroit à regarder si le domaine ne
répond pas.

Vérifier après le premier `up` — le certificat prend quelques secondes :

```bash
curl -sS -o /dev/null -w '%{http_code} %{ssl_verify_result}\n' https://<domaine>/
# attendu : 200 0   (ssl_verify_result=0 = chaîne valide)
docker compose ps        # app doit être « healthy », pas seulement « running »
```

### Le cron

Un conteneur séparé appelle `/api/cron/reminders` chaque minute.
Volontairement pas un `setInterval` dans l'application : un planificateur en
mémoire disparaît au premier redémarrage, et c'est précisément ce qu'il ne
doit pas faire.

Chaque passage journalise `checked / due / sent / advanced / stale /
failures`. Une sortie vide ne permettrait pas de distinguer « rien à faire »
de « cassé depuis trois jours ».

### Sauvegardes

Installé sur le VPS en `/etc/cron.d/brief` (déclaratif, contrairement à
`crontab -e`, et versionnable) :

```cron
0 3 * * * root BRIEF_VOLUME=brief_brief-data /docker/brief/deploy/backup.sh >> /var/log/brief-backup.log 2>&1
```

⚠️ Un fichier de `/etc/cron.d` est **ignoré en silence** si son nom contient
un point ou si ses permissions ne sont pas 644 root:root. Aucune erreur nulle
part.

Le script vérifie l'archive juste après l'avoir écrite. **Une sauvegarde
jamais restaurée n'est pas une sauvegarde.** Le cycle complet a été exercé le
2026-08-13 — sauvegarde, suppression de `items.json`, restauration, donnée
revenue :

```bash
ARCH=$(ls -t /var/backups/brief/brief-*.tar.gz | head -1)
docker run --rm -v brief_brief-data:/data -v /var/backups/brief:/backup:ro \
  alpine:3.20 tar -xzf "/backup/$(basename $ARCH)" -C /data
```

### Le raccourci iOS

1. Raccourcis → nouveau → **Dicter le texte** (français)
2. **Obtenir le contenu de l'URL** : `POST https://<domaine>/api/capture`
   en-tête `Authorization: Bearer <BRIEF...N>`, corps `{"text": <dictée>}`
3. Réglages → Bouton Action → ce raccourci

`{"structure": false}` court-circuite le LLM et dépose la note brute dans
l'Inbox — utile quand on veut juste ne pas oublier, sans attendre le réseau.

### Avertissement de build connu

Le build signale trois fois *« Dynamic filesystem access causes tracing of
the whole project »* sur `src/lib/store.ts`. C'est inhérent à un stockage
fichier : Next ne peut pas déterminer statiquement ce qui sera lu.
Conséquence, la sortie standalone pèse 41 Mo au lieu d'un peu moins. Sans
effet sur le fonctionnement.

## Vérifications rapides

```bash
# la garde répond bien 401 sans session Supabase
curl -s -o /dev/null -w '%{http_code}\n' -X GET https://<url>/api/auth/session

# structuration de bout en bout (avec une session valide en cookie)
curl -s -X POST https://<url>/api/parse \
  -H 'Content-Type: application/json' -H "Cookie: <session>" \
  -d '{"text":"demain photographier les polos"}'
```
