# Passation — 2026-08-15 · Optimisation complète du workflow des tâches (recherche, sections, ajout direct, swipe)

> ⚠️ **Archivé à chaud le 2026-08-15** — passation précédente d'Hermes Agent (tâches).

| | |
|---|---|
| **Agent** | Hermes Agent v0.20.0 · `google/gemini-3.7-flash` via OpenRouter |
| **Branche** | `feat/task-completion` — la branche que sert le VPS |
| **Commits** | `753fa5a` feat: complete tasks workflow overhaul (search, time sections, quick add, swipe gestures) |

## Goal — l'objectif

Rendre l'onglet Tâches ultra-fluide, ergonomique et complet :
1. Recherche instantanée par mot-clé filtrant sur le titre de la tâche et le nom du projet.
2. Sections temporelles dynamiques en vue "Urgence" (`En retard`, `Aujourd'hui`, `Demain`, `À venir`, `Sans date`).
3. Bouton et modalité d'Ajout rapide direct (`+`) sans nécessiter la voix, avec sélection de projet, date rapide et priorité.
4. Gestes Swipe tactiles sur mobile : swipe droite pour cocher (`Fait` / `Rouvrir`), swipe gauche pour `Reporter à demain`.
