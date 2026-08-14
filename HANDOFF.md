# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-14 · Système de passation, et le fuseau horaire remis d'aplomb

| | |
|---|---|
| **Agent** | Claude Code (Opus 5) |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits** | `51e72f9` doc · `5d30257` fuseau · `0bf96bd` correctifs de revue · fusions `bec2363` et `f02e954` |

## Goal — l'objectif

Donner au projet un système de passation lisible par tous les agents qui y
travaillent. Objectif secondaire apparu en route, devenu le plus important :
vérifier ce qu'Hermes avait livré la veille plutôt que le croire sur parole.

## Current state — ce qui a été fait

### Le système documentaire

- **`HANDOFF.md`** (ce fichier) — la passation courante, une seule.
- **`docs/handoffs/`** — 6 passations reconstruites depuis git, du 06 au 14 août.
- **`AGENTS.md`** — le contrat commun. C'est le **seul** fichier qu'Hermes
  charge automatiquement : une règle qui n'y est pas n'existe pas pour lui.
- **`CLAUDE.md`** — le spécifique Claude.
- **`HERMES.md`** — le spécifique Hermes, écrit à partir de ses réponses à 23
  questions, dont une liste explicite de ce qu'il ne fait pas sans accord.

Le tout est aussi packagé en skill réutilisable dans `~/.claude/skills/handoff/`,
pour les autres projets d'Aramis.

### Le bug de fuseau — corrigé, dans quatre fichiers

Hermes rapportait 7 tests en échec sur `due.test.ts` et les classait en « faux
positif d'environnement ». **C'était un vrai bug de production**, et il y en
avait quatre foyers, pas un.

Cause commune : les méthodes locales de `Date` (`setHours`, `getDay`, `setDate`,
`getMonth`) lisent le fuseau de la **machine**. Le développement se fait sur un
Mac réglé sur Europe/Paris ; les conteneurs n'ont pas de `TZ` et tournent en
UTC. Tout calcul de date était donc juste en local et faux en production, **sans
le moindre signal**.

| Fichier | Ce qui était faux en production |
|---|---|
| `src/lib/due.ts` | « demain », « vendredi », « fin de mois » résolus **2 h trop tard** |
| `src/lib/rrule.ts` | récurrence hebdo décalée d'un jour pour toute échéance entre 0 h et 2 h |
| `src/app/api/parse/route.ts` | `alignToRrule` recalait sur le mauvais jour de la semaine |
| `src/app/api/overview/route.ts` | journées de la Vision commençant à 2 h du matin |

Les trois derniers n'avaient **aucun test** et n'auraient pas été trouvés sans
le balayage systématique.

### La branche d'Hermes, relue puis corrigée

Sa revue a sorti 10 défauts, dont trois qui empêchaient la fonctionnalité de
tenir sa promesse — l'échéance ne pouvait pas être effacée, la saisie clavier
était écrasée par la dictée en vol, et un item orphelin changeait de projet en
silence. Tous corrigés (`0bf96bd`), détail dans
[sa fiche](docs/handoffs/2026-08-14-saisie-clavier-et-edition-items.md).

Le tout est fusionné dans `feat/task-completion`. Un seul conflit, dans
`TODOS.md` : les deux côtés consignaient la même validation du Web Push, l'un
par réécriture, l'autre par une ligne de statut. La réécriture l'a emporté.

**Non fait :** rien n'est poussé sur `origin`, et rien n'est déployé.

## Decisions — choix critiques ou irréversibles

**Les règles projet vivent dans `AGENTS.md`, pas dans `CLAUDE.md`.** Hermes a
confirmé ne charger automatiquement qu'`AGENTS.md`. Une règle écrite une fois
s'applique aux trois agents.

*Vérifié :* `upsertAgentRulesBlock()` (dans `node_modules/next/dist/server/lib/`)
ne réécrit que ce qui est **entre** les marqueurs `nextjs-agent-rules` et
préserve le reste. `hasCurrentAgentRules()` renvoie `true` sur le dépôt.

**`HANDOFF.md` ne garde qu'une passation.** Un journal qui grossit sans fin
coûte du contexte à chaque session et finit par ne plus être lu.

**`HANDOFF.md` et `TODOS.md` ne disent pas la même chose.** L'un dit *où on en
est*, l'autre *ce qu'on n'a pas fait*.

