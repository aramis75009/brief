# DECISIONS.md — le journal des décisions de Brief

**Ce fichier est le registre permanent des choix critiques et irréversibles
d'Aramis.** Une fois écrite ici, une décision ne se re-débat pas : elle
s'applique, ou elle est explicitement renversée par une nouvelle entrée plus
récente qui l'archive.

Chaque entrée a son POURQUOI. Sans le pourquoi, la prochaine session la
re-débat — c'est le premier réflexe à tuer.

> Règle de lecture obligatoire pour tout agent : **lire `DECISIONS.md` en
> entier avant d'agir**, en plus de `HANDOFF.md`. Les entrées les plus récentes
> sont en haut.

---

## 2026-08-20 · L'ancien DESIGN.md est supprimé — le design system Claude Design v1 est LA source de vérité visuelle

**Décision.** `DESIGN.md` (racine du repo) est **supprimé** et ne doit plus
jamais être suivi ni cité. La source de vérité visuelle est le **design system
Claude Design v1 (iOS)** : `/opt/data/brief-design-claude/Brief Design
System.dc.html`, implémenté à l'identique dans `src/app/globals.css` +
`src/components/`. Les références à `DESIGN.md` ont été retirées de
`AGENTS.md` et `CLAUDE.md`.

**Pourquoi.** DESIGN.md décrivait l'ancien système (General Sans + corail
`#EC5230` + 8 teintes × 5 formes), écrit le 09/08 par `/design-consultation` —
**avant** que Claude Design ne conçoive le design system v1 (18/08, Plus
Jakarta + ink + task/meet/idea), qui l'a remplacé et a été reconstruit et
déployé en prod. Le fichier n'a jamais été mis à jour : il contredisait la
spec v1 ET la prod. Conséquence concrète le 20/08 : Claude Design a détecté le
conflit (General Sans vs Plus Jakarta, corail vs ink) et a failli construire
ses maquettes profil/urgence sur les mauvais tokens ; son audit de la veille
accusait même `PinGate.tsx` de tokens « legacy » alors que l'écran suivait la
spec v1. Aramis : « je veux pas du tout qu'il suive le design.md de l'ancienne
version... Celle-là faut vraiment plus en parler. » Un fichier mort dans le
repo est un piège permanent pour tous les agents (Claude Code, Hermes, Codex).

**Comment.** `git rm DESIGN.md` ; `AGENTS.md` : ligne retirée du tableau des
fichiers, note « design system Claude Design v1 = source de vérité, ancien
DESIGN.md supprimé le 20/08 » ajoutée ; `CLAUDE.md` : section « Système de
design » réécrite sur la même base. Les handoffs passés (avant le 20/08) qui
citent DESIGN.md restent des archives — ne pas les ressusciter.

**Statut.** ✅ Fait — commit `…`, poussé le 2026-08-20.

---

## 2026-08-20 · Les occurrences décalées d'une série dans Calendrier sont adoptées (RECURRENCE-ID)

**Décision.** Quand Aramis décale UNE occurrence d'une série récurrente dans
l'app Calendrier (ex. Séance push du jeudi 16h→17h, Poster/Reposter 10
18h→19h), Brief **adopte le décalage** : l'occurrence s'affiche à sa nouvelle
heure dans l'accueil et l'agenda, le rappel sonne à la nouvelle heure, et le
prochain PUT de Brief **réécrit l'override** dans l'ICS au lieu de l'écraser.
Même règle pour les occurrences supprimées (EXDATE) : déjà adoptées depuis le
18/08, elles sont désormais aussi **appliquées à l'affichage et aux rappels**
(avant, seule la réécriture ICS les protégeait).

