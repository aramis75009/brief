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

## P0 — Bloquant : rien ne marche sans ça

### Prouver que le Web Push arrive sur un iPhone verrouillé
- **Quoi :** un rappel programmé qui sonne réellement, téléphone verrouillé, app fermée.
- **Pourquoi :** c'est **le risque numéro un du produit**. Toute la promesse des
  rappels repose là-dessus, et seuls les chemins d'ÉCHEC ont été vérifiés en
  conditions réelles. Le succès n'est couvert que par des tests unitaires.
- **Contexte :** iOS ne donne aucune API de notification programmée à une PWA —
  ni Notification Triggers, ni Background Sync, ni Periodic Background Sync, ni
  Background Fetch. D'où le serveur qui possède l'horloge. Exige une PWA
  installée depuis l'écran d'accueil (iOS 16.4+) et un abonnement push valide.
- **Si ça échoue :** le produit n'a plus de raison d'être sous cette forme. À
  faire AVANT toute autre fonctionnalité.
- **Effort :** S (humain) → S (CC) · **Priorité :** P0
- **Dépend de :** VPS en ligne, clés VAPID posées.

### Déployer sur le VPS avec un vrai domaine et TLS
- **Quoi :** `docker compose up`, domaine, certificat, sauvegardes vérifiées.
- **Pourquoi :** sur Vercel le disque est en lecture seule, donc `POST /api/items`
  échoue : on peut dicter, structurer, relire, et rien ne se sauvegarde.
- **Piège :** `getUserMedia` exige un **contexte sécurisé**. Servi en `http://`
  sur une IP nue, le micro ne fonctionnera pas du tout, l'API n'existera même
  pas. Il faut un domaine et un certificat réel (Caddy le fait seul).
- **Contexte :** `BRIEF_DATA_DIR=/app/data`, qui est le point de montage du volume
  `brief-data` — jamais `/tmp`, qui s'efface. Le conteneur `cron` appelle
  `/api/cron/reminders` toutes les 60 s avec `BRIEF_CRON_TOKEN`. Vérifier que
  `deploy/backup.sh` tourne ET qu'une restauration fonctionne : une sauvegarde
  jamais restaurée n'est pas une sauvegarde.
- **Effort :** M (humain) → S (CC) · **Priorité :** P0
- **Dépend de :** VPS Hostinger actif.

### Variables d'environnement absentes en production
- **Quoi :** `BRIEF_DATA_DIR`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
  `BRIEF_CRON_TOKEN`, `BRIEF_CAPTURE_TOKEN`.
- **Pourquoi :** constaté le 2026-08-11 sur Vercel — `BRIEF_DATA_DIR` n'est posé
  que sur Preview, les clés VAPID manquent en Production, `BRIEF_CAPTURE_TOKEN`
  n'existe nulle part et `/api/capture` répond donc 503.
- **Contexte :** `NEXT_PUBLIC_*` doit être **non-sensitive**, sinon Vercel ne
  l'expose pas au build et la valeur est inlinée à `undefined`.
- **Effort :** S (humain) → S (CC) · **Priorité :** P0
- **Dépend de :** cible d'hébergement arrêtée.

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
