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

**CalDAV Apple a été réactivé le 2026-08-17** (décision Aramis, `DECISIONS.md`) :
la synchro Brief → calendrier Apple est **implémentée et déployée**
(`src/lib/caldav.ts` + `/api/cron/caldav-sync`). La latence ~15 min d'un compte
CalDAV tiers est acceptée car les rappels à court terme restent en Web Push
dans Brief — le calendrier Apple sert les résumés matin/soir, pas les rappels.

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

## P1 bis — Le récap du matin sonne, mais son échec est muet

`GET /api/digest` est déployée et le workflow n8n **Brief — récap du matin**
(`H9f6EWHUzUmi9JDV`) est **complet et publié** : cron 8h30 Europe/Paris → lecture
→ filtre → mise en forme → **Telegram**. Envoi prouvé le 2026-08-14.

**WhatsApp est abandonné pour ce besoin** — Telegram fait le travail sans compte
Meta, sans numéro dédié et sans template à faire approuver. Ne pas y revenir sans
raison nouvelle.

### Donner un chemin d'erreur au workflow
- **Quoi :** brancher la sortie d'erreur du nœud « Lire le récap Brief » vers un
  second envoi Telegram, ou poser un Error Workflow dans les réglages.
- **Pourquoi :** si Brief redémarre ou répond 401 à 8h30, le workflow échoue et
  **rien ne le dit**. Un récap absent est indiscernable d'une journée vide —
  c'est exactement la panne silencieuse que le projet combat partout ailleurs,
  et le nœud « Quelque chose à dire ? » rend justement le silence normal.
- **Contexte :** le canal existe désormais, donc plus rien ne bloque.
- **Effort :** S (humain) → S (CC) · **Priorité :** P1

### Surveiller la fraîcheur du jeton et du credential
- **Quoi :** rien à construire, juste à savoir : `BRIEF_DIGEST_TOKEN` vit dans
  `/docker/brief/.env.production` **et** dans le credential n8n
  `THLHqJ0euzjzwBm7`. Les deux doivent rester identiques.
- **Pourquoi :** les changer d'un seul côté produit un 401 à 8h30, donc un récap
  absent — encore une fois silencieux tant que le point ci-dessus n'est pas fait.
- **Priorité :** P2

---

## P2 — Prévu, à faire plus tard

### Stocker les enregistrements vocaux — annoncé par Aramis comme le prochain chantier (2026-08-19 soir)
- **Quoi :** garder l'audio brut de chaque dictée, pas seulement le texte
  transcrit, pour pouvoir ré-écouter l'original derrière un item. Le bouton
  « Écouter l'extrait » existe déjà dans `TaskDetailScreen.tsx` (à côté du
  fil d'origine) mais n'a **aucun handler** — conçu pour ça dès le départ,
  jamais branché faute de quoi que ce soit à lire.
- **État actuel, vérifié dans le code :** `src/app/api/transcribe/route.ts`
  reçoit le fichier audio en multipart et le transmet tel quel à Groq
  Whisper — **il n'est enregistré nulle part**, perdu dès que la réponse
  HTTP part. `Item.audioOrigin` (`src/lib/types.ts`) ne garde que des
  métadonnées texte (transcription complète, extrait surligné, `startSec`/
  `endSec`/`durationSec`) — jamais le blob audio lui-même.
- **Prérequis explicites d'Aramis avant de s'y attaquer**, dans ses mots :
  « il va falloir bien vérifier que l'IA qui s'occupe de transcrire le vocal
  à l'écrit fonctionne bien, que l'enregistrement fonctionne bien, etc. » —
  fiabiliser l'existant (`useRecorder.ts` côté client, `/api/transcribe`
  côté serveur) avant d'ajouter le stockage par-dessus, pas en même temps.
- **Questions à trancher avant de coder** (brainstorming architectural,
  pas un fix ponctuel — voir `superpowers:brainstorming`) : où stocker
  (volume `brief-data` existant vs stockage objet dédié — les fichiers
  audio pèsent nettement plus que le JSON actuel, qui reste minuscule) ;
  taille/rétention (garder indéfiniment ou purger après N jours ?) ; format
  exact du lien `AudioOrigin` → fichier stocké ; câblage réel du bouton Play
  déjà présent dans l'UI ; confidentialité (ce sont des enregistrements
  vocaux personnels, sur un VPS auto-hébergé — pas de tiers, mais un vrai
  volume de données sensibles qui grossit).
- **Effort :** M-L, nécessite un vrai brainstorming architectural avant
  d'écrire du code · **Priorité :** annoncée par Aramis comme le prochain
  chantier — à traiter avant les autres entrées P2 ci-dessous.