**Pourquoi.** Constaté en prod le 2026-08-20 : iCloud écrit un VEVENT override
avec `RECURRENCE-ID` dans le même ICS que le master quand on déplace une
occurrence. `parseRemoteEvent` ne lisait que le premier VEVENT (le master) →
Brief voyait la série « identique » → `skip` → l'édition n'était jamais
adoptée, l'agenda affichait l'ancienne heure, les rappels sonnaient à
l'ancienne heure, et un PUT réécrivait l'ICS SANS les overrides (perte
définitive des décalages d'Aramis). Le calendrier est la source de vérité
(décision 18/08) : il doit gagner **par occurrence**, pas seulement pour le
master.

**Comment.** Nouveau champ `Item.overrides` (`RECURRENCE-ID` → nouveau DTSTART,
UTC RFC 5545), adopté par `calendarPatch`/`decideExternalSync` et réécrit par
`buildEventIcs` (un VEVENT override par occurrence décalée). Fonctions pures
(`applyOverride`, `icalUtc`, `remoteDueToItem`) extraites dans
`src/lib/overrides.ts` — partageables avec le client (HomeScreen) sans
importer `caldav.ts` (server-only). Appliqué à : `buildDayAgenda` (accueil +
Rendez-vous), `pendingReminders`/`payloadFor`/avancement des séries
(`reminders.ts`), `sanitizePatch` (PATCH `/api/items/[id]`). L'avancement des
séries part désormais de `seriesAnchor` (l'ancre stable), pas de `due` qui
peut être décalé par un override.

**Statut.** ✅ Fait — commit `c0d0c23`, déployé en prod le 2026-08-20 (vérifié : overrides adoptés dans items.json, ICS iCloud intacts).

---

## 2026-08-19 (soir) · Le calendrier Apple reste intouché — Brief n'y supprime plus jamais rien

**Décision.** Brief peut AJOUTER et METTRE À JOUR des événements dans le
calendrier Apple, **jamais en SUPPRIMER un**, quelle qu'en soit la raison.
**Renverse la partie suppression** de l'entrée « Calendrier Apple → Brief :
adoption totale » du 2026-08-19 (« cocher l'item dans Brief supprime
l'événement original ») — le reste de cette entrée (adoption totale sans tri
bruit/signal) tient toujours, seule la conséquence "coché ⇒ delete" saute.

**Pourquoi.** Aramis, le soir même : « je veux toujours que le calendrier
reste intouché » — exemple donné, terminer « Learn CSS rush demain » dans
Brief ne doit pas supprimer l'événement correspondant dans Calendrier. Preuve
trouvée en investiguant : l'item adopté « Aller courir » (calendrier Sport,
`externalUid` 30DC2273…) a été coché dans Brief ce soir (`doneAt` posé) — sous
l'ancien comportement, le prochain passage CalDAV allait supprimer
l'événement réel qu'Aramis a lui-même posé dans son app Calendrier. C'est
l'incident concret qui a motivé le renversement, pas une préférence abstraite.

**Comment.** `src/lib/caldav.ts` : les trois chemins de suppression sont
coupés — Phase 1 (nettoyage des `brief-*` orphelins), Phase 3 pour un item
adopté coché (`decideExternalSync`, `existing.doneAt` → `noop` au lieu de
`delete-remote`), Phase 3 pour un UID tombstoné (idem, `noop` au lieu de
`delete-remote` — le tombstone empêche toujours la ré-adoption comme nouvel
item, il n'entraîne simplement plus de suppression distante). Le type
`"delete-remote"` et la fonction `deleteEvent` sont retirés : plus aucun
appelant.

**Compromis accepté, pas caché.** Un item dont le PROJET change échoue
désormais son PUT vers le nouveau calendrier (iCloud renvoie 412, le même UID
existant encore dans l'ancien) au lieu d'être proprement déplacé — visible
sous son ancien calendrier jusqu'à résolution manuelle. Piste pour une
session future : la méthode CalDAV `MOVE` relocalise un événement sans jamais
le supprimer ; pas implémentée cette session, hors périmètre de l'urgence du
soir.

**Statut.** ✅ Implémenté, testé (`caldav.test.ts` — les deux tests qui
attendaient `delete-remote` attendent désormais `noop`).

---

## 2026-08-19 (soir) · Une occurrence antérieure à `seriesAnchor` ne sonne jamais

**Décision.** Le planificateur de rappels (`src/lib/reminders.ts`) ne notifie
et n'affiche plus jamais une échéance `due` antérieure au `seriesAnchor` de
son item — elle est rattrapée silencieusement à l'ancre, sans notification,
dès le passage suivant (≤ 60 s).

**Pourquoi.** Aramis, au réveil (enfin, en soirée) : « le premier truc que
j'ouvre sur l'app, c'est des mauvaises tâches, contrairement à mon
calendrier. » Root cause confirmée sur `items.json` de PROD : trois items
récurrents migrés lors de la session précédente (fix DTSTART,
`Item.seriesAnchor`) avaient un `due` qui traînait encore quelques jours en
arrière de leur ancre fraîchement figée. Par construction RFC 5545, aucune
occurrence n'existe avant DTSTART — ces occurrences « d'aujourd'hui »
n'avaient donc jamais existé sur le vrai calendrier iCloud (confirmé
visuellement : la capture macOS d'Aramis ne montre rien pour elles sous le
jour affiché par Brief). Brief a quand même sonné et affiché pour elles,
jusqu'à ce qu'un rattrapage jour par jour (plusieurs heures, plusieurs faux
rappels) finisse par les recaler tout seul.

**Comment.** `pendingReminders` renvoie un troisième compartiment
`beforeAnchor` (échéance `< seriesAnchor`) : ni `ready` (pas de push), ni
`stale` (pas juste ignorée) — `runReminders` réécrit directement `due =
seriesAnchor` pour ces items, sans poser `remindedAt` puisque rien n'a été
envoyé. Nouveau champ `ReminderRun.correctedToAnchor`, journalisé dans les
logs du cron.

**Statut.** ✅ Implémenté, testé (`reminders.test.ts`, 3 tests neufs).

---

## 2026-08-19 · Calendrier Apple → Brief : adoption totale, sans tri bruit/signal

**Décision.** Tout événement posé directement dans l'app Calendrier, dans un
des 6 calendriers que Brief connaît (Personnel, Sport, Vinted Frip&Trend, My
Flip, Web@académie, IA), devient une **vraie tâche Brief** au prochain sync —
rappel Web Push, coche, sous-tâches possibles. Aucun tri automatique par
calendrier, par forme (journée entière ou non) ou par contenu : « adopte tout,
on verra à l'usage » (Aramis).

**Pourquoi.** En construisant la vue Rendez-vous, la proposition initiale était
d'exclure le calendrier « Personnel » (jugé « bruit » — ex. « Rentre Jeanne »).
Aramis a corrigé : « c'est dangereux ce que tu dis » — il y range aussi de
vraies tâches importantes (ex. « Relancer Revolut pour le remboursement de
1000€ »). Rien ne distingue programmatiquement les deux dans un même
calendrier : même forme, souvent journée entière. Le risque d'un faux négatif
(rater une vraie tâche) est pire que celui d'un faux positif (une tâche
ignorable de plus à cocher ou supprimer).

**Comment.** `src/lib/caldav.ts` : `decideExternalSync` (nouvelle Phase 3 de
`runCalDavSync`) — événement sans item lié → `create` ; item adopté actif dont
l'événement diffère → `update` (le calendrier gagne toujours, pas
d'avancement interne à distinguer comme pour un item `brief-*`) ; événement
disparu → item marqué terminé (jamais recréé) ; item coché dans Brief →
événement supprimé du calendrier. `Item.externalUid`/`externalCalendar`
marquent un item adopté ; `buildEventIcs` l'exclut du PUT `brief-<id>` (il vit
déjà sous son UID d'origine, un second PUT dupliquerait l'événement).
`src/lib/agenda.ts` déduplique par `externalUid` en plus de `brief-<id>`.

