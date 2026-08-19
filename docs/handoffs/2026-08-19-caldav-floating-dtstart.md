# HANDOFF — Bug de prod : crash CalDAV DTSTART flottant (RÉSOLU)

**Fiche archivée — le bug est corrigé, déployé et vérifié le 2026-08-19.**
Cette fiche documente la cause racine, le fix en 3 couches et la leçon, pour
que personne ne retombe dessus. La passation courante est `HANDOFF.md`.

---

## Le symptôme

« L'app ne s'ouvre plus » sur **tous** les navigateurs (iPhone, Mac, Firefox).
Le serveur répondait pourtant 200 partout : `curl` OK, HTTPS OK, DNS OK,
conteneur healthy. **Le crash était côté client, dans le JavaScript** — c'est
pourquoi tout le diagnostic réseau passait.

Erreur exacte dans Safari DevTools :

```
RangeError: date value is not finite in DateTimeFormat.formatToParts()
```

dans le chunk `24gviof4sk-oz.js` (~l.470), qui est le code compilé de
`zonedParts()` dans `src/lib/zoned.ts` (l.52) :

```ts
const F = new Intl.DateTimeFormat("en-CA", { timeZone: R, ... });
function L(e) { for (let n of F.formatToParts(e)) { ... } }
```

`formatToParts()` lève une RangeError si `e` est une date invalide
(`Invalid Date`). React plantait au montage de `HomeScreen` → écran vide.

## La cause racine

Un seul item corrompu plantait toute l'app : **`it_msurvw97_6`** (récurrence
« vente annuelle » Frip & Trend) dont `due` valait :

```
"20260820T140000"
```

C'est un **DTSTART ICS flottant** (sans `Z`, sans tirets) — le format brut
qu'Apple CalDAV renvoie pour un événement sans fuseau explicite.
`new Date("20260820T140000")` → **Invalid Date** (JS ne parse pas ce format).

**Comment c'est arrivé :** le commit `ce3cba5` (« fix: adopt CalDAV time edits
on recurring items », déployé 19/08 13:48 UTC) a fait adopter les horaires du
calendrier Apple au premier sync (toutes les 60 s). `remoteDueToItem()`
(`src/lib/caldav.ts` l.423) savait convertir `…Z` (UTC) et les dates seules
(allDay), mais **pas le format flottant** → il renvoyait la chaîne brute →
stockée telle quelle dans `items.json`.

**Preuve par les backups** (le volume `brief-data` est l'unique copie) :
- backup 00h12 : `due="2026-08-17T09:00:00+02:00"` (ISO valide)
- backup 13h46 : `due="20260820T140000"` (cassé)

Le sync de 60 s a écrit la valeur corrompue juste après le déploiement de
`ce3cba5` — d'où le timing « ça a commencé pile quand Claude Code a travaillé ».

## Le fix — 3 couches (commit `aacea8e`, merge `4a1ad33` dans la prod)

| Couche | Fichier | Rôle |
|---|---|---|
| **Cause** | `src/lib/caldav.ts` — `remoteDueToItem()` | convertit les DTSTART flottants `YYYYMMDDTHHMMSS` en ISO Europe/Paris (`20260820T140000` → `2026-08-20T14:00:00+02:00`) |
| **Anti-crash** | `src/lib/zoned.ts` — `zonedParts()` | ne lève plus jamais : date invalide → valeur sentinelle au lieu de RangeError |
| **Défense en profondeur** | `src/lib/store.ts` — `readItems()` | normalise en mémoire (sans réécrire le fichier), log le record fautif, `due` illisible → « pas d'échéance » (règle du projet) |

## Validations

- ✅ `npx vitest run` : **128/128** (3 nouveaux : DTSTART flottant dans
  `caldav.test.ts`, garde-fou dans `zoned.test.ts`)
- ✅ `npx tsc --noEmit` : propre
- ✅ `npx eslint .` : propre
- ✅ Prod déployée (branche `feat/ui-redesign-claude`, HEAD `4a1ad33`) :
  page 200, ancien chunk `24gviof4sk-oz.js` → 404 (nouveau build),
  API `/api/items` : **0 item avec `due` non-ISO** (le store normalise)

## La leçon — à ne pas oublier

1. **Un DTSTART CalDAV peut être flottant** (`YYYYMMDDTHHMMSS` sans `Z` ni
   tirets) quand l'événement n'a pas de fuseau explicite. `new Date()` ne le
   parse pas. **Toujours** passer par `remoteDueToItem()` qui normalise en ISO.
2. **Ne jamais écrire une chaîne de date non-parseable dans `due`.** Si une
   conversion échoue, écrire `undefined` (pas d'échéance) plutôt qu'une chaîne
   brute — un rappel absent se voit, un crash ne se voit pas.
3. **Un crash JS client est invisible pour `curl`.** « Le serveur répond 200 »
   ne prouve pas que l'app marche. Tester dans un navigateur (ou vérifier
   qu'aucune date invalide ne traîne dans les données).
4. **Les backups sont la preuve du moment de corruption** — comparer les
   backups avant/après un déploiement pour dater un changement de données.
5. **Le volume `brief-data` est l'unique copie** — toujours sauvegarder avant
   déploiement (`deploy/backup.sh`), et copier le backup hors VPS.

## Fichiers touchés par le fix

| Fichier | Nature |
|---|---|
| `src/lib/caldav.ts` | fix cause : format flottant dans `remoteDueToItem()` |
| `src/lib/zoned.ts` | garde-fou anti-crash dans `zonedParts()` |
| `src/lib/store.ts` | normalisation à la lecture dans `readItems()` |
| `src/lib/caldav.test.ts` | test du format flottant |
| `src/lib/zoned.test.ts` | **nouveau** — test du garde-fou |
