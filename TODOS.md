# TODOS — Brief

Registre du travail différé. Réécrit le 2026-08-11.
Rien de différé ne vit ailleurs que dans ce fichier.

## L'architecture réelle

Brief **possède ses données**. Il n'écrit dans le système de personne d'autre et
n'a donc aucun plafond de projets.

| | |
|---|---|
| Stockage | fichiers JSON, écriture atomique (`temp` + `rename`) et file d'écritures sérialisée — `src/lib/store.ts`. Chemin par `BRIEF_DATA_DIR`. |
| Rappels | conteneur `cron` qui appelle `/api/cron/reminders` toutes les 60 s, puis **Web Push** — `src/lib/reminders.ts`, `src/lib/webpush.ts`. |
| Hébergement | VPS Hostinger, `docker-compose.yml` (app + cron + volume `brief-data`), sauvegarde par `deploy/backup.sh`. |
| Client | PWA installée sur iPhone. Dictée → Whisper → structuration LLM → revue → enregistrement. |

**CalDAV a été écarté** et ne doit pas revenir sans nouvelle décision : un compte
CalDAV tiers sur iOS n'a pas de push APNs, donc un plancher de synchronisation
d'environ 15 minutes qui casse tout rappel à court terme. Un serveur qui tourne
24 h/24 pousse à l'instant exact.

⚠️ Le journal de décisions mentionne encore « Postgres » et un « flux
`calendar.ics` en lecture seule ». **Ni l'un ni l'autre n'existe dans le code.**
Voir la section « Décisions à trancher » plus bas.

---

## P0 — ✅ Entièrement soldé le 2026-08-13

**Les trois blocages sont levés le même jour** : l'app est en ligne en HTTPS, elle
garde ses données, et un rappel sonne réellement sur un iPhone verrouillé. Brief
est désormais un produit utilisable, pas une maquette.

**Le sujet le plus urgent est donc le P1 ci-dessous** — l'autorisation micro que
Safari redemande à chaque ouverture. C'est ce qui décide si Aramis continue à
s'en servir.

Conservé ici plutôt qu'effacé : ces entrées disent *comment* ça a été prouvé, et
ce qu'il ne faut pas casser.

### ~~Prouver que le Web Push arrive sur un iPhone verrouillé~~ — RÉUSSI le 2026-08-13
**Aramis a fait le test : téléphone verrouillé, la notification arrive.**

C'était **le risque numéro un du produit** — toute la promesse des rappels
reposait dessus, et seuls les chemins d'ÉCHEC avaient été vérifiés en conditions
réelles. Le pari est gagné, en production, sur son matériel.

Ce que ça valide et qu'il ne faut plus re-débattre : le choix du Web Push contre
CalDAV, et le serveur qui possède l'horloge. iOS ne donne aucune API de
notification programmée à une PWA — ni Notification Triggers, ni Background
Sync, ni Periodic Background Sync, ni Background Fetch. C'est pour ça que le
conteneur `cron` appelle `/api/cron/reminders` toutes les 60 s.

⚠️ Conditions qui restent nécessaires, à ne pas casser par inadvertance : PWA
installée depuis l'écran d'accueil (iOS 16.4+, l'abonnement est impossible
depuis un onglet Safari), abonnement push valide, et HTTPS réel.

### ~~Déployer sur le VPS avec un vrai domaine et TLS~~ — FAIT le 2026-08-13
En ligne sur **https://brief.srv1899780.hstgr.cloud**, PIN d'accès actif.

Ce qui a été vérifié, pas supposé : certificat Let's Encrypt valide (chaîne
`ssl_verify=0`, expire le 2026-11-11), redirection HTTP→HTTPS, garde PIN
(401 sans, 200 avec), écriture d'un item **survivant à un `docker compose down`**,
conteneur `app` *healthy*, cron des rappels journalisant chaque minute, et le
cycle sauvegarde → destruction → restauration exercé en entier.

Le VPS avait déjà un **Traefik** en réseau host tenant 80/443 et servant n8n :
Brief s'y branche par labels. Pas de Caddy — il aurait échoué sur « port already
allocated », et sortir Traefik aurait cassé n8n. `deploy/Caddyfile` reste pour
une machine nue. Aucun domaine acheté : `*.srv1899780.hstgr.cloud` est un
wildcard, et `hstgr.cloud` est sur la Public Suffix List.