**Statut.** ✅ Implémenté, testé (`caldav.test.ts`, `agenda.test.ts`). Premier
passage réel en prod : ~6 événements existants (Rentre Jeanne, Terminé Learn
CSS, Réveil, Ranger appartement, deux séances sport historiques) seront
adoptés comme tâches — attendu, pas un bug.

---

## 2026-08-19 · Coordination multi-agents — GitHub est la vérité centrale

**Décision.** Brief est désormais travaillé par **plusieurs agents en
parallèle** : Claude Code (sur le Mac d'Aramis) et Hermes Agent (sur le VPS,
copie `/opt/data/Projets/brief`). Règles :

1. **GitHub (`aramis75009/brief`) est la vérité centrale.** Les copies du dépôt
   (Mac, VPS Hermes, VPS prod `/docker/brief`) ne s'alignent QUE par
   fetch/pull/push. Jamais de copie de fichiers entre dossiers.
2. **Un agent = une branche de travail à la fois.** Pousser directement sur la
   branche de prod en parallèle est interdit sans passation explicite dans
   `HANDOFF.md`.
3. **Avant toute session** : `git fetch origin --prune` + lire `HANDOFF.md` +
   lancer `bash scripts/coord/status.sh` (compare les copies). Si la prod a
   avancé, fast-forward avant de coder.
4. **Avant tout push** : `bash scripts/coord/pre-push.sh` (vérifie branche de
   prod, retard sur origin, HANDOFF.md présent).

