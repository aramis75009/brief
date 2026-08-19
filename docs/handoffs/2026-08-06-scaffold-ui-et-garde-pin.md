# Passation — 2026-08-06 · Scaffold, UI importée, garde PIN et micro réel

> ⚠️ **Reconstruit a posteriori depuis git le 2026-08-14.** Les sections
> `Goal`, `Decisions` et `Blockers` sont déduites des diffs, du README et des
> commentaires de code — elles n'ont pas été dictées à chaud. Les sections
> `Changed` et `Validations` sont factuelles.

| | |
|---|---|
| **Agent** | Claude Code |
| **Branche** | `main` |
| **Commits** | `2ccc9c8`, `6234749`, `e595c9e` |

## Goal — l'objectif

Poser le squelette de Brief et prouver la première brique de la chaîne : parler
dans le micro d'un iPhone et récupérer du texte.

## Current state — ce qui a été fait

Next.js 16 (App Router) + React 19 + Tailwind v4 initialisés. L'interface a été
importée depuis une maquette : `BriefApp`, `CaptureScreen`, `ReviewScreen`,
`SettingsScreen`, `PinGate`, `TabBar`, `PhoneFrame`.

Deux routes serveur existent : `/api/session` (validation du PIN) et
`/api/transcribe` (Groq Whisper). Le micro n'est pas simulé — `useRecorder`
capte réellement.

**Non fait :** aucune structuration LLM, aucun stockage, aucun rappel. La revue
affiche des données de démonstration.

## Decisions — choix critiques ou irréversibles

**Le PIN est vérifié côté serveur, jamais côté client.** `src/lib/guard.ts`
compare `x-brief-pin` à `process.env.BRIEF_PIN` en temps constant sur chaque
route `/api/*`. L'écran PIN et le `sessionStorage` ne sont que de l'UX. Raison :
l'URL de déploiement est publique, c'est la seule barrière réelle.

*Conséquence toujours vivante :* toute nouvelle route sous `/api/` doit
commencer par `const denied = requirePin(req); if (denied) return denied;`.

**`.gitignore` durci** (`6234749`) pour protéger `.env.example` des règles que
`vercel link` ajoute automatiquement — sans quoi le fichier d'exemple disparaît
du dépôt sans que personne ne le remarque.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/app/api/session/route.ts` | créé — validation du PIN |
| `src/app/api/transcribe/route.ts` | créé — Groq Whisper |
| `src/components/BriefApp.tsx` | créé — orchestrateur d'écrans |
| `src/components/{Capture,Review,Settings}Screen.tsx` | créés |
| `src/components/{PinGate,TabBar,PhoneFrame}.tsx` | créés |
| `src/app/globals.css`, `layout.tsx`, `page.tsx` | refondus |
| `.gitignore`, `.env.example`, `package.json` | scaffold |

## Validations — passants / échoués / non lancés

- **Non lancés :** aucune suite de tests n'existait à cette date.
- **Vérifié à la main :** transcription de bout en bout via le micro.

## Blockers — ce qui bloque

Le micro exige un contexte sécurisé. `localhost` convient, une IP de LAN non —
ce qui interdit de tester depuis l'iPhone sans tunnel ou déploiement.

## Next — la prochaine action

Brancher la structuration LLM derrière la transcription, pour que la note dictée
devienne des tâches datées plutôt qu'un bloc de texte.