- **Dépend de :** fiabilité vérifiée de l'enregistrement et de la
  transcription en premier (prérequis explicite d'Aramis, voir ci-dessus).

### Bug préexistant : `<button>` imbriqué dans `TodayRow`/`RowCheckbox`
- **Quoi :** `HomeScreen.tsx`, la ligne « Aujourd'hui » est un `<button>` qui
  contient `RowCheckbox`, un second `<button>` — HTML invalide, erreur
  d'hydratation React visible en console (« 2 Issues » dans l'overlay dev).
- **Découvert :** en testant la refonte du 19/08, pas introduit par elle.
- **Effort :** S (CC) · **Priorité :** P2

### Refonte du système de tâches + report avec choix de date — retour Aramis 2026-08-20
- **Quoi :** Aramis : « je pense qu'il va falloir qu'on revoie complètement le
  système de tâches dans Brief car là j'essaye de repousser une tâche, je peux
  pas choisir la date à laquelle je vais la repousser, tout bug quasiment tout
  bug au niveau des tâches. Il va falloir qu'on donne la main à [une IA très
  puissante] pour qu'elle s'occupe de tout ça. »
- **Deux problèmes concrets :**
  1. « Reporter » ne propose aucune date : `postponeItem` (`BriefApp.tsx`)
     fait `resolveDue("demain", …)` en dur — impossible de repousser à une
     date choisie. Il faut un sélecteur de date/heure dans la fiche.
  2. Le comportement des récurrentes prêtait à confusion (toast « Repoussé »,
     occurrences passées réaffichées) — corrigé le 20/08 soir pour le
     masquage (commit `899ade4`), mais la refonte globale du modèle de
     tâches reste demandée par Aramis.
- **Direction pressentie :** confier la refonte du modèle de tâches à une IA
  puissante (Claude ?), via un vrai brainstorming architectural d'abord
  (comme le chantier stockage vocal). PAS un fix ponctuel.
- **Effort :** XL · **Priorité :** P2, en attente de décision Aramis sur
  l'agent/la méthode.

**Tranché par Aramis le 2026-08-15 :**

### ~~Version Desktop~~ — V1 livrée le 2026-08-23, en attente de revue
- **Quoi :** port fidèle du prototype Claude Design `Brief Desktop.dc.html`
  (5 écrans : Dashboard, Calendrier, Tâches, Idées, Réglages, + palette ⌘K +
  modale de capture) en composants React réels, `src/components/desktop/`,
  bascule à 1024px via `useIsDesktop()`. Mobile inchangé. Voir
  `docs/handoffs/2026-08-23-...` (prochaine archive) pour le détail.
- **Reste à faire :** revue visuelle d'Aramis sur écran large, `npm run build`
  (non lancé pendant la session d'implémentation — `dev` tournait en
  parallèle), commit/déploiement sur demande explicite.
- **Effort :** fait (Claude Code) · **Priorité :** revue avant merge

### Vue Kanban (Trello-like) — hors périmètre de la V1 desktop
- **Quoi :** colonnes Kanban / board interactif avec glisser-déposer
  (Drag & Drop) d'un statut/horizon à un autre.
- **Pourquoi différée :** le prototype fourni par Aramis pour la V1 desktop
  (`Brief Desktop.dc.html`) ne contient aucun board Kanban — seulement les 5
  écrans listés ci-dessus. Le tranchage du 2026-08-15 groupait les deux sous
  un même chantier ; ils sont désormais deux chantiers distincts.
- **Effort :** M-L (nécessite un vrai brainstorming — modèle de statuts/
  colonnes, drag & drop) · **Priorité :** P2, à spécifier séparément

### Calendrier desktop — gros chantier (reporté par Aramis le 23/08)
- **Quoi :** l'écran Calendrier desktop (`DesktopCalendar.tsx`) a un affichage
  buggé. Aramis le sait et reporte : « c'est un gros chantier, on s'en
  occupera plus tard ».
- **Effort :** L · **Priorité :** P2, à reprendre quand Aramis le demande

### Scraper les concurrents (Asana, Monday, Trello) → "Asana personnalisé"
- **Quoi :** Aramis veut enrichir Brief avec des fonctionnalités inspirées
  des outils de gestion de projet (cards style Trello, vues multiples,
  fonctions de projet). Démarche : scraper tous les sites concurrents,
  analyser ce qu'ils proposent, adapter à Brief.
- **Demandé le :** 2026-08-23 par Aramis
- **Effort :** XL (recherche + design + dev) · **Priorité :** P2, à lancer
  après stabilisation de la V1 desktop

### Workflow Conversationnel Telegram ↔ Hermes ↔ Brief
- Consultation des tâches en langage naturel (synthèse ultra lisible, priorités, deadlines).
- Actions directes depuis Telegram : cocher/valider une tâche ("la 1 est faite"), reporter/décaler une date, ajouter une tâche sur un projet ("sur Trezo", "sur Frip & Trend").
- Intégration directe VPS via les endpoints API de Brief.

