# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-08-31 (soir) · Le pivot multi-utilisateur n'a jamais été fait, et c'est le prochain chantier

| | |
|---|---|
| **Agent** | **Claude Code (Opus 5)**. Session du 31/08, de la reprise du Kanban jusqu'ici. |
| **GitHub** | `origin/main` = **`cfc129e`** — PR #9, #10, #11, #12 mergées. |
| **Prod** | **`72a7d1db`** — v1.1.0.0, déployée et vérifiée par Hermes. **En retard de `cfc129e`**, écart purement documentaire. |
| **Branche** | Rien en cours. Le chantier ci-dessous n'est pas commencé. |

## Goal

**Rendre Brief réellement multi-utilisateur.** Aramis croyait que c'était fait
en même temps que l'intégration Supabase du 26/08. **Ça ne l'est pas**, et il
l'a découvert le 31/08 au soir en demandant un compte de recette.

Le déclencheur exact : il a demandé la création d'un second compte pour que les
agents puissent recetter les écrans authentifiés. Vérification faite avant
d'exécuter — **ce compte n'aurait pas été un bac à sable, mais une seconde clé
de son Brief réel.**

## Current state

### Ce qui EXISTE — l'authentification, et elle marche

`DECISIONS.md` (2026-08-26) est explicite : l'auth a été faite **« en
préparation au multi-utilisateur (un second utilisateur viendra) »**. Elle est
implémentée, déployée, en production depuis le 26/08 au soir.

- `requireSession()` vérifie un JWT Supabase **localement** (ES256, aucun appel
  réseau par requête). `src/proxy.ts` rafraîchit la session.
- `readSessionClaims()` sait lire le `sub` (identifiant du compte) et l'email.
- Une table Supabase **`authorized_users`** sert de liste blanche à la
  connexion (`src/app/api/auth/login/route.ts`).

### Ce qui N'EXISTE PAS — le cloisonnement des données

**Vérifié fonction par fonction le 31/08.** Aucune ambiguïté :

| Constat | Preuve |
|---|---|
| **Aucune fonction du store ne prend d'identifiant utilisateur** | `readItems()`, `saveItems(items)`, `readProjects()`, `readBoard()`, `readTags()`, `readObjectives()`, `readSettings()` — les 18 exports de `src/lib/store.ts` sont globaux |
| **Le `sub` n'atteint jamais la couche de données** | `readSessionClaims()` n'est appelé qu'à **un seul endroit** : `/api/auth/session`, pour afficher l'adresse mail dans les Réglages |
| **Supabase ne sert qu'à l'authentification** | aucune table de données ; tout est en fichiers JSON sous `BRIEF_DATA_DIR` |
| **Un seul jeu de fichiers pour tout le monde** | `items.json`, `boards.json`, `settings.json`, `push-subscriptions.json`… un exemplaire, pas de partition |

**Conséquence : tous les comptes ouvrent le même Brief.** Un second compte
verrait, modifierait et pourrait supprimer les tâches d'Aramis, et sa synchro
avec son Calendrier Apple.

### Le chiffrage réel du chantier

**Le facile** — 17 fichiers importent `@/lib/store`, ~20 routes le touchent.
C'est mécanique : passer un `userId` partout. Long, pas difficile.

**Le difficile, et c'est là que le chantier se joue** :

1. **⚠️ Les routes cron n'ont AUCUNE session.** `/api/cron/reminders` et
   `/api/cron/caldav-sync` tournent toutes les 60 s sous jeton machine. En
   multi-utilisateur elles doivent **itérer sur tous les utilisateurs**. C'est
   un changement de forme, pas de paramètre.
2. **⚠️ Les identifiants CalDAV sont des variables d'environnement globales.**
   `BRIEF_CALDAV_USER`, `BRIEF_CALDAV_PASSWORD`, `BRIEF_CALDAV_CALENDAR_PATH`
   (`src/lib/caldav.ts:53-56`) — **un seul compte iCloud pour toute l'app**.
   Chaque utilisateur aura les siens : il faut donc **stocker des secrets par
   utilisateur**, chiffrés. C'est le point le plus lourd, et il n'a jamais été
   discuté.
