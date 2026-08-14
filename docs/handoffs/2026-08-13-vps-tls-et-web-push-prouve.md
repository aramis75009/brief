# Passation — 2026-08-13 · En ligne, en TLS, et le Web Push sonne

> ⚠️ **Reconstruit a posteriori depuis git le 2026-08-14.** `Changed` et
> `Validations` sont factuels ; `Decisions` est repris du README et de
> `TODOS.md`, écrits le jour même — donc plus fiable que sur les autres
> passations reconstruites.

| | |
|---|---|
| **Agent** | Claude Code + Aramis (test matériel) |
| **Branches** | `deploy/vps-traefik-tls`, puis `feat/task-completion` |
| **Commits** | `ec8e237`, `977f23a`, `2cd102e` |

## Goal — l'objectif

Solder les trois P0 d'un coup : mettre Brief en ligne en HTTPS, prouver qu'il
garde ses données, et prouver qu'un rappel sonne sur un iPhone verrouillé.

## Current state — ce qui a été fait

**Les trois sont soldés le même jour.** Brief est en ligne sur
`https://brief.srv1899780.hstgr.cloud`, derrière le Traefik qui sert déjà n8n.

**Aramis a fait le test décisif : téléphone verrouillé, la notification
arrive.** C'était le risque numéro un du produit.

Le cycle de sauvegarde complet a été exercé — sauvegarde, suppression de
`items.json`, restauration, donnée revenue. *Une sauvegarde jamais restaurée
n'est pas une sauvegarde.*

Second chantier : cocher une tâche, et faire que la suppression supprime
vraiment (`977f23a`), avec `src/lib/completion.test.ts`.

## Decisions — choix critiques ou irréversibles

**Pas besoin d'acheter un domaine.** Hostinger attribue un hostname public
gratuit `srvXXXXXX.hstgr.cloud`, **avec wildcard** : tout sous-domaine résout
déjà, en A et en AAAA. Et `hstgr.cloud` figure sur la Public Suffix List, donc
chaque `srvXXXXXX.hstgr.cloud` compte comme un domaine distinct pour Let's
Encrypt — quota propre, aucune concurrence avec les autres clients.

**Brief se branche sur le Traefik existant plutôt que d'embarquer son proxy.**
Il n'y a pas de proxy dans ce dépôt ; `deploy/Caddyfile` n'est là que pour une
machine nue.

**L'`id` d'un item est généré avant le premier envoi et réutilisé.** Un second
envoi écrase au lieu de dupliquer : double-clic et rejeu sont inoffensifs.

## Pièges découverts ce jour-là — à ne pas réapprendre

**`--env-file .env.production` n'est pas facultatif.** `env_file:` injecte des
variables dans un conteneur au démarrage ; il n'alimente **pas** l'interpolation
`${...}` du `docker-compose.yml`. Sans le drapeau, la clé VAPID publique arrive
vide au build. Des gardes `:?` ont été ajoutées pour faire échouer Compose
plutôt que produire une image silencieusement cassée.

**La clé VAPID publique doit être passée AU BUILD.** Les variables
`NEXT_PUBLIC_*` sont inlinées dans le bundle par le compilateur. Absente au
build, elle vaut `undefined` dans le navigateur et l'abonnement échoue **sans
que le serveur ne voie rien**.

**Traefik tourne en `exposedbydefault=false`.** Sans les labels, le conteneur
démarre parfaitement et reste invisible depuis Internet : aucune erreur, juste
un 404 du proxy. Premier endroit à regarder si le domaine ne répond pas.

**Un fichier de `/etc/cron.d` est ignoré en silence** si son nom contient un
point ou si ses permissions ne sont pas `644 root:root`.

**iOS ne notifie que les PWA installées à l'écran d'accueil.** En onglet Safari,
l'abonnement peut réussir sans qu'aucune notification n'arrive.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `docker-compose.yml` | +55 — labels Traefik, gardes `:?` |
| `Dockerfile` | ajusté |
| `deploy/Caddyfile` | créé — machine nue uniquement |
| `.env.production.example`, `README.md`, `TODOS.md` | mis à jour |
| `src/app/api/items/route.ts` | +92 — complétion et suppression |
| `src/lib/completion.ts` + `completion.test.ts` | créés |
| `src/components/DoneBox.tsx` | créé |
| `src/components/{BriefApp,TaskSheet,TasksScreen,ReviewScreen}.tsx` | adaptés |

## Validations — passants / échoués / non lancés

- **Passants :** `completion.test.ts`, `projects.test.ts`.
- **Prouvé sur matériel réel :** notification reçue sur iPhone verrouillé ;
  cycle sauvegarde → suppression → restauration.
- **Vérifié :** `curl -w '%{http_code} %{ssl_verify_result}'` → `200 0`.

## Blockers — ce qui bloque

Le P1 devient le sujet le plus urgent : **Safari redemande l'autorisation micro
à chaque ouverture.** C'est ce qui décide si Brief est utilisé au quotidien ou
abandonné.

## Next — la prochaine action

L'autorisation micro persistante.

---

⚠️ **Point resté implicite, et qui a coûté du temps à Hermes le lendemain :**
la production sur le VPS est branchée sur la branche `feat/task-completion`,
**pas sur `main`**.
