# Passation — 2026-08-14 · Saisie au clavier et modification des items

> ⚠️ **Reconstruit a posteriori le 2026-08-14** depuis git *et depuis les
> réponses d'Hermes lui-même* (23 questions posées, réponses reprises ici).
> La section `Validations` est la sienne, confirmée par relecture des commits.

| | |
|---|---|
| **Agent** | **Hermes Agent v0.20.0** · `deepseek/deepseek-v4-flash-0731` via OpenRouter |
| **Branche** | `feat/saisie-clavier-et-modification-items` (part de `feat/task-completion`) |
| **Commits** | `2cd102e`, `078c6b5`, `310cdb7`, `42bf442` |
| **Statut** | ⚠️ **Non fusionnée. Non relue. Non déployée.** |

## Goal — l'objectif

Pouvoir saisir une note au clavier quand la dictée n'est pas possible, et
pouvoir modifier un item **après** l'avoir enregistré — jusqu'ici la fiche ne
permettait que d'effacer, et l'effacement ne persistait même pas.

## Current state — ce qui a été fait

Le chaînon manquant est posé : `PATCH` et `DELETE` sur `/api/items/[id]`.
`store.patchItem` et `store.deleteItem` existaient déjà **sans route pour y
arriver** — la suppression se faisait côté client et l'item revenait au
rechargement.

`TaskSheet` devient éditable (+296 lignes), `CaptureScreen` accepte la saisie
clavier, et l'écran de capture a été réorganisé en deux passes successives :
relevé du jour en tête, note éditable juste en dessous, puis masquage du bouton
« Rien à structurer » tant qu'aucune note n'existe.

**Ce qui n'a pas été fait :** aucun test n'a été ajouté pour la nouvelle route.

## Decisions — choix critiques ou irréversibles

**La nouvelle route respecte les deux conventions du dépôt sans qu'on ait eu à
le lui rappeler** — vérifié à la relecture :
- `requirePin(req)` en première ligne de `PATCH` et de `DELETE` ;
- `sanitizePatch()` applique la règle « une date illisible devient *pas
  d'échéance*, une priorité inconnue devient 4, un projet inconnu bascule sur le
  repli ». Jamais de donnée bricolée.