3. **⚠️ Les jetons machine n'ont pas d'identité.** `BRIEF_CAPTURE_TOKEN`,
   `BRIEF_DIGEST_TOKEN`, `BRIEF_CRON_TOKEN` : une capture venue de Telegram ou
   d'un raccourci iOS doit savoir **dans quel Brief elle écrit**.
4. **Les abonnements push sont dans un fichier unique**
   (`push-subscriptions.json`, `src/lib/push-store.ts`).
5. **Migration des données existantes** : l'`items.json` de production doit
   être attribué au compte d'Aramis, sans perte. Il porte des données réelles
   et une synchro CalDAV vivante.

### Le reste de la session du 31/08 — livré et déployé

- **PR #9 — Kanban « copie Trello »** (`v1.1.0.0`). Glisser-déposer complet,
  cartes et colonnes. Trois bugs corrigés au passage : supprimer une colonne
  faisait disparaître ses cartes, le « + » supprimait la colonne, `reorder` ne
  réordonnait rien. **Recetté par Aramis en prod le 31/08 : le Kanban marche.**
- **PR #11 — ménage** : 28 warnings eslint à 0. **PWA iPhone recettée par
  Aramis après coup : elle marche.**
- **Vercel supprimé** (deux projets). Il servait publiquement `<title>Brief</title>`
  et stockait quatre secrets, dont `BRIEF_PIN` (mécanisme retiré du code le
  26/08) et un jeton Todoist pour du code disparu.

## Decisions

Rien de neuf dans `DECISIONS.md` sur le pivot — **et c'est le problème**. Les
quatre questions ci-dessous doivent être arbitrées **avant d'écrire du code**,
et inscrites dans `DECISIONS.md` :

1. **Où vivent les données ?** Fichiers JSON par utilisateur
   (`data/<userId>/items.json`, changement minimal, garde l'écriture atomique
   et la file sérialisée) **ou** migration vers des tables Postgres Supabase
   avec RLS (le vrai modèle multi-utilisateur, mais réécrit tout le store et
   change la nature du projet — `AGENTS.md` dit aujourd'hui « Brief possède ses
   données », fichiers JSON).
2. **Comment les identifiants CalDAV par utilisateur sont-ils stockés ?** Il
   faut un chiffrement au repos et une clé qui ne vit pas dans le dépôt.
3. **Comment les crons itèrent-ils ?** Boucle sur tous les utilisateurs dans un
   seul appel, ou un appel par utilisateur ?
4. **Les jetons machine deviennent-ils par utilisateur ?** Sinon, une capture
   Telegram ne sait pas où écrire.

**Aramis a demandé `superpowers:brainstorming` avant toute conception de
fonctionnalité** (`CLAUDE.md`). Ce chantier en relève typiquement.

## Changed

Rien. Le chantier n'est pas commencé. Ce qui a été livré le 31/08 est décrit
plus haut et détaillé dans
[`docs/handoffs/2026-08-31-kanban-trello-menage-vercel.md`](docs/handoffs/2026-08-31-kanban-trello-menage-vercel.md).

## Validations

```
$ npx eslint .       → 0 erreur, 0 warning        (28 warnings ce matin)
$ npx tsc --noEmit   → 0 erreur
$ npx vitest run     → 531 passants, 1 skipped (41 fichiers)
```

- **Passant, en prod** : `72a7d1db` déployé et vérifié par Hermes (VERSION
  `1.1.0.0`, HTTP 200 en 73 ms, hydratation propre, 8 chunks JS en 200).
- **Passant, recetté par Aramis en prod** : le Kanban (déplacement de carte) et
  la PWA iPhone après le ménage.
- **Passant** : `npm run build`, exécuté par Vercel sur `ab33fd7b` avant la
  suppression du projet.
