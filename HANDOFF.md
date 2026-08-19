# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-19 · Crash CalDAV corrigé + coordination mergée

| | |
|---|---|
| **Agent** | Hermes Agent (deepseek-v4-flash via Ollama Cloud) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `4a1ad33` (merge fix DTSTART) · `aacea8e` (fix 3 couches) · `181c549` (coordination multi-agents, mergée) · `c8c175c` (fix cache PWA) |
| **Prod** | https://brief.srv1899780.hstgr.cloud — **saine, bug corrigé et déployé** |
| **GitHub** | https://github.com/aramis75009/brief/tree/feat/ui-redesign-claude |

## Goal — l'objectif

Corriger le bug de prod qui empêchait l'app de s'ouvrir dans **tous** les
navigateurs (crash React côté client sur une date invalide issue du sync
CalDAV), redéployer, vérifier, et documenter la leçon pour tous les agents
(Claude Code compris).

## Current state — ce qui a été fait

### Bug de prod : crash CalDAV DTSTART flottant — ✅ RÉSOLU, DÉPLOYÉ, VÉRIFIÉ

- **Symptôme** : « This page couldn't load » partout, alors que le serveur
  répondait 200 (curl OK, HTTPS OK, conteneur healthy). Le crash était dans le
  JavaScript client — invisible pour curl.
- **Erreur** : `RangeError: date value is not finite in DateTimeFormat.formatToParts()`
  dans `zonedParts()` (`src/lib/zoned.ts` l.52), chunk `24gviof4sk-oz.js`.
- **Cause racine** : l'item `it_msurvw97_6` (récurrence Frip & Trend) avait
  `due = "20260820T140000"` — un **DTSTART ICS flottant** (sans `Z` ni tirets)
  que `remoteDueToItem()` (`caldav.ts` l.423) renvoyait brut. `new Date("20260820T140000")`
  → Invalid Date → `formatToParts()` → RangeError → React plantait au montage.
- **Déclencheur** : commit `ce3cba5` (adoption des horaires CalDAV, déployé
  13h48 UTC) + sync toutes les 60 s. Preuve par backups : 00h12 ISO valide →
  13h46 corrompu.
- **Fix en 3 couches** (commit `aacea8e`) :
  1. `caldav.ts` — `remoteDueToItem()` convertit `YYYYMMDDTHHMMSS` → ISO Paris
  2. `zoned.ts` — `zonedParts()` ne lève plus jamais (date invalide → sentinelle)
  3. `store.ts` — `readItems()` normalise en mémoire, `due` illisible → pas d'échéance
- **Validations** : 128/128 tests, tsc propre, eslint propre, prod déployée
  (HEAD `4a1ad33`), page 200, ancien chunk 404, API : 0 item `due` non-ISO.
- **Détail à connaître** : l'item « vente annuelle » Frip & Trend apparaît sans
  échéance en attendant — le prochain sync CalDAV devrait lui réécrire une date
  correcte. À vérifier au prochain passage.

### Coordination multi-agents — ✅ MERGÉE dans la branche de prod

- `docs/coordination.md` : les 4 copies du dépôt, la branche de prod, règles
  anti-collision, piège du panneau Hostinger, purge PWA iOS.
- `scripts/coord/status.sh` : compare GitHub / copie locale / prod VPS.
- `scripts/coord/pre-push.sh` : garde-fou avant push (branche de prod interdite,
  retard sur origin, HANDOFF.md obligatoire).
- `HANDOFF.md` restauré à la racine (contrat multi-agents).
- `AGENTS.md` : corrigé — la prod est sur `feat/ui-redesign-claude`.
- `DECISIONS.md` : décision « coordination multi-agents » ajoutée.

## Decisions — choix critiques ou irréversibles

- **GitHub = vérité centrale.** Les copies ne s'alignent que par fetch/pull/push.
  Jamais de copie de fichiers entre dossiers.
- **Un agent = une branche à la fois.** Pousser sur la branche de prod en
  parallèle est interdit sans passation explicite.
- **Le PIN reste tel quel** — décision validée du 18/08 (cookie serveur +
  localStorage, une saisie par appareil). Le « PIN réapparu » était le cache
  PWA iOS, pas un retour en arrière du code.