**Pourquoi.** Le 2026-08-19, un bug de cache PWA iOS (« This page couldn't
load ») a été corrigé par Claude Code (commit `c8c175c`) **une minute après**
qu'Hermes l'ait diagnostiqué — preuve que deux agents travaillaient en
parallèle sans coordination. Aussi : `HERMES.md` et `AGENTS.md` disaient encore
que la prod tourne sur `feat/task-completion` alors qu'elle est sur
`feat/ui-redesign-claude` depuis le 19/08 — des docs périmées font travailler
les agents sur la mauvaise branche.

**Comment.** Fichiers livrés sur la branche `feat/agent-multi-coordination` :
`docs/coordination.md`, `scripts/coord/status.sh`, `scripts/coord/pre-push.sh`,
`HANDOFF.md` restauré à la racine, `AGENTS.md` corrigé.

**Statut.** ✅ Fait (PR en attente de merge).

---

## 2026-08-19 · Une date invalide ne doit jamais faire planter l'app — normaliser à la source

**Décision.** Toute date issue d'une source externe (CalDAV, API, saisie) doit
être **normalisée en ISO avant stockage** dans `due`. Si une conversion échoue,
écrire `undefined` (« pas d'échéance ») — jamais une chaîne brute non-parseable.
En plus de la cause, deux garde-fous : `zonedParts()` ne lève plus jamais de
RangeError (date invalide → valeur sentinelle), et `readItems()` normalise à la
lecture (répare en mémoire sans réécrire le fichier).

**Pourquoi.** Le 2026-08-19, un seul item (`it_msurvw97_6`, récurrence Frip &
Trend) avec `due = "20260820T140000"` — un DTSTART ICS flottant (sans `Z` ni
tirets) renvoyé brut par `remoteDueToItem()` — a fait planter **toute l'app**
dans tous les navigateurs : `new Date()` ne parse pas ce format → Invalid Date
→ `Intl.DateTimeFormat.formatToParts()` → RangeError → React ne montait plus.
Le serveur répondait 200 partout (curl OK) : le crash était côté client,
invisible pour les sondes réseau. Un rappel absent se voit ; un crash ne se
voit pas.

**Comment.** Commit `aacea8e` (merge `4a1ad33` dans la prod) : `caldav.ts`
(`remoteDueToItem()` convertit `YYYYMMDDTHHMMSS` → ISO Europe/Paris), `zoned.ts`
(garde-fou), `store.ts` (normalisation à la lecture). Tests : 128/128.

**Statut.** ✅ Implémenté, déployé, vérifié en prod (0 item `due` non-ISO).

---

## 2026-08-18 · Le cookie PIN est posé par le serveur (Set-Cookie), pas par JavaScript

**Décision.** Le cookie persistant `brief_pin` est posé **côté serveur** par
`POST /api/session` (Set-Cookie HTTP, Max-Age ~13 mois, SameSite=Lax,
Secure en HTTPS) à chaque vérification réussie du PIN. Le client garde
localStorage + cookie JS (migration, fallback), mais le cookie serveur est la
source fiable de mémorisation.

**Pourquoi.** Le 18/08 au soir, après le correctif « cookie + localStorage »,
l'écran PIN réapparaissait **à chaque fermeture/relance** de la PWA sur
l'iPhone. Cause : sur iOS, les cookies posés par JavaScript
(`document.cookie`) dans une PWA standalone peuvent être purgés à la fermeture
de l'app — alors qu'un cookie posé par `Set-Cookie` HTTP persiste. Le serveur
ne posait aucun cookie (`/api/session` renvoyait juste `{ok:true}`).

**Comment.** `src/app/api/session/route.ts` : Set-Cookie `brief_pin` à chaque
vérification réussie (le PIN est lu depuis `BRIEF_PIN`, jamais affiché).
`src/lib/pin.ts` : `clearCookie` efface avec l'attribut `Secure` correspondant
(un cookie Secure ne peut être effacé que par un Set-Cookie Secure — sinon
« Verrouiller » ne déverrouillerait pas). Vérifié en prod : POST /api/session
200 → `set-cookie: brief_pin=…; Secure`, 401 → pas de cookie. Commits
`e2868c5` + `cb8c2c7`, déployés le 18/08.

**Statut.** ✅ Fait.

---

## 2026-08-18 · Les suppressions d'occurrences du calendrier sont adoptées (EXDATE)

**Décision.** Quand Aramis supprime une occurrence d'une série récurrente dans
l'app Calendrier, Brief **adopte** la suppression (champ `exdates` sur l'item,
écrit en `EXDATE` dans l'ICS) au lieu de la réécrire. Et l'ancre `DTSTART`
d'une série n'est **plus réadoptée** : `due` est l'occurrence courante
(avancée par le cron), DTSTART reste l'ancre d'origine.

**Pourquoi.** Le 18/08 au soir, Aramis a supprimé les occurrences du 17/08 de
« Poster 10 articles » (17:30) et « Reposter 10 articles » (18:00) dans l'app
Calendrier — elles sont réapparues dans Brief. Deux bugs dans le chemin
calendrier → Brief : (1) `parseRemoteEvent` ignorait les `EXDATE` du master
→ le sync ne voyait aucune différence et son PUT **écrasait la suppression** ;
(2) le sync réadoptait l'ancre DTSTART à chaque passage → l'avancement des
séries par le cron était annulé et les tâches restaient bloquées sur « hier ».

**Comment.** `src/lib/caldav.ts` : `parseRemoteEvent` lit les EXDATE (lignes
pliées comprises) ; `remoteDiffers`/`calendarPatch` comparent/adoptent
`exdates` ; `buildEventIcs` écrit `EXDATE` ; l'ancre DTSTART n'est comparée
que si l'item n'a pas de récurrence. `src/lib/types.ts` : champ `exdates`.
Route PATCH : accepte `exdates` (absent = ne pas toucher). 4 tests ajoutés.
Commits `d5b6430` + `6172bcd` + `0be8a13`, déployés le 18/08. Données
réparées : EXDATE réappliqués sur iCloud (PUT 204), items avancés au 19/08,
convergence `adopted=0` vérifiée.

**Statut.** ✅ Fait.

---

## 2026-08-18 · Le PIN mémorisé survit aux purges iOS (cookie + localStorage)

**Décision.** Le PIN saisi une fois par appareil est mémorisé dans **deux**
endroits : le `localStorage` de la PWA **et** un cookie persistant
(`brief_pin`, ~13 mois, renouvelé à chaque connexion). « Verrouiller » efface
les deux.

**Pourquoi.** Le 18/08 au soir, l'écran PIN est réapparu sur l'iPhone d'Aramis
sans raison apparente : le code de mémorisation (`f2ad5e4`) était déployé, le
PIN serveur n'avait pas changé, l'API répondait correctement. Cause : iOS purge
le stockage des PWA inutilisées — le `localStorage` peut disparaître et
l'écran PIN réapparaître. Le cookie persistant survit à cette purge et est
partagé entre la PWA et Safari (qui ont des `localStorage` séparés). Le PIN
reste en clair dans les deux : c'est de l'UX, pas une barrière de sécurité
(la seule barrière reste `guard.ts` côté serveur).

**Comment.** `src/lib/pin.ts` : `setPin` écrit localStorage + cookie ;
`getPin` lit le cookie en priorité et **migre** un PIN resté dans le
localStorage vers le cookie ; `clearPin` efface les deux. 6 tests unitaires
(`pin.test.ts`). Commit `3e72fbe`, déployé en prod le 18/08 (bundle vérifié).

**Statut.** ✅ Fait.

---

## 2026-08-18 · Les récurrences de publication Frip & Trend sont bornées — pas d'infini

**Décision.** Les récurrences hebdomadaires de publication (Poster/Reposter 10/15/20
articles) s'arrêtent à la fin du mois d'août (`UNTIL=20260831T235959Z`). Elles ne
tournent pas à l'infini.

**Pourquoi.** Aramis : « sinon ça continue jusqu'à l'infini et c'est très emmerdant ».
Le rythme de publication suit le mois en cours ; une récurrence infinie pollue le
calendrier après la fin du mois. Règle de fond pour les prochaines sessions : toute
récurrence de publication créée est **bornée** (fin de mois ou date explicite).

**Comment.** Modifié directement dans iCloud (source de vérité) : `UNTIL` ajouté sur
`brief-it_1787066667909_reposter15` (Reposter 15), `brief-it_1787066667912_poster20`
(Poster 20) et l'événement manuel `1B3A002E` (Reposter 10, recréé à la main par
Aramis après suppression). Synchro forcée → Brief a adopté (`adopted=3`). Vérifié des
deux côtés (items.json prod + relu iCloud brute). Les one-shots manuels des 17→27/08
et les récurrences sport (infini, voulu) ne sont pas touchés.