- **NON LANCÉ** : plus aucun moyen de lancer `npm run build` (Vercel supprimé,
  Docker absent du Mac, et un `npm run dev` tourne — règle du repo).

## Blockers

### 🔴 Aucun agent ne peut recetter un écran authentifié

Rencontré **trois fois** le 31/08. Ce qu'un agent prouve sans compte s'arrête à
« la page d'entrée hydrate et les routes gardées rendent 401 » — **ça ne teste
aucun écran**. Tout ce qui a de la valeur produit est derrière
`requireSession()`.

**Le pivot multi-utilisateur EST la solution à ce blocage** : une fois les
données cloisonnées, un compte agent ne voit que les siennes, et le recetter
n'expose plus rien. C'est la deuxième raison de le faire, après celle
d'Aramis.

En attendant, la seule méthode qui marche est `browse handoff` : un Chrome
visible s'ouvre, Aramis se connecte, l'agent reprend la main. Ça ne marche que
quand il est là, et ça ne débloque pas Hermes sur le VPS.

### Autres

1. **Pas de SSH vers le VPS depuis le Mac.** Déployer et lire les logs passe
   par un message à Hermes — le webhook `deploy.sh` rend 202 sans rien
   déclencher. ⚠️ **L'absence de confirmation ne prouve pas qu'un déploiement
   n'a pas eu lieu** : un faux blocker « PR #7 non déployée » a été traîné sur
   deux passations alors qu'elle était en prod depuis le 30/08 21 h 12 UTC.
2. **Plafond de dépense mensuel atteint le 31/08** (HTTP 429 sur un
   sous-agent). Une seconde `/code-review` sur la PR #9 est morte comme ça.

## Next — la prochaine action

1. **`superpowers:brainstorming` sur le pivot multi-utilisateur**, en partant
   des quatre décisions listées plus haut. **Ne pas coder avant.** La question
   qui commande tout : fichiers JSON par utilisateur, ou tables Postgres ?
2. Puis un plan écrit (`superpowers:writing-plans` ou `/autoplan`), parce que
   le chantier touche `store.ts`, ~20 routes, les deux crons et la synchro
   CalDAV.
3. **Ne pas créer de second compte Supabase avant que le cloisonnement existe.**
   Aujourd'hui il donnerait un accès complet aux vraies données d'Aramis.

### Différé, à ne pas perdre (dans `TODOS.md`)

- **⚠️ « Reporter » une tâche perd l'heure** et ne retire pas l'occurrence du
  jour. Signalé le 31/08, non reproduit.
- **⚠️ Les étiquettes ne se voient pas dans la fiche tâche**, et le bouton
  d'ajout est trop discret. Signalé le 31/08, non reproduit.
- **Quatre intentions jamais câblées**, déterrées par le ménage : le
  « Réessayer » après échec, la file hors-ligne invisible, l'option `silent` de
  `loadProjects`, `groupByProject` testé mais appelé nulle part.
- **⚠️ À faire par Aramis, hors de portée d'un agent** : révoquer le
  `TODOIST_API_TOKEN` chez Todoist — jeton vivant pour du code supprimé.

---

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-31 (soir) | Le pivot multi-utilisateur n'est pas fait — prochain chantier | Claude Code (Opus 5) | (cette passation) |
| 2026-08-31 (journée) | Kanban Trello livré, ménage du code mort, Vercel supprimé | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-31-kanban-trello-menage-vercel.md) |
| 2026-08-31 (nuit) | Réglages desktop déployés + première recette navigateur | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-31-nuit-reglages-desktop-recette-navigateur.md) |
| 2026-08-30 (nuit, tard) | Accès agenda machine + Réglages derrière le profil — PR #4 et #5 | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-30-nuit-tard-agenda-machine-reglages.md) |
| 2026-08-30 (nuit) | Graphe & Objectifs déployé + recette round 1 | Claude Code | [fiche](docs/handoffs/2026-08-30-nuit-graphe-objectifs-deploye-recette1.md) |
