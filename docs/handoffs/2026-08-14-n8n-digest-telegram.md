# Passation — 2026-08-14 · Brief parle à n8n, récap du matin sur Telegram

> ⚠️ **Archivé à chaud le 2026-08-15** — passation écrite par Claude Code (Opus 5), archivée avant la passation sur le tri des tâches.

| | |
|---|---|
| **Agent** | Claude Code · Opus 5 |
| **Branche** | `feat/task-completion` — la branche que sert le VPS |
| **Commits** | `a58dcc0` route digest · `4670170` merge · `0754f7f` + `b51a512` doc |

## Goal — l'objectif

Ouvrir un chemin de lecture pour une automatisation externe, et le prouver
de bout en bout : n8n lit Brief chaque matin, trie ce qui pèse sur la journée,
met en forme un message de relance et l'envoie sur Telegram.

## Current state — ce qui a été fait

**La chaîne complète tourne en production**, de bout en bout, envoi compris. Le
workflow n8n s'est déclenché pour de vrai, a lu la prod et produit le message :

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
- **Workflow n8n `Brief — récap du matin`** (`H9f6EWHUzUmi9JDV`), **ACTIF et
  publié**, cron `30 8 * * *` en fuseau `Europe/Paris`. Credential
  `THLHqJ0euzjzwBm7` restreint au seul domaine `brief.srv1899780.hstgr.cloud`.
- **Le canal est Telegram**, et il envoie pour de vrai. Aramis a ajouté le nœud
  `Send a text message` (chat `912003023`, credential `Telegram account`) et
  reçu le message. **WhatsApp est abandonné** : Telegram évite le compte Meta,
  le numéro dédié et le template à faire approuver.

**Deux corrections apportées après son test :**

1. **Le nœud Telegram n'était pas dans la version publiée.** n8n sépare le
   brouillon du graphe publié : « Execute step » teste le brouillon, le cron
   exécute la version publiée. Le test réussissait pendant que le graphe publié
   restait à 4 nœuds — le récap de 8h30 se serait calculé **sans jamais
   partir**. Republié : `activeVersionId` `705d4ec1`, 5 nœuds. **Vérifier avec
   `n8n_get_workflow mode='active'`, jamais `structure` ni `full`.**
2. **`appendAttribution` était à `true`** (son défaut) : chaque récap portait
   « This message was sent automatically with n8n ». Mis à `false`.

**Ce qui n'est PAS fait :** le workflow n'a **aucun chemin d'erreur**. Si Brief
répond 401 ou redémarre à 8h30, l'échec est muet et un récap absent ressemble à
une journée vide. Reporté en P1 dans `TODOS.md`.

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