Trois pannes silencieuses corrigées au passage, toutes dans le dépôt :
- `command: >` avec des `\` dans le service `cron` — Compose consommait
  l'antislash, curl partait sans URL. **Aucun rappel n'aurait jamais sonné**,
  conteneur « up » compris.
- La sonde de vie visait `GET /api/session`, qui répond 405 : la route n'expose
  que POST. Le conteneur restait *unhealthy* et le cron ne démarrait pas.
- `docker compose up` sans `--env-file .env.production` construisait l'image
  avec une clé VAPID vide, inlinée à `undefined`. Des gardes `:?` bloquent
  désormais le build.

### ~~Variables d'environnement absentes en production~~ — SANS OBJET
La cible d'hébergement est le VPS, plus Vercel. Les cinq variables sont dans
`/docker/brief/.env.production` et vérifiées chargées : `BRIEF_DATA_DIR=/app/data`
pointe sur le volume, la clé VAPID publique est confirmée présente **dans le
bundle** (`.next/static/chunks/`), et `/api/capture` a son jeton.

Vercel reste utilisable pour regarder l'interface, sans plus.

---

## P1 — Le micro rend l'app pénible sur iPhone

Constaté sur l'iPhone d'Aramis, PWA correctement installée : **Safari redemande
l'autorisation micro à chaque arrivée dans l'app**, et de nouveau après chaque
sortie. Ce n'est ni notre code, ni l'hébergeur : WebKit ne rend pas cette
autorisation permanente et aucune API web ne le permet. Le VPS n'y changera rien.

Assez frustrant pour qu'Aramis envisage d'arrêter d'utiliser l'app. C'est donc un
risque produit, pas une gêne cosmétique. Deux échappatoires, aucune construite.

### Dictée par le clavier iOS dans l'app
- **Quoi :** rendre la zone de note éditable pour utiliser le micro du clavier.
- **Pourquoi :** la dictée native n'appelle pas `getUserMedia` : **aucune invite,
  jamais**, et pas de pastille orange. On garde la revue, les projets, les rappels.
- **Pour :** supprime aussi l'envoi audio, la latence de transcription et le coût Groq.
- **Contre :** c'est la reconnaissance d'Apple et non Whisper ; deux chemins de
  saisie à maintenir.
- **Effort :** S (humain) → S (CC) · **Priorité :** P1
- **Dépend de :** rien.

### Raccourci iOS sur le bouton Action
- **Quoi :** activer `/api/capture`, déjà écrit pour ça (voir son commentaire d'en-tête).
- **Pourquoi :** capture la plus rapide possible — appuyer, parler, c'est rangé,
  sans jamais ouvrir l'app ni autoriser quoi que ce soit.
- **Contre :** court-circuite l'écran de revue, donc une erreur de classement du
  modèle n'est signalée nulle part.
- **Contexte :** jeton dédié `BRIEF_CAPTURE_TOKEN`, jamais le PIN : un secret
  déposé dans un raccourci iOS est en clair sur le téléphone.
- **Effort :** S (humain) → S (CC) · **Priorité :** P1
- **Dépend de :** `BRIEF_CAPTURE_TOKEN` posé côté serveur.

---

## P1 bis — Le récap du matin n'a pas encore de canal

`GET /api/digest` existe et est déployée (2026-08-14), et le workflow n8n
**Brief — récap du matin** (`H9f6EWHUzUmi9JDV`) lit, filtre et met en forme le
message. **Il ne l'envoie nulle part.** Le workflow s'arrête sur le nœud de mise
en forme.

### Brancher WhatsApp au bout du workflow
- **Quoi :** ajouter le nœud `WhatsApp Business Cloud` après « Mettre en forme
  le message ».
- **Contexte :** Aramis a déjà un WhatsApp Business et un bot Hermes qui lui
  écrit depuis un numéro dédié, distinct du perso. **Reste à établir comment ce
  bot est câblé** (API Meta directe ? via Hostinger ?) : s'il passe par la Cloud
  API, le credential se réutilise et il n'y a presque rien à faire.
- **Contre :** hors de la fenêtre de 24 h, Meta impose un **template
  pré-approuvé** — texte figé, variables `{{1}}`, pas de saut de ligne dans un
  paramètre. Un récap de longueur variable devra être aplati. À vérifier avant
  de s'engager : c'est affirmé de mémoire, pas testé.
- **Repli si le template coince :** Telegram (nœud natif, aucune approbation).
- **Effort :** S (humain, côté Meta) → S (CC) · **Priorité :** P1

### Donner un chemin d'erreur au workflow
- **Quoi :** brancher la sortie d'erreur du nœud HTTP, ou un Error Trigger.
- **Pourquoi :** si Brief redémarre à 8h30, le workflow échoue et **rien ne le
  dit** — c'est exactement la panne silencieuse que le projet combat ailleurs.
  Un récap absent ressemble à une journée vide.
- **Contexte :** différé volontairement — un chemin d'erreur n'a nulle part où
  aller tant qu'aucun canal n'est branché. À faire en même temps que WhatsApp.
- **Effort :** S (humain) → S (CC) · **Priorité :** P1
- **Dépend de :** le canal ci-dessus.

---

## P2 — Prévu, à faire plus tard

**Tranché par Aramis le 2026-08-11 :** ces deux chantiers sont validés, ils
avaient simplement été oubliés. Ce ne sont donc pas des questions ouvertes. Le
pour et le contre restent écrits parce qu'ils décrivent les pièges de mise en
œuvre, pas parce que la décision serait à reprendre.

### Passer le stockage à Postgres
- **État :** annoncé dans le journal de décisions, jamais construit. Le code livré
  est un magasin de fichiers JSON avec écritures atomiques.
- **Pour garder JSON :** aucune dépendance, sauvegarde = copie de fichiers,
  suffisant pour un utilisateur unique et quelques milliers d'items.
- **Pour Postgres :** requêtes, migrations, et une vision globale qui reste
  rapide si le volume explose. Aujourd'hui l'agrégation relit tout le fichier.
- **À faire au moment de la migration :** garder `store.ts` comme seule porte
  d'accès aux données, pour que le changement se joue derrière son interface et
  non dans chaque route. Prévoir l'import des fichiers JSON existants et une
  restauration testée avant de basculer.
- **Effort :** M (humain) → S (CC) · **Priorité :** P2

### Construire le flux `calendar.ics` en lecture seule
- **État :** annoncé dans le journal de décisions, jamais construit.
- **Pourquoi ce serait utile :** l'app Calendrier d'iOS afficherait les
  rendez-vous de Brief sans que Brief ait à écrire quoi que ce soit.
- **Contre :** un abonnement calendrier iOS se rafraîchit quand il veut, souvent
  plusieurs fois par heure au mieux. À réserver à l'AFFICHAGE, jamais aux
  rappels — sinon on réintroduit le défaut qui a fait écarter CalDAV.
- **Règle à respecter :** l'abonnement sert à AFFICHER, jamais à rappeler. Un
  jeton d'URL dédié, révocable, jamais le PIN — une URL de calendrier finit
  toujours par circuler en clair.
- **Effort :** S (humain) → S (CC) · **Priorité :** P2

---

## P3 — Différé

### Sous-tâches
- **Quoi :** permettre à une dictée de produire une tâche avec ses sous-tâches.
- **Pourquoi :** peu d'outils de capture vocale le font, c'est un endroit où Brief
  peut être meilleur.
- **Contre :** complexifie le prompt et transforme l'écran de revue en arbre.
- **Contexte :** le mécanisme CalDAV `RELATED-TO` n'a plus lieu d'être. Brief
  possède son modèle : un champ `parentId` sur `Item` suffit. À reprendre une
  fois le noyau stable et la revue éprouvée sur des listes plates.
- **Effort :** M (humain) → S (CC) · **Priorité :** P3
- **Dépend de :** noyau en production et utilisé.

### Apprentissage des corrections de destination
- **Quoi :** mémoriser que « Frip » finit toujours dans telle liste, et pré-remplir.
- **Pourquoi :** la correction manuelle répétée est la friction la plus visible
  d'un outil qu'on utilise dix fois par jour.
- **Contre :** demande un état d'apprentissage à stocker, et rend le comportement
  moins prévisible pendant la phase d'apprentissage.
- **Contexte :** suppose un volume de corrections réel. À reprendre après
  quelques semaines d'usage, pas avant.
- **Effort :** M (humain) → S (CC) · **Priorité :** P3
- **Dépend de :** données d'usage réelles.

### Rappels déclenchés par un lieu
- **Quoi :** « quand j'arrive au bureau, penser à … ».
- **Pourquoi :** une partie des tâches sont contextuelles, pas temporelles.
- **Contre — et c'est probablement rédhibitoire :** une PWA iOS n'a **aucun accès
  au géorepérage en arrière-plan**. La Geolocation API n'existe que pendant que
  la page tourne au premier plan, donc un rappel de lieu ne se déclencherait
  jamais. C'est exactement la défaillance silencieuse qu'on cherche à éliminer :
  l'item se crée, et rien ne sonne.
- **Contexte :** ne devient possible qu'avec un Raccourci iOS à automatisation de
  lieu, qui appellerait `/api/capture`. À explorer par là, ou à abandonner.
- **Effort :** L (humain) → M (CC) · **Priorité :** P3
- **Dépend de :** une vérification préalable côté Raccourcis.

### Documenter « pourquoi Web Push » dans le README
- **Quoi :** une section expliquant que le choix vient du mur des notifications iOS.
- **Pourquoi :** sans elle, le choix paraîtra arbitraire dans six mois, y compris
  pour toi — et quelqu'un proposera CalDAV, déjà écarté pour de bonnes raisons.
- **Contre :** aucun.
- **Effort :** S (humain) → S (CC) · **Priorité :** P3
- **Dépend de :** rien.

---

## Dette connue

- `src/app/favicon.ico` date de l'ancienne identité — à régénérer depuis la capsule.
- `docs/designs/preview-systeme.html` montre encore cinq teintes et aucune forme.
- `docs/designs/organiseur-autonome.md` décrit l'architecture CalDAV abandonnée.
- L'écran Vision n'a pas d'état distinct pour « une seule journée chargée » : le
  bloc « ton mur » énonce alors une évidence.
- `.env.local` contient encore un `TODOIST_API_TOKEN` vivant sur une variable que
  plus aucun code ne lit. À révoquer chez Todoist, pas seulement à supprimer.

## Retiré — ne pas réintroduire

Ces éléments dépendaient d'un noyau CalDAV qui ne sera pas construit :
**cible CalDAV générique** (Nextcloud, Fastmail) et **sous-tâches par
`RELATED-TO`**, dont l'intention survit sous une autre forme ci-dessus.
