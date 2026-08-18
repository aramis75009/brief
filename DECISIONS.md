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