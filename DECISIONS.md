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