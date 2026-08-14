# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-14 · Brief parle à n8n, récap du matin

| | |
|---|---|
| **Agent** | Claude Code · Opus 5 |
| **Branche** | `feat/task-completion` — la branche que sert le VPS |
| **Commits** | `a58dcc0` route digest · `4670170` merge · (+ commit de doc suivant) |

## Goal — l'objectif

Ouvrir un chemin de lecture pour une automatisation externe, et le prouver
de bout en bout : n8n lit Brief chaque matin, trie ce qui pèse sur la journée,
et met en forme un message de relance.

## Current state — ce qui a été fait

**La chaîne complète tourne en production.** Le workflow n8n s'est déclenché
pour de vrai, a lu la prod et produit le message :

```
Ton brief du 14 août

Aujourd'hui (1)
• Photographier 26 polos — Frip & Trend
```

- **`GET /api/digest`** (`src/app/api/digest/route.ts`) — déployée et vivante.
  Renvoie `overdue` + `today`, triés par priorité puis échéance, noms de projets
  résolus. Gardée par `BRIEF_DIGEST_TOKEN`, un **jeton machine distinct du PIN**.
- **`BRIEF_DIGEST_TOKEN` posé** dans `/docker/brief/.env.production` sur le VPS.
  Une sauvegarde horodatée du fichier a été faite avant écriture
  (`.env.production.bak-2026-08-14-2142`).
- **`src/lib/buckets.ts`** — `midnightAt` et `makeBucketOf` extraits de
  `api/overview/route.ts`. Les deux routes partagent désormais **une seule
  définition d'« aujourd'hui »**.
- **Workflow n8n `Brief — récap du matin`** (`H9f6EWHUzUmi9JDV`), **ACTIF**,
  cron `30 8 * * *` en fuseau `Europe/Paris`. Credential `THLHqJ0euzjzwBm7`
  restreint au seul domaine `brief.srv1899780.hstgr.cloud`.

**Ce qui n'est PAS fait, et qu'il ne faut pas croire fait :** le workflow
**n'envoie rien**. Il s'arrête sur le nœud de mise en forme. Demain 8h30 il
tournera, produira le message, et personne ne le lira. Le canal (WhatsApp) est
reporté dans `TODOS.md`, en P1 bis.

## Decisions — choix critiques ou irréversibles

**Une route dédiée plutôt que `GET /api/items` avec le PIN.** Aramis proposait
d'envoyer `x-brief-pin` depuis n8n. Refusé : le PIN ouvre *toutes* les routes —
création, complétion, suppression d'items, et `/api/transcribe` qui consomme la
clé Groq. Un secret vivant dans un planificateur doit se révoquer seul, sans
obliger à changer le code tapé sur le téléphone. Un jeton par usage, comme
`/api/capture` et `/api/cron/reminders`.

**Le tri et le découpage se font côté serveur, pas dans un nœud Code n8n.** La
raison que j'avais avancée était partiellement fausse et mérite d'être écrite
correctement : le conteneur n8n **ne tourne pas en UTC**, il est en
`Europe/Berlin` (`GENERIC_TIMEZONE`), donc au bon décalage — par accident. La
vraie raison de garder le calcul côté Brief est que ce réglage vit **hors du
dépôt** : personne ne le verrait changer, et `npx vitest run` ne pourrait pas
l'attraper. Le serveur possède l'horloge, comme pour les rappels.