**Statut.** ✅ Fait.

---

## 2026-08-18 · Le calendrier Apple est la source de vérité des horaires (bidirectionnel)

**Décision.** Le sens de la synchro CalDAV devient **bidirectionnel avec
prééminence du calendrier** : toute édition faite **directement dans l'app
Calendrier** (horaire, titre, récurrence) **écrase** la valeur de Brief, et
**Brief adopte** la version du calendrier. Brief continue par ailleurs d'ajouter
de nouvelles tâches au calendrier (capture vocale / API / Telegram).

**Pourquoi.** Aramis, en cours de journée, ajuste ses tâches en direct dans
Apple Calendar (« je cale sur ce que je fais actuellement, je décale à plus
tard »). Sous l'ancien one-way Brief → Apple, la synchro réécrivait à chaque
passage la version de Brief et **écrasait ses modifications manuelles**.
C'est Aramis qui agit dans le calendrier : ce qu'il y pose doit gagner, pas
être effacé par la machine.

**Comment.** Dans `runCalDavSync` (phase 2), avant d'écrire un `brief-*`, on lit
l'événement déjà présent dans le calendrier cible : s'il diffère de ce que Brief
générerait (heure / titre / récurrence), on **adopte** ses champs dans l'item
Brief (`patchItem`) puis on réécrit la version canonique — ça converge sans
osciller. Créations et tâches faites continuent de se refléter au calendrier.