### Évolutions n8n & Automatisations
- Digest du matin (8h30) amélioré avec gestion d'erreurs (alertes en cas de fail).
- Automatisation du bilan du soir (récap à 19h30 des tâches faites vs reportées).
- Webhook d'ingestion rapide (transférer un message Telegram ou un vocal pour créer une tâche).

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

### Comprendre le mécanisme exact de la dérive DTSTART du 2026-08-19
- **Quoi :** l'item récurrent « Aller courir » a vu son DTSTART calendrier
  passer du mercredi 19 au samedi 22 en moins de 30h après sa création, alors
  que la suite de tests EXISTANTE (`caldav.test.ts`, avant le fix du 19/08)
  affirme que ce scénario précis (`due` avancé, calendrier non rattrapé) doit
  produire un `skip` — donc aucun PUT. Non reproduit, non expliqué : les logs
  Docker ne remontaient qu'au dernier redéploiement du jour, tout l'historique
  antérieur est perdu.
- **Ce que la session du 19/08 (soir) a établi, sans répondre à cette
  question précise :** le même soir, trois items migrés (dont « Aller
  courir ») ont montré un symptôme DE LA MÊME FAMILLE — `due` affiché/sonné
  pour une occurrence antérieure à `seriesAnchor`, donc impossible sur le
  vrai calendrier. Root cause identifiée pour CE symptôme : la migration
  avait figé `seriesAnchor` à une valeur déjà en avance sur le rattrapage
  jour-par-jour de `due` en cours. Corrigé structurellement
  (`pendingReminders`, compartiment `beforeAnchor`, voir `DECISIONS.md`) —
  **toute occurrence antérieure à l'ancre est désormais rattrapée
  silencieusement, quelle qu'en soit la cause.** Ça ferme la classe de bug,
  pas la question d'origine : le POURQUOI du saut initial mercredi→samedi en
  moins de 30h reste non expliqué.
- **Pourquoi ce n'est plus bloquant du tout, même en cas de récidive :** le
  fix `beforeAnchor` intercepte structurellement toute occurrence antérieure
  à `seriesAnchor`, peu importe comment `due` en est venu à dériver derrière
  l'ancre — il n'y a plus besoin de connaître la cause pour empêcher le
  symptôme (faux rappel, mauvaise tâche affichée).
- **Pourquoi le garder en tête quand même :** un due qui dérive DEVANT
  l'ancre (pas derrière) ne serait pas intercepté par ce fix — signe possible
  d'un chemin d'écriture CalDAV encore différent. Voir la passation
  « Calendrier intouché + fin des occurrences fantômes » et « DTSTART mobile
  des séries récurrentes corrigé » dans `docs/handoffs/` pour la trace
  complète des deux investigations.
- **Effort :** S (CC), si ça se reproduit avec des logs disponibles cette
  fois · **Priorité :** P3 (déclassé — le symptôme concret est structurellement fermé)
- **Dépend de :** une récidive DEVANT l'ancre observée, logs à l'appui.

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

- **Le drag & drop du Kanban n'a jamais été vérifié à l'exécution.** Tout le
  reste du Kanban l'a été le 2026-08-24 après-midi (colonnes créées, renommées,
  supprimées ; carte placée en colonne et persistée ; filtres ; « Non placées »),
  mais le glisser-déposer `@dnd-kit` ne se simule pas fidèlement en automatisation.
  **À tester à la main**, c'est le seul geste du Kanban dont personne ne sait
  s'il marche.
- **`DesktopTaskDetail.tsx` portait 3 erreurs eslint** — **corrigées le 24/08
  soir par Hermes** (apostrophes + `preserve-manual-memoization`). Le lint
  global est désormais **0 erreur** (30 warnings d'imports morts, antérieurs,
  inoffensifs).
- `src/app/favicon.ico` date de l'ancienne identité — à régénérer depuis la capsule.
- `docs/designs/preview-systeme.html` montre encore cinq teintes et aucune forme.
- `docs/designs/organiseur-autonome.md` décrit l'architecture CalDAV abandonnée.
- L'écran Vision n'a pas d'état distinct pour « une seule journée chargée » : le
  bloc « ton mur » énonce alors une évidence.
- `.env.local` contient encore un `TODOIST_API_TOKEN` vivant sur une variable que
  plus aucun code ne lit. À révoquer chez Todoist, pas seulement à supprimer.

## Retiré — ne pas réintroduire

Ces éléments dépendaient d'un noyau CalDAV générique, abandonné : **cible
CalDAV générique** (Nextcloud, Fastmail) — la synchro du 17/08 vise iCloud
Apple uniquement, par décision — et **sous-tâches par `RELATED-TO`**, dont
l'intention survit sous une autre forme ci-dessus.