**Le workflow reste actif malgré l'absence de canal.** Il tournera demain à 8h30
sans rien envoyer. C'est voulu : l'exécution de demain matin sera une preuve de
plus, sur les vraies données du matin, et elle ne coûte rien.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/digest.ts` | **créé** — `buildDigest()`, la forme de la réponse et le tri |
| `src/lib/digest.test.ts` | **créé** — 12 tests, dont celui du fuseau (échéance à 1 h du matin) |
| `src/lib/buckets.ts` | **créé** — `midnightAt`, `makeBucketOf`, extraits d'`overview` |
| `src/app/api/digest/route.ts` | **créé** — enveloppe fine : garde du jeton, lecture, `buildDigest` |
| `src/app/api/overview/route.ts` | −21 lignes : consomme `buckets.ts` au lieu de ses copies locales |
| `README.md` | variable, route, forme de la réponse, et pourquoi le serveur trie |
| `.env.example`, `.env.production.example` | `BRIEF_DIGEST_TOKEN` documenté |
| `TODOS.md` | section **P1 bis** : le canal WhatsApp et le chemin d'erreur |

Hors dépôt : `.env.production` du VPS (jeton ajouté), workflow et credential n8n.

## Validations — passants / échoués / non lancés

**Passants :**

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ **86 passent** (74 avant + 12 nouveaux) |
| `TZ=Europe/Paris npx vitest run` | ✅ 86 passent — vert sous les deux fuseaux |
| `npx tsc --noEmit` | ✅ aucune erreur |
| `npx eslint .` | ✅ aucune erreur |
| `validate_workflow` (MCP n8n) | ✅ `valid: true`, 0 erreur, 0 avertissement |

**Vérifié en production :**

| Vérification | Résultat |
|---|---|
| `docker compose --env-file .env.production up -d --build` | ✅ Built, Recreated, **Healthy** |
| `GET /api/digest` sans jeton | ✅ `401 {"error":"Jeton invalide."}` |
| `GET /api/digest` **avec le PIN** | ✅ `401` — le PIN n'ouvre pas cette porte |
| `GET /api/digest` avec le jeton | ✅ `200` + les vraies données |
| Depuis le conteneur n8n (`docker exec`) | ✅ `200` — la connectivité inter-conteneurs passe |
| Exécution n8n n° 1 | ✅ déclenchée à **21:48:00 UTC = 23:48:00 Paris**, `success`, 817 ms |

Le test de fuseau a été prouvé **discriminant** : une implémentation `setHours`
classe « en retard » une tâche due à 1 h du matin. Vérifié en exécutant les deux.

**Non lancé / non vérifié :**

- **Aucun message n'a été envoyé nulle part.** Le workflow s'arrête avant.
- Le déclenchement a été prouvé à 23h48, **pas à 8h30**. Le cron a été remis à
  `30 8 * * *` et la version publiée vérifiée, mais la première exécution
  matinale reste à observer.
- Le fuseau du workflow n'a pas pu être distingué de celui du conteneur :
  `Europe/Paris` et `Europe/Berlin` ont le même décalage. Le test prouve que le
  Schedule Trigger marche, pas que le réglage de fuseau est celui qui décide.
- `npm run build` **non lancé** — un `next dev` tournait (règle du projet).

## Blockers — ce qui bloque

Rien de bloquant. Deux points d'attention :

- **Le canal WhatsApp reste à établir.** Aramis a un WhatsApp Business et un bot
  Hermes qui lui écrit depuis un numéro dédié : il faut d'abord découvrir
  **comment ce bot est câblé**. S'il passe par la Cloud API de Meta, le
  credential se réutilise. Sinon, la fenêtre de 24 h impose un template
  pré-approuvé — affirmé de mémoire, **non vérifié**.
- Un `npm run dev -- -p 3100` de Brief a été laissé tournant sur le Mac, et un
  `BRIEF_DIGEST_TOKEN` de **dev** ajouté à `.env.local` (sans valeur en prod).
  Le port 3000 appartient à MyFlip, pas à Brief.

## Next — la prochaine action

1. **Demain matin, lire l'exécution de 8h30** : `n8n_executions` sur
   `H9f6EWHUzUmi9JDV`. C'est la preuve qui manque.
2. **Établir comment le bot Hermes envoie sur WhatsApp**, puis brancher le nœud
   d'envoi après « Mettre en forme le message » — avec son chemin d'erreur.
3. Le P1 de `TODOS.md` reste ouvert : l'autorisation micro que Safari redemande.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| 2026-08-14 | Brief parle à n8n, récap du matin | Claude Code | *(cette passation)* |
| 2026-08-14 | Déploiement prod + correctif projets invisibles | **Hermes** | [fiche](docs/handoffs/2026-08-14-deploiement-et-correctif-projets.md) |
| 2026-08-14 | Système de passation + correctif fuseau | Claude Code | [fiche](docs/handoffs/2026-08-14-systeme-passation-et-fuseau.md) |
| 2026-08-14 | Saisie clavier et modification des items | **Hermes** | [fiche](docs/handoffs/2026-08-14-saisie-clavier-et-edition-items.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |

Les fiches du 06 au 14 août sont **reconstruites depuis git** ou archivées à
chaud et le disent en en-tête. Les passations écrites à chaud portent cet
avertissement.