- **Ne jamais écrire une chaîne de date non-parseable dans `due`.** Si une
  conversion échoue, écrire `undefined` (pas d'échéance) — un rappel absent se
  voit, un crash ne se voit pas. (Leçon du bug DTSTART, voir fiche archivée.)

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/caldav.ts` | fix cause : format flottant dans `remoteDueToItem()` |
| `src/lib/zoned.ts` | garde-fou anti-crash dans `zonedParts()` |
| `src/lib/store.ts` | normalisation à la lecture dans `readItems()` |
| `src/lib/caldav.test.ts` | test du format flottant |
| `src/lib/zoned.test.ts` | **nouveau** — test du garde-fou |
| `docs/handoffs/2026-08-19-caldav-floating-dtstart.md` | **nouveau** — fiche du bug (cause, fix, leçons) |
| `docs/coordination.md` | **nouveau** — cadre multi-agents (mergé) |
| `scripts/coord/status.sh` | **nouveau** — diagnostic des copies |
| `scripts/coord/pre-push.sh` | **nouveau** — garde-fou pre-push |
| `HANDOFF.md` | restauré à la racine (cette passation) |
| `AGENTS.md` | corrigé : branche de prod + lien coordination |
| `DECISIONS.md` | entrée « coordination multi-agents » |

## Validations — passants / échoués / non lancés

- ✅ `npx vitest run` : **128/128** (3 nouveaux : DTSTART flottant, garde-fou)
- ✅ `npx tsc --noEmit` : propre
- ✅ `npx eslint .` : propre
- ✅ Prod déployée : page 200, conteneur healthy, ancien chunk `24gviof4sk-oz.js` → 404
- ✅ API `/api/items` : 0 item avec `due` non-ISO (le store normalise)
- 🔶 **Non vérifié** : l'item « vente annuelle » Frip & Trend récupère-t-il une
  date correcte au prochain sync CalDAV ? (à regarder au prochain passage)
- 🔶 **Non vérifié** : l'iPhone d'Aramis — purge du cache PWA faite ? (Réglages
  → Safari → Effacer l'historique et les données de sites → supprimer l'icône →
  recharger → ré-ajouter)

## Blockers — ce qui bloque

- **Rien** pour le code. Pour l'iPhone d'Aramis : l'action manuelle de purge du
  cache PWA (voir plus haut) — non confirmée comme effectuée.

## Next — la prochaine action

1. **Aramis** : purger le cache PWA sur l'iPhone (voir Validations) et confirmer
   que l'app s'ouvre.
2. **Agent suivant** : lancer `bash scripts/coord/status.sh` avant de coder,
   vérifier que l'item Frip & Trend a récupéré sa date au prochain sync CalDAV,
   puis reprendre les priorités listées dans `TODOS.md` (bugs UI priority 2).

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-19** | **Crash CalDAV corrigé + coordination mergée** | **Hermes Agent** | *(cette passation)* |
| 2026-08-19 | Bug de prod : DTSTART flottant (cause, fix, leçons) | Hermes Agent | [fiche](docs/handoffs/2026-08-19-caldav-floating-dtstart.md) |
| 2026-08-19 | Refonte UI Claude Design (en cours) | Hermes Agent | [fiche](docs/handoffs/2026-08-19-refonte-ui-claude-design.md) |
| 2026-08-19 | CalDAV priorité + bugs UI | Hermes Agent | [fiche](docs/handoffs/2026-08-19-caldav-priorite-et-bugs-ui.md) |
| 2026-08-18 | Cookie PIN posé par le serveur (Set-Cookie) | Hermes Agent | [fiche](docs/handoffs/2026-08-18-pin-cookie-server.md) |
| 2026-08-18 | Suppressions d'occurrences adoptées (EXDATE) + ancre de série | Hermes Agent | [fiche](docs/handoffs/2026-08-18-exdate-adoption.md) |
| 2026-08-18 | PIN mémorisé fiabilisé (cookie + localStorage) | Hermes Agent | [fiche](docs/handoffs/2026-08-18-pin-cookie.md) |
| 2026-08-18 | Récurrences de publication bornées fin août | Hermes Agent | [fiche](docs/handoffs/2026-08-18-recurrences-bornees.md) |
| 2026-08-18 | Calendrier = source de vérité + semaine récurrente | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-source-de-verite.md) |
| 2026-08-18 | CalDAV multi-calendriers déployé + routage vérifié | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-multicalendriers-deploye.md) |
| 2026-08-18 | CalDAV multi-calendriers (un calendrier par projet) — implémenté, à déployer | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-multicalendriers.md) |
| 2026-08-17 | PIN mémoire + synchro CalDAV Apple | Hermes Agent | [fiche](docs/handoffs/2026-08-17-pin-memoire-et-caldav-apple.md) |
| 2026-08-16 | Audit complet et refonte produit | Claude Code | [fiche](docs/handoffs/2026-08-16-audit-complet-et-refonte-produit.md) |
| 2026-08-15 | Workflow Telegram et n8n | Hermes Agent | [fiche](docs/handoffs/2026-08-15-workflow-telegram-n8n.md) |
| 2026-08-14 | Déploiement prod + correctif projets invisibles | Hermes Agent | [fiche](docs/handoffs/2026-08-14-deploiement-et-correctif-projets.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |
