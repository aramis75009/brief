# Brief

Organiseur personnel piloté à la voix. Tu parles, Whisper transcrit, un LLM
découpe la note en tâches et rendez-vous datés, tu relis, Brief les garde.

Brief ne dépend d'aucun service de tâches tiers : il possède ses données, sans
plafond de projets. Les rappels partent en **Web Push** depuis le serveur —
iOS ne fournit aucune API de notification programmée à une application web,
c'est donc au serveur de décider de la seconde d'envoi.

Next.js 16 (App Router) · React 19 · Tailwind v4 · déployé sur Vercel.

## Chaîne

```
micro → /api/transcribe → /api/parse → écran Revue → /api/items → stockage
        (Groq Whisper)     (Groq LLM)   (édition)                  ↓
                           dates absolues              cron → Web Push → iPhone
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
| `BRIEF_PIN` | Code d'accès. Vérifié **côté serveur** sur toutes les routes `/api/*`. | — (obligatoire) |
| `GROQ_API_KEY` | Transcription et structuration. | — (obligatoire) |
| `TRANSCRIBE_PROVIDER` | `groq` ou `voicebox`. | `groq` |
| `TRANSCRIBE_MODEL` | Modèle de transcription. | `whisper-large-v3` |
| `PARSE_MODEL` | Modèle de structuration. | `openai/gpt-oss-20b` |
| `NEXT_PUBLIC_APP_NAME` | Titre affiché. Exposé au navigateur. | `Brief` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clé publique Web Push. Exposée au navigateur. | — |
| `VAPID_PRIVATE_KEY` | Clé privée Web Push. **Jamais exposée.** | — |
| `VAPID_SUBJECT` | Contact `mailto:` exigé par le protocole VAPID. | — |
| `BRIEF_DATA_DIR` | Dossier des données serveur (projets, items, abonnements). **Éphémère sur Vercel.** | `.data` |
| `BRIEF_CRON_TOKEN` | Jeton du planificateur de rappels. Distinct du PIN. | — |
| `BRIEF_CAPTURE_TOKEN` | Jeton du raccourci iOS. Distinct du PIN. | — |
| `VOICEBOX_URL` | Base d'un Voicebox local. Implémenté, non testé. | — |

`VOICEBOX_URL` n'est **pas** posée sur Vercel : le service tourne sur le LAN,
injoignable depuis une fonction cloud.

## Sécurité

L'URL de déploiement est publique. La seule barrière est
[`src/lib/guard.ts`](src/lib/guard.ts) : chaque route `/api/*` compare le header
`x-brief-pin` à `process.env.BRIEF_PIN` en temps constant, et renvoie `401`
sinon. **Toute nouvelle route sous `/api/` doit commencer par :**

```ts
const denied = requirePin(req);
if (denied) return denied;
```

L'écran PIN et le `sessionStorage` ne sont que de l'UX — ils ne protègent rien.

## Routes

| Route | Entrée | Sortie |
|---|---|---|
| `POST /api/session` | header PIN | `{ ok: true }` — valide un code |
| `POST /api/transcribe` | multipart `file` + `mimeType` | `{ text }` |
| `GET /api/projects` | — | `[{ id, name, tint, hints }]` — projets de Brief |
| `POST /api/parse` | `{ text }` | `{ items }` — dates absolues, `kind` task/event |
| `GET /api/items` | — | `{ items }` |
| `POST /api/items` | `{ items }` | `{ results, saved, total }` — `207` si partiel |
| `GET /api/overview` | — | charge par projet, activité 7 jours |
| `POST /api/push/subscribe` | `{ subscription }` | enregistre l'abonnement Web Push |
| `POST /api/push/test` | `{ title, body, subscription? }` | envoi immédiat |
| `GET /api/cron/reminders` | `Authorization: Bearer $BRIEF_CRON_TOKEN` | passage du planificateur |
| `POST /api/capture` | `Authorization: Bearer $BRIEF_CAPTURE_TOKEN`, `{ text, structure? }` | raccourci iOS |

Les deux dernières portent un **jeton machine**, pas le PIN : un secret déposé
dans une crontab ou un raccourci iOS ne doit pas ouvrir la même porte que le
code que tu tapes, et doit pouvoir être révoqué seul.

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
- **L'`id` d'un item est généré avant le premier envoi et réutilisé.** Un second
  envoi écrase au lieu de dupliquer : double-clic et rejeu sont inoffensifs.
- **iOS ne notifie que les PWA installées à l'écran d'accueil.** En onglet
  Safari, l'abonnement peut réussir sans qu'aucune notification n'arrive.
- **Tailwind v4 ne compile pas les utilitaires arbitraires contenant `env()`.**
  Les safe areas passent par `.safe-top` / `.safe-bottom` dans `globals.css`.
- **Le reset CSS doit rester dans `@layer base`.** Hors layer, il l'emporte sur
  les utilitaires Tailwind — c'est ce qui affichait un bouton noir sur noir.

## Déploiement — VPS

C'est la cible réelle. Vercel ne convient pas : le stockage y est éphémère et
aucun cron à la minute n'y tourne.

```bash
cp .env.production.example .env.production   # puis remplir
docker compose up -d --build
```

Trois choses à ne pas rater :

**Le volume.** `brief-data` est l'**unique** copie de ton organisation —
contrairement à une synchronisation CalDAV, aucun téléphone n'en garde de
réplique. Le perdre, c'est tout perdre.

**La clé VAPID publique doit être passée AU BUILD.** Les variables
`NEXT_PUBLIC_*` sont inlinées dans le bundle par le compilateur. Absente au
build, elle vaut `undefined` dans le navigateur et l'abonnement aux
notifications échoue sans que le serveur ne voie rien. Le `docker-compose.yml`
la passe en `args`, pas seulement en `env_file`.

**Le HTTPS n'est pas optionnel.** Le micro et les notifications exigent un
contexte sécurisé. Le conteneur n'écoute que sur `127.0.0.1:3000` : un reverse
proxy (Caddy, nginx) doit le publier en TLS.

### Le cron

Un conteneur séparé appelle `/api/cron/reminders` chaque minute. Volontairement
pas un `setInterval` dans l'application : un planificateur en mémoire disparaît
au premier redémarrage, et c'est précisément ce qu'il ne doit pas faire.

Chaque passage journalise `checked / due / sent / advanced / stale / failures`.
Une sortie vide ne permettrait pas de distinguer « rien à faire » de « cassé
depuis trois jours ».

### Sauvegardes

```bash
0 3 * * *  /opt/brief/deploy/backup.sh >> /var/log/brief-backup.log 2>&1
```

Le script vérifie l'archive juste après l'avoir écrite. **Une sauvegarde jamais
restaurée n'est pas une sauvegarde** : teste la restauration dans un volume
jetable au moins une fois.

### Le raccourci iOS

1. Raccourcis → nouveau → **Dicter le texte** (français)
2. **Obtenir le contenu de l'URL** : `POST https://<domaine>/api/capture`
   en-tête `Authorization: Bearer <BRIEF_CAPTURE_TOKEN>`, corps `{"text": <dictée>}`
3. Réglages → Bouton Action → ce raccourci

`{"structure": false}` court-circuite le LLM et dépose la note brute dans
l'Inbox — utile quand on veut juste ne pas oublier, sans attendre le réseau.

### Avertissement de build connu

Le build signale trois fois *« Dynamic filesystem access causes tracing of the
whole project »* sur `src/lib/store.ts`. C'est inhérent à un stockage fichier :
Next ne peut pas déterminer statiquement ce qui sera lu. Conséquence, la sortie
standalone pèse 41 Mo au lieu d'un peu moins. Sans effet sur le fonctionnement.

## Vérifications rapides

```bash
# le garde répond bien 401 sans PIN
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<url>/api/session

# structuration de bout en bout
curl -s -X POST https://<url>/api/parse \
  -H 'x-brief-pin: <PIN>' -H 'Content-Type: application/json' \
  -d '{"text":"demain photographier les polos"}'
```
