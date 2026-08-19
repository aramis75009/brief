# Passation — 2026-08-15 · Dates en langage naturel coloré, design priorités et synthèse de tâches

> ⚠️ **Archivé à chaud le 2026-08-15** — passation précédente d'Hermes Agent (dates relatives et synthèse).

| | |
|---|---|
| **Agent** | Hermes Agent v0.20.0 · `google/gemini-3.7-flash` via OpenRouter |
| **Branche** | `feat/task-completion` — la branche que sert le VPS |
| **Commits** | `c535d4e` feat: natural language relative due dates, redesigned priorities and overdue/today summary counters |

## Goal — l'objectif

Améliorer la lisibilité et la fluidité visuelle de l'onglet Tâches sur Brief :
1. Afficher les dates d'échéance en langage naturel dynamique (« Aujourd'hui », « Demain », « Après-demain », « Hier » / retard) avec sémantique de couleur (`formatRelativeDue`).
2. Rendre les badges de priorité plus design, précis et lisibles (`p1 · Urgent`, `p2 · Élevé`, `p3 · Normal`, `p4 · Basse`).
3. Ajouter une barre de synthèse compacte en tête d'écran avec badges d'alerte pour les tâches en retard et du jour.
