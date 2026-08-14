# Passation — 2026-08-07 · Chaîne dictée → Todoist, et PWA installable

> ⚠️ **Reconstruit a posteriori depuis git le 2026-08-14.** `Goal`, `Decisions`
> et `Blockers` sont déduits des diffs et du README de l'époque. `Changed` et
> `Validations` sont factuels.

| | |
|---|---|
| **Agent** | Claude Code |
| **Branche** | `main` |
| **Commits** | `8555876`, `f778aa4` |

## Goal — l'objectif

Fermer la boucle : de la voix jusqu'à une tâche réellement enregistrée quelque
part. Et rendre l'application installable sur l'écran d'accueil d'un iPhone.

## Current state — ce qui a été fait

La chaîne complète fonctionne — dictée → Whisper → `/api/parse` (LLM Groq) →
écran Revue → envoi. **La destination est Todoist à cette date.**

Côté PWA : `manifest.ts`, les quatre icônes (`icon-192`, `icon-512`,
`icon-maskable-512`, `apple-touch-icon`), les safe areas et un pavé PIN
entièrement redessiné.

Le code mort a été supprimé plutôt que laissé en place : `src/lib/mock.ts` et
`src/lib/parse.ts` disparaissent au profit de `src/lib/api.ts`.

## Decisions — choix critiques ou irréversibles

**La priorité 1 est la PLUS HAUTE** (convention iCalendar). Une seule échelle
dans tout le code. *Toujours vivant :* ne pas réintroduire une seconde échelle
sans conversion testée.

**Les safe areas passent par `.safe-top` / `.safe-bottom` dans `globals.css`,
pas par des utilitaires Tailwind arbitraires.** Raison technique : Tailwind v4
ne compile pas les utilitaires arbitraires contenant `env()`. Écrire
`pt-[env(safe-area-inset-top)]` produit une classe qui n'existe pas, sans la
moindre erreur de build.

**Le reset CSS doit rester dans `@layer base`.** Hors layer, il l'emporte sur
les utilitaires Tailwind — c'est ce qui affichait un bouton noir sur noir.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/app/api/parse/route.ts` | créé — structuration LLM |
| `src/app/api/projects/route.ts` | créé |
| `src/app/api/push/route.ts` | créé — envoi vers Todoist |
| `src/lib/api.ts` | créé — client unique |
| `src/lib/{mock,parse}.ts` | **supprimés** |
| `src/app/manifest.ts` | créé — PWA |
| `public/icon-*.png`, `apple-touch-icon.png` | créés |
| `src/components/PinGate.tsx` | refondu (+239/-…) |
| `src/lib/useRecorder.ts` | refondu |
| `README.md` | +111 lignes |

## Validations — passants / échoués / non lancés

- **Non lancés :** toujours aucune suite de tests.
- **Vérifié à la main :** chaîne complète dictée → Todoist ; installation PWA
  sur iPhone.

## Blockers — ce qui bloque

Todoist plafonne le nombre de projets, et Brief n'est pas propriétaire de ses
données. Ce plafond est ce qui déclenchera le pivot trois jours plus tard.

## Next — la prochaine action

Trancher la dépendance à Todoist.