C'est l'argument le plus fort pour que les règles du projet vivent dans
`AGENTS.md` : c'est le seul fichier qu'Hermes charge automatiquement.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/app/api/items/[id]/route.ts` | **créé** (113 l.) — `PATCH` + `DELETE` |
| `src/components/TaskSheet.tsx` | +296/-… — fiche éditable |
| `src/components/CaptureScreen.tsx` | +154/-… — saisie clavier, réagencement |
| `src/components/BriefApp.tsx` | +27 |
| `src/lib/api.ts` | +17 — client des deux verbes |
| `TODOS.md` | +1 (venu d'un rebase, pas d'une intention) |

Total : **481 insertions, 127 suppressions, 6 fichiers.** Aucun fichier de
configuration, de déploiement ou de secret touché.

## Validations — passants / échoués / non lancés

Réponse d'Hermes, mot pour mot : *« Honnêtement, non pour tous. »*

| Commit | Lint | `tsc --noEmit` | Tests | Build |
|---|---|---|---|---|
| `078c6b5` | ✅ | ✅ | ✅ | ✅ |
| `310cdb7` | ✅ | ✅ | ❌ **non lancés** | ❌ **non lancé** |
| `42bf442` | ✅ | ✅ | ❌ **non lancés** | ❌ **non lancé** |
| `2cd102e` | — | — | — | issu d'un rebase |

Hermes rapporte **61 tests OK / 7 échecs** sur `due.test.ts`, qu'il attribue à
un « faux positif d'environnement » lié au fuseau.

⚠️ **Ce diagnostic est faux, et la vérification a été refaite le jour même :**

```
npx vitest run            → 68/68 passent   (machine Europe/Paris)
TZ=UTC npx vitest run     → 61 passent, 7 échouent  (mêmes chiffres qu'Hermes)
```

Ce ne sont pas des faux positifs. `atHour()` (`src/lib/due.ts:72`) fait
`d.setHours(9)` — heure **locale machine** — puis `toIsoWithOffset()` colle le
décalage Paris. Sur une machine UTC, 09:00 devient `11:00+02:00`. Voir la
passation du jour pour l'analyse complète : c'est un vrai bug de production, pas
un défaut de test.

## Blockers — ce qui bloque

**La branche n'est pas fusionnée.** Elle part de `feat/task-completion`, qui est
la branche réellement déployée en production sur le VPS — pas `main`.

Hermes signe ses commits `Aramis <aramis.begnene@gmail.com>` : **rien dans git
ne distingue son travail d'un travail humain.** C'est le trou que ce système de
passations existe pour boucher.

## Next — la prochaine action

**Relue ET corrigée le 2026-08-14 par Claude Code**, commit `0bf96bd`, puis
fusionnée dans `feat/task-completion` par `f02e954`.

### Ce qui a été corrigé — 9 fichiers, +205/−82

| # | Correctif | Fichier |
|---|---|---|
| A | Échéance effaçable : l'option porte `DUE_CLEAR`, plus `""` | `projects.ts`, `TaskSheet.tsx`, `ReviewScreen.tsx` |
| B | `setTranscript((prev) => …)` — la dictée n'écrase plus la frappe | `BriefApp.tsx` |
| C | Item orphelin : le projet de repli est présélectionné et **affiché** | `TaskSheet.tsx` |
| 1 | `Cmd+Entrée` obéit aux mêmes gardes que le CTA (`canStructure`) | `CaptureScreen.tsx` |
| 2 | La note grandit avec son contenu (`scrollHeight`), plafond `45vh` | `CaptureScreen.tsx` |
| 3 | `try/catch` → 503 en français au lieu du 500 générique | `items/[id]/route.ts` |
| 4 | Titre blanc → vrai 400 (le contrôle était inatteignable) | `items/[id]/route.ts` |
| 5 | Date illisible → `null`, comme partout ailleurs dans Brief | `items/[id]/route.ts` |
| 6 | Un seul chemin de suppression : le `DELETE` de collection retiré | `items/route.ts`, `api.ts` |
| 7 | `border-0 border-solid` : le soulignement au focus s'affiche | `TaskSheet.tsx` |
| — | +3 tests verrouillant la cause racine de A | `projects.test.ts` |

**Deux écarts assumés, à valider :**

- **`ReviewScreen.tsx` a été corrigé aussi**, alors qu'il est hors périmètre de
  la branche : il portait le même défaut (pré-existant, pas d'Hermes) et il est
  sur le flux principal — on ne pouvait pas non plus y effacer une échéance
  inventée par le LLM. Corriger l'un sans l'autre aurait laissé la moitié du
  piège en place.
- **`DELETE /api/items` (collection) a été supprimé** au profit de
  `DELETE /api/items/[id]`, et `api.ts` repointé. Il y avait deux chemins de
  suppression dont un jamais appelé ; garder le mort aurait été le laisser
  diverger.

**Validations :** `tsc` ✅ · `eslint` ✅ · `vitest` **71/71** (68 + 3).

⚠️ **Cette branche n'a PAS le correctif de fuseau horaire** — il vit sur
`feat/task-completion`. Les deux devront se rejoindre.

### Ce qui avait été trouvé — la revue d'origine

### Résultat de la relecture — 10 points, 3 à corriger avant fusion

Trois défauts empêchent la fonctionnalité de tenir sa promesse. Les deux
premiers ont été vérifiés dans le code, pas seulement rapportés.

**A. L'échéance ne peut pas être effacée** (`TaskSheet.tsx:158`) — ✅ vérifié.
Le `<select>` est verrouillé sur `value=""` et sa première option vaut aussi
`""` (`DUE_SUGGESTIONS[0]`). Rechoisir « Pas d'échéance » ne déclenche donc
jamais d'événement `change` : la branche `if (!e.target.value)` est
inatteignable. Une échéance posée par erreur est définitive. Le même patron
existe dans `ReviewScreen.tsx:202` — préexistant, mais ici il bloque une action
centrale de la fiche.

**B. La saisie clavier est écrasée par la dictée en vol**
(`BriefApp.tsx:369`) — ✅ vérifié. `onRecorded` calcule `merged` depuis le
`transcript` figé dans sa closure, puis attend `transcribeAudio` (jusqu'à 90 s).
Tout ce qui est tapé pendant « Transcription en cours… » disparaît au retour. Le
commentaire dit pourtant « une nouvelle dictée n'écrase jamais la précédente » :
l'intention est juste, c'est la closure qui trahit. Le scénario n'existait pas
avant ce PR, puisque la note n'était pas éditable. Correctif : passer par la
forme fonctionnelle, `setTranscript((prev) => …)`.

**C. Un item orphelin change de projet en silence** (`TaskSheet.tsx:126`).
Si le projet d'un item a été supprimé depuis Réglages, son `projectId` n'est
dans aucune `<option>`. Corriger seulement le titre renvoie l'id mort, que
`sanitizePatch` réécrit en `fallbackProjectId()` — **le premier projet de la
liste**. L'item déménage sans un mot.

### Les sept autres

| Point | Fichier | Gravité |
|---|---|---|
| `Cmd+Entrée` court-circuite les gardes du CTA (structure pendant l'enregistrement, `/api/parse` concurrents) | `CaptureScreen.tsx:235` | moyenne |
| `rows` compté sur les `\n` : une dictée sans retour ligne s'affiche sur 2 lignes en `resize-none` | `CaptureScreen.tsx:242` | moyenne |
| Pas de `try/catch` : 500 générique au lieu du 503 en français des autres routes | `api/items/[id]/route.ts:89` | moyenne |
| `if (patch.title === "")` est du code mort — un titre blanc renvoie 200, pas 400 | `api/items/[id]/route.ts:85` | basse |
| Une `due` illisible est ignorée au lieu de devenir `null` — contredit l'invariant du dépôt | `api/items/[id]/route.ts:46` | basse |
| **`DELETE /api/items/[id]` n'est appelé par personne** — ✅ vérifié : `api.ts:136` vise toujours `DELETE /api/items` avec l'id dans le corps | `api/items/[id]/route.ts:114` | basse |
| `border-none` annule le soulignement au focus de l'Intitulé | `TaskSheet.tsx:120` | basse |

### Écarté après vérification

Le `useState` de `TaskSheet` non synchronisé avec sa prop `task` n'est pas
exploitable : le composant est démonté dès que `sheetId` repasse à `null`.
`remindedAt` non réinitialisé sur changement d'échéance est inoffensif —
`pendingReminders` compare `remindedAt >= due`.

---

## Ce qu'Hermes dit lui avoir manqué

Repris de ses réponses, parce que c'est directement actionnable :

1. **Savoir que la prod tourne sur `feat/task-completion` et non `main`** — l'a
   obligé à fusionner plus que prévu.
2. **Avoir le nom de domaine et l'IP du VPS explicitement au départ.**
3. **Savoir qu'Hermes tourne lui-même dans un conteneur sur ce même VPS.**

Les trois sont désormais dans `HERMES.md`.

## Ses modes d'échec, tels qu'il les rapporte

- **Auth git** : push en « permission denied » tant que le remote n'était pas en
  SSH avec `core.sshCommand` pointant la bonne clé.
- **API Hostinger** : chemins v2 essayés à tort, la v1 est la bonne.
- **Faux positifs de lint** sur les routes utilisant les alias `@/lib`,
  invalidés ensuite par le vrai `tsc`.
- **Filtre anti-injection de sa mémoire** : rejette à tort les phrases contenant
  des motifs SSH.