**Statut.** ✅ acté puis **implémenté + déployé**, vérifié par un test réel
(édition d'un horaire dans iCloud → item Brief mis à jour au passage suivant).

---

## 2026-08-18 · CalDAV : un calendrier Apple par projet — chaque couleur identifie un domaine

**Décision.** La synchro Brief → Apple ne va plus tout écrire dans « Personnel »
(`home/`) : chaque projet Brief est routé vers **son propre calendrier iCloud**,
dont la couleur distingue immédiatement le domaine d'activité dans l'app
Calendrier.

**Pourquoi.** Aramis, en regardant sa semaine : « toutes les tâches sont de la
même couleur donc je n'arrive pas à séparer ce que j'ai à faire ». Le mapping
utilise ses calendriers existants quand ils existent, et en crée de nouveaux
sinon — l'app Calendrier devient un tableau de bord visuel par activité.

**Mapping (décision Aramis du 18/08, ajusté le 18/08 au soir).**
| Projet Brief | Calendrier Apple | Statut |
|---|---|---|
| Frip & Trend | « Vinted Frip&Trend » | existant |
| My Flip | « My Flip » | **créé** (orange) |
| Perso | « Personnel » | existant (défaut) |
| Sport | « Sport » | existant |
| Web@académie | « Web@académie » | **créé** (rouge) — remplace l'usage de « Travail » |
| IA | « IA » | **créé** (vert) |
| (autre / inconnu) | « Personnel » | fallback |

**Ajustement My Flip / Dropshipping.** Le mapping initial réutilisait le
calendrier « Dropshipping » (vestige de l'ancien projet). Aramis a supprimé le
projet Dropshipping (« le projet n'est plus d'actualité ») : My Flip reçoit
donc **son propre calendrier « My Flip »** (créé par MKCOL). Le calendrier
iCloud « Dropshipping » n'est plus utilisé par Brief (reste en orphelin sur le
compte, suppression proposée mais non demandée).

**Comment.** `calendarForProject(projectId)` dans `src/lib/caldav.ts` (table
par défaut, surchargeable par `BRIEF_CALDAV_MAPPING` JSON). `runCalDavSync`
découvre la liste des calendriers du compte une fois par passage
(`discoverCalendars`) puis groupe les items par calendrier cible avant les
PUT/DELETE. Un item qui change de projet est supprimé de l'ancien calendrier et
écrit dans le nouveau au passage suivant (idempotence UID `brief-<id>` conservée
par calendrier). L'heure exacte des calendriers créés : MKCOL avec
`displayname` + `calendar-color`.

**Statut.** ✅ Implémenté, tests 106/106, **déployé en prod et vérifié par relu
iCloud indépendante** (événements `brief-*` présents dans chaque calendrier de
projet, aucun résidu dans « Personnel », tâches cochées retirées).

---

## 2026-08-17 · Le PIN devient « une fois par appareil » — zéro friction à l'ouverture

**Décision.** Le code PIN n'est plus demandé à chaque ouverture. L'app le
mémorise une seule fois par appareil (première ouverture), stocké en
`localStorage`, puis Brief s'ouvre **directement** — comme Notion, comme Asana.

**Pourquoi.** Le pavé à chaque session était une friction permanente contre
l'essence du produit (« tu ouvres et c'est là »), et un code mal codé qui
plante l'ouverture. Aramis : « c'est juste une app comme Asana, tu l'ouvres
rapidement, y a pas besoin de code. » Mais la sécurité, elle, **reste
obligatoire** : un appareil inconnu sans le code est toujours refusé.

