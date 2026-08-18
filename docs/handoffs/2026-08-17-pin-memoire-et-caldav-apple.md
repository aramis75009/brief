# Passation — 2026-08-17 · PIN mémoire + synchro CalDAV Apple

| | |
|---|---|
| **Agent** | Hermes Agent · `deepseek/deepseek-v4-flash-0731` via OpenRouter |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** (fusion de `feat/remember-device-pin` + `feat/caldav-sync`) |
| **Commits** | `f2ad5e4` (PIN mémorisé), `36fcdf5` (DECISIONS.md), `df4af5e` (CalDAV) — **déployé en prod** |

## Goal — l'objectif

Deux décisions fortes d'Aramis (17/08), actées dans `DECISIONS.md` et livrées en
production : 1) **supprimer la friction du PIN** à l'ouverture (le code se saisit
une fois par appareil, puis Brief s'ouvre direct) ; 2) **réactiver CalDAV Apple**
— synchro Brief → calendrier Apple **obligatoire**, latence ~15 min acceptée.

## Current state — ce qui a été fait

1. **PIN « appareil mémorisé »** : `src/lib/pin.ts` passe de `sessionStorage`
   (vidé à chaque fermeture) à `localStorage` (persistant). Le serveur ne change
   **pas** : `requirePin` / `x-brief-pin` / `BRIEF_PIN` restent la seule
   barrière, vérifiée en prod (401 sans PIN, 200 avec).
2. **`DECISIONS.md` créé** : journal permanent des décisions d'Aramis (10
   entrées, du 06/08 au 17/08), référencé dans AGENTS.md comme lecture
   obligatoire juste après HANDOFF.md. Deux invariants AGENTS.md obsolètes
   corrigés (sessionStorage → localStorage ; CalDAV écarté → réactivé).
3. **Synchro CalDAV Apple implémentée et DÉPLOYÉE** :
   - `src/lib/caldav.ts` : découverte PROPFIND (principal → calendar-home-set
     → calendrier `home/` = « Personnel »), mapping items datés → VEVENT
     (all-day ou horaire, rrule RFC 5545, priorité), UID stable `brief-<id>`
     (PUT idempotent, DELETE des terminés), garde-fou 15 min persisté dans
     `BRIEF_DATA_DIR`. Tout le calcul de date passe par `zoned.ts`.
   - Route `/api/cron/caldav-sync` (jeton machine `BRIEF_CALDAV_TOKEN`), appelée
     par le conteneur cron existant (docker-compose.yml) chaque minute ; le
     garde-fou interne la fait sortir sans réseau hors intervalle.
   - Secrets iCloud (`BRIEF_CALDAV_USER`, `BRIEF_CALDAV_PASSWORD`) + jeton
     ajoutés au `.env.production` du VPS — **jamais dans git** (`.env.local`
     gitignoré, vérifié non tracké).
4. **Mise en production** : fusion fast-forward dans `feat/task-completion`,
   push, `git pull` + rebuild + `up -d` sur le VPS (`/docker/brief`).
   Conteneurs recréés, `brief-app-1` healthy.

## Decisions — choix critiques ou irréversibles

- **CalDAV réactivé (renverse l'écart du 14/08).** La latence ~15 min est
  acceptée car les rappels courts restent en Web Push dans Brief ; le calendrier
  Apple sert les résumés matin/soir. Sens : **Brief → Apple seulement** pour
  commencer (aller-retour décidé plus tard). Détails : `DECISIONS.md`.
- **PIN une fois par appareil.** Mémorisation `localStorage`, sécurité serveur
  inchangée. Détails : `DECISIONS.md`.
- **Calendrier cible = « Personnel » (`home/`)** — décision d'Aramis, pas de
  calendrier dédié. `BRIEF_CALDAV_CALENDAR_PATH` vide par défaut.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/pin.ts` | sessionStorage → localStorage (PIN mémorisé) |
| `src/components/PinGate.tsx` | Copy : « Une seule fois sur cet appareil » |
| `src/app/api/session/route.ts` | Commentaire mis à jour |
| `DECISIONS.md` | **Nouveau** — journal des décisions (10 entrées) |
| `AGENTS.md` | Table des fichiers + 2 invariants corrigés |
| `src/lib/caldav.ts` | **Nouveau** — module de synchro CalDAV |
| `src/lib/caldav.test.ts` | **Nouveau** — 9 tests unitaires (génération ICS) |
| `src/lib/caldav.integration.test.ts` | **Nouveau** — test réseau (sauté sans `.env.local`) |
| `src/app/api/cron/caldav-sync/route.ts` | **Nouveau** — route cron (jeton machine) |
| `.env.example` / `.env.production.example` | 5 variables CalDAV documentées |
| `docker-compose.yml` | Cron appelle aussi `/api/cron/caldav-sync` |

## Validations — passants / échoués / non lancés

- `npx eslint .` : ✅ 0 erreur.
- `npx tsc --noEmit` : ✅ 0 erreur.
- `npx vitest run` : ✅ **104/104** (94 existants + 9 caldav + 1 intégration
  réseau réelle exécutée avec `.env.local` présent).
- Connexion iCloud réelle : ✅ découverte + lecture via le module (test
  d'intégration) ; PUT/DELETE curl 201/204 (événement de test supprimé).
- **Prod** : ✅ `GET /` 200 ; `/api/items` sans PIN 401 ; **premier passage de
  la synchro : `desired=8 put=8 failures=0`**, puis `skipped nextSyncIn=840s`.
  ✅ **8 événements `brief-*` confirmés par lecture CalDAV indépendante** dans
  le calendrier Personnel.
- MKCALENDAR (créer un calendrier via CalDAV) : ❌ **403 iCloud** — les
  calendriers se créent côté app Apple. Contourné (calendrier Personnel).

## Blockers — ce qui bloque

Rien. À savoir : `BRIEF_CALDAV_TOKEN` dans `.env.production` du VPS et dans le
fichier de la machine locale — les deux doivent rester identiques si on le
régénère. Les identifiants iCloud ne sont **que** sur le VPS et en `.env.local`
local (jamais dans git).

## Next — la prochaine action

1. **Aramis : tester sur iPhone** — 1ʳᵉ ouverture après déploiement demande le
   PIN **une dernière fois** (l'ancien code était en sessionStorage), ensuite
   Brief s'ouvre direct. Vérifier que les 8 tâches datées apparaissent bien dans
   l'app Calendrier (calendrier « Personnel ») et qu'elles **disparaissent
   quand on les coche** dans Brief.
2. Décider plus tard du sens aller-retour (Apple → Brief) si besoin.
3. Reprendre la refonte produit (peau Claude Design) — voir
   `docs/designs/2026-08-16-brief-design-v4.md` ; le modèle produit validé du
   16/08 ne change pas.