**Un module dédié pour l'arithmétique de calendrier : `src/lib/zoned.ts`.**
Plutôt que de corriger quatre fois le même calcul, les primitives sont
centralisées (`zonedParts`, `zonedTime`, `shiftDays`, `shiftMonths`,
`weekdayOf`, `lastDayOfMonth`). Sa règle est écrite en tête du fichier : **ne
jamais appeler les méthodes locales de `Date`**. C'est le seul endroit à
corriger le jour où le fuseau change.

**La suite de tests tourne en UTC, pas dans le fuseau de la machine**
(`vitest.config.mts`). Le vert local doit vouloir dire quelque chose sur la
production. C'est la garde qui empêche ce bug de revenir — et elle a une
histoire : les tests *voyaient* le bug, mais seulement sur une machine en UTC.

**`TZ: Europe/Paris` posé dans `docker-compose.yml`** en ceinture et bretelles.
Ne corrige plus rien depuis que le code est indépendant du fuseau ; protège le
code écrit demain sans cette précaution, et rend les journaux lisibles à l'heure
d'Aramis.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/zoned.ts` | **créé** — primitives de calendrier en fuseau fixe |
| `src/lib/due.ts` | refondu — s'appuie sur `zoned`, plus aucune méthode `Date` locale |
| `src/lib/rrule.ts` | `nextOccurrence` recalculé sur le calendrier de Paris |
| `src/app/api/parse/route.ts` | `alignToRrule` corrigé |
| `src/app/api/overview/route.ts` | bornes de journée, libellés et jour de pic corrigés |
| `src/lib/due.test.ts` | +3 tests de non-régression |
| `vitest.config.mts` | force `TZ=UTC` |
| `docker-compose.yml` | `TZ: Europe/Paris` sur `app` |
| `HANDOFF.md`, `HERMES.md` | **créés** |
| `docs/handoffs/*.md` | **créés** — 6 passations |
| `AGENTS.md`, `CLAUDE.md` | réécrits |

## Validations — passants / échoués / non lancés

| Commande | Résultat |
|---|---|
Lancées **après la fusion**, parce que c'est là que deux chantiers séparés se
contredisent s'ils doivent le faire :

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ **74 passent** (71 + les 3 d'Hermes) |
| `npx tsc --noEmit` | ✅ aucune erreur |
| `npx eslint .` | ✅ aucune erreur |
| `npm run build` | ⏭️ **non lancé** — un `next dev` tourne sur un autre projet |

**Indépendance au fuseau prouvée**, suite relancée sans la config forçant UTC :

```
UTC · Europe/Paris · America/Los_Angeles · Pacific/Kiritimati
Asia/Kolkata (+05:30) · Pacific/Chatham (+12:45) · America/Sao_Paulo
→ 74 passent partout
```

Les décalages non entiers (Kolkata, Chatham) sont là exprès : ils cassent les
implémentations qui supposent des heures pleines.

**Non vérifié — et c'est ce qui reste à faire :**

- Aucun rappel réel n'a été déclenché depuis le correctif de fuseau. Le
  comportement en production ne sera prouvé que par un rappel qui sonne à
  l'heure attendue sur le VPS.
- Les correctifs d'interface (échéance effaçable, note qui grandit, saisie
  préservée) n'ont pas été exercés dans un navigateur. Ils compilent, ils sont
  testés à la racine, ils n'ont pas été *vus*.

## Blockers — ce qui bloque

Rien. Tout est commité et fusionné sur `feat/task-completion`, arbre propre.

## Next — la prochaine action

1. **Pousser et déployer.** `git push origin feat/task-completion`, puis sur le
   VPS `git -C /docker/brief pull && docker compose --env-file .env.production
   up -d --build`. Le correctif de fuseau ne vaut rien tant qu'il n'y tourne
   pas — c'est précisément là que le bug vivait.
2. **Vérifier sur le téléphone**, dans cet ordre : programmer un rappel avec un
   libellé relatif (« demain »), confirmer qu'il sonne à 9 h et non à 11 h ;
   puis effacer une échéance depuis la fiche, et taper dans la note pendant une
   transcription pour voir qu'elle survit.
3. Reprendre le P1 de `TODOS.md` : l'autorisation micro que Safari redemande à
   chaque ouverture.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| 2026-08-14 | Saisie clavier et modification des items | **Hermes** | [fiche](docs/handoffs/2026-08-14-saisie-clavier-et-edition-items.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |

Les fiches du 06 au 14 août sont **reconstruites depuis git** et le disent en
en-tête. Les passations écrites à chaud n'ont pas cet avertissement.