**Comment.** Côté client uniquement : `sessionStorage` → `localStorage` dans
`src/lib/pin.ts`. **Le serveur ne change pas** : `requirePin` / `x-brief-pin` /
`BRIEF_PIN` restent la seule barrière. En cas de 401 (code serveur changé),
l'appareil re-demande naturellement le code. Transition : la première ouverture
après déploiement redemande le code une dernière fois (l'ancien code était en
sessionStorage, vidé).

**Statut.** ✅ Implémenté, branché `feat/remember-device-pin`, commit `f2ad5e4`.
Validation : eslint ✓, tsc ✓, vitest 94/94 ✓. Pas encore déployé.

---

## 2026-08-17 · CalDAV Apple réactivé — synchro Brief → calendrier Apple **obligatoire**

**Décision.** La connexion CalDAV Apple s'installe : tous les matins et tous
les soirs, le calendrier Apple d'Aramis reflète ses tâches notées dans Brief.
**Renverse** l'invariant du 2026-08-14 qui écartait CalDAV (« ne revient pas
sans nouvelle décision » — cette entrée EST cette nouvelle décision).

**Pourquoi.** Le calendrier Apple est « très important, qui change tout ». Les
tâches captées dans Brief doivent se retrouver sur le calendrier pour les
rituels matin/soir. La contrainte qui avait fait écarter CalDAV (pas de push
APNs pour un compte CalDAV tiers sur iOS → plancher de synchro ~15 min) **est
acceptée** : 15 minutes de latence ne gênent pas un gros résumé — ce n'est pas
du rappel à court terme, qui reste en Web Push dans Brief.

**Périmètre.**
- Sens : **Brief → Apple seulement** pour commencer (l'aller-retour sera
  décidé plus tard).
- Latence : ~15 min acceptée, rythme à définir (proposition : matin + soir,
  ou toutes les 15 min — les rappels courts restent dans Brief en Web Push).
- Le calendrier Apple devient un **réplicat de lecture périodique** de
  l'organisation Brief, pas une source de vérité. `brief-data` reste l'unique
  copie de l'organisation.

**À faire.** Identifiants iCloud (Apple ID + mot de passe d'application,
jamais le mot de passe Apple) → module CalDAV côté serveur → écriture des
items datés en VEVENT/VTODO dans un calendrier iCloud dédié → hook dans le
conteneur cron existant.

**Statut.** ✅ Implémenté (branche `feat/caldav-sync`) : module `src/lib/caldav.ts`
+ route `/api/cron/caldav-sync` (jeton `BRIEF_CALDAV_TOKEN`, garde-fou 15 min).
Connexion iCloud testée en réel (découverte + lecture, puis PUT/DELETE curl
201/204). Suite : 104/104 ✓. Déploiement du cron sur le VPS à faire.

---

## 2026-08-16 · Modèle produit v2 validé ; peau v2/v3 rejetées → refonte Claude Design

**Décision.** Le modèle produit (accueil = la réponse « Maintenant / Ensuite /
Rendez-vous / En retard / Plus tard », capture = geste depuis n'importe où,
triage à friction proportionnelle à la confiance, plan du jour minimal, nav
3 entrées + micro central, fiche avec provenance, recherche sur notes brutes)
est **validé**. La disposition mobile aussi.

**Pourquoi.** L'audit du 16/08 a montré que le produit était centré sur le
mauvais objet (formulaire de capture au lieu de la réponse). Le nouveau modèle
est approuvé par Aramis ; le copywriting et le design des previews v2/v3 sont
rejetés — la peau repart avec Claude Design.

**Statut.** ✅ Modèle acté. Peau en cours (docs/designs/2026-08-16-brief-design-v4.md).

---

## 2026-08-14 · Les règles projet vivent dans `AGENTS.md`, pas dans `CLAUDE.md`

**Décision.** Toute règle transversale est écrite dans `AGENTS.md`, le seul
fichier chargé automatiquement par les trois agents (Claude Code, Hermes,
Codex). `CLAUDE.md` / `HERMES.md` ne contiennent que du spécifique à l'agent.

**Pourquoi.** Une règle écrite une fois s'applique aux trois. Écrite ailleurs,
elle est appliquée par personne.

---

## 2026-08-14 · Le serveur possède l'horloge — tout calcul de date passe par `zoned.ts`

**Décision.** Aucun calcul de date via les méthodes locales de `Date`
(`setHours`, `getDay`, `setDate`, `getMonth`) : elles lisent le fuseau de la
machine et la prod tourne en UTC. Tout passe par `src/lib/zoned.ts`, travail
dans `Europe/Paris`. La suite vitest est forcée en UTC (vitest.config.mts).

**Pourquoi.** Le 2026-08-14, « demain » sonnait à 11 h au lieu de 9 h sur le
VPS : la machine d'Aramis (Paris) voyait 68/68 verts, le conteneur (UTC) 61/68.
Les 7 échecs étaient réels. Le fuseau de la machine n'est pas une opinion, c'est
un bug.

---

## 2026-08-14 · Routes machine = jeton dédié, jamais le PIN

**Décision.** `/api/cron/reminders`, `/api/capture`, `/api/digest` portent un
**jeton machine** (`requireMachineToken`, `BRIEF_CRON_TOKEN` /
`BRIEF_CAPTURE_TOKEN` / `BRIEF_DIGEST_TOKEN`), pas le PIN.

**Pourquoi.** Un secret déposé dans une crontab ou un raccourci iOS ne doit pas
ouvrir la même porte que le code qu'on tape, et doit pouvoir être révoqué seul.
Le PIN ouvre toutes les routes (création, suppression, `/api/transcribe` qui
consomme la clé Groq).

---

## 2026-08-14 · Déploiement : brancher sur `feat/task-completion`, jamais `main`

**Décision.** La production est sur la branche `feat/task-completion`, pas
`main`. Déploiement prod sur accord explicite d'Aramis uniquement ; le volume
`brief-data` (unique copie de l'organisation) ne se touche jamais sans accord.

**Pourquoi.** Le 2026-08-14, Hermes a perdu du temps en supposant que la prod
tournait sur `main`. La prod est ce qui sert Aramis, pas ce qui est le plus
propre dans git.

---

## 2026-08-13 · Pas d'achat de domaine — hostname `*.hstgr.cloud` gratuit

**Décision.** Hostinger fournit un hostname public gratuit
`srvXXXXXX.hstgr.cloud`, avec wildcard : tout sous-domaine résout déjà (A et
AAAA), et `hstgr.cloud` est dans la Public Suffix List. Pas besoin d'acheter un
domaine.

---

## 2026-08-11 · `output: "standalone"` : désactivé sur Vercel, conservé pour le VPS

**Décision.** Deux cibles, deux besoins : Vercel (abandonné depuis) sans
standalone, image VPS avec (`bd9c324`). Une seule configuration ne peut pas
satisfaire les deux.

**Statut.** Vercel abandonné → la prod tourne sur le VPS Hostinger.

---

## 2026-08-10 · Brief possède ses données

**Décision.** Stockage en fichiers JSON, écriture atomique (`temp` + `rename`),
file d'écritures sérialisée (`src/lib/store.ts`, chemin par `BRIEF_DATA_DIR`).
Aucun plafond de projets. Brief n'écrit chez personne.

**Pourquoi.** Le service tiers dont Brief est issu plafonnait à cinq projets et
possédait les données. Posséder ses données, c'est ne plus avoir de plafond ni
de dépendance.

---

## 2026-08-07 · Priorité 1 = la PLUS HAUTE (convention iCalendar)

**Décision.** Une seule échelle de priorité dans tout le code : **1 = la plus
haute**, conformément à RFC 5545. C'est l'inverse de la numérotation Todoist
(4 = urgente), d'où venait le projet.

**Pourquoi.** Une seule échelle = plus de conversion, donc plus de bug
d'inversion. Ne pas réintroduire une seconde échelle sans fonction de
correspondance testée.

---

## 2026-08-06 · Le PIN est vérifié côté serveur, jamais côté client

**Décision.** `src/lib/guard.ts` compare `x-brief-pin` à `process.env.BRIEF_PIN`
en temps constant (`safeEqual`) sur chaque route `/api/*`. L'écran PIN et le
stockage local ne sont que de l'UX, ils ne protègent rien.

**Pourquoi.** L'URL de déploiement est publique ; le guard serveur est la seule
barrière. Même si cette entrée a évolué le 2026-08-17 (mémorisation par
appareil), **le principe serveur reste** : la vérification se fait côté serveur,
jamais côté client.