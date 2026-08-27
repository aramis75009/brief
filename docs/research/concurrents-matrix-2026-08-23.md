# Matrice concurrents — Brief desktop

> Scraping réalisé le 2026-08-23 par Hermes Agent.
> Sources : pages features officielles + reviews 2026.

## Matrice fonctionnalités → pertinence Brief

| Fonctionnalité | Asana | Monday | Trello | ClickUp | Notion | Todoist | **Pertinence Brief** |
|---|---|---|---|---|---|---|---|
| **Vues multiples (List, Kanban, Calendrier, Timeline, Table)** | ✅ | ✅ | ✅ (Premium) | ✅ (11+ vues) | ✅ | ✅ (List+Board) | ⭐⭐⭐ Brief a déjà Dashboard+Calendrier, manque Kanban+Table+Timeline |
| **Kanban / Board (drag & drop)** | ✅ | ✅ | ✅ (core) | ✅ | ✅ (modèle) | ✅ (Board) | ⭐⭐⭐ Demande explicite d'Aramis |
| **Timeline / Gantt** | ✅ | ✅ | ✅ (Premium) | ✅ | ❌ | ❌ | ⭐ Peut-être plus tard |
| **Calendrier** | ✅ | ✅ | ✅ (Premium) | ✅ | ✅ | ✅ | ✅ Brief l'a (buggué, à refaire) |
| **Table / Spreadsheet view** | ✅ | ✅ (core) | ✅ (Premium) | ✅ | ✅ (core) | ❌ | ⭐⭐ À explorer pour Brief |
| **Sous-tâches / Checklists** | ✅ | ✅ | ✅ (Premium) | ✅ | ✅ | ✅ | ✅ Brief l'a (parseur LLM) |
| **Priorités** | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ (p1-p4) | ✅ Brief l'a mais pas affichées (à recâbler) |
| **Custom fields / Étiquettes** | ✅ | ✅ (core) | ✅ (Premium) | ✅ (core) | ✅ | ✅ (labels) | ⭐⭐ À explorer pour Brief |
| **Automatisations / Règles** | ✅ | ✅ | ✅ (Butler) | ✅ | ❌ | ❌ | ⭐⭐ Brief a déjà le cron + CalDAV sync |
| **AI — résumé de projet/tâche** | ✅ | ✅ | ✅ | ✅ (Brain²) | ✅ | ❌ | ✅ Brief a déjà l'assistant IA (à enrichir) |
| **AI — détection de risque/retard** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ⭐⭐ Brief pourrait le faire (données dispo) |
| **AI — génération de tâches** | ✅ | ✅ | ✅ (board généré) | ✅ | ✅ | ❌ | ✅ Brief le fait (parseur vocal) |
| **AI — suggestions prochaines étapes** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ⭐⭐⭐ Gros potentiel pour Brief |
| **Captation rapide (email, Slack, Teams)** | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ (email) | ✅ Brief a déjà /api/capture |
| **Capture vocale** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Assist) | ✅ Brief l'a (avantage unique) |
| **Rappels / Notifications push** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Brief l'a (Web Push) |
| **Récurrence / Tâches répétitives** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ Brief l'a (RRULE) |
| **Templates de projet** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ⭐ À réfléchir pour Brief |
| **Goals / Objectifs / OKR** | ✅ | ❌ | ❌ | ✅ (Goals) | ❌ | ❌ | ⭐ Plus tard |
| **Portefeuille / Vue globale multi-projets** | ✅ | ✅ | ✅ (Premium) | ✅ | ✅ | ❌ | ⭐⭐ Brief a déjà l'overview |
| **Suivi de temps** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ⭐ Pas pertinent pour Brief (perso) |
| **Collaboration / Commentaires** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ Brief = solo |
| **Gestion d'équipe / Assignation** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ Brief = solo |
| **Carte / Map view** | ❌ | ❌ | ✅ (Premium) | ❌ | ❌ | ❌ | ❌ Pas pertinent |
| **Whiteboard** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ Pas pertinent |
| **Mode hors-ligne** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ⭐ Brief est PWA, déjà partiellement offline |

## Ce qui se détache pour Brief

### ⭐⭐⭐ Priorité haute (aligné avec la vision d'Aramis)

1. **Vue Kanban** — demandée explicitement. Trello le fait en core, tous les autres l'ont. Brief a déjà les données (items + projects + status), il manque la vue colonnes + drag & drop.

2. **Vue Table / Spreadsheet** — Monday l'a en core, ClickUp aussi. Une vue tabulaire (titre, projet, échéance, statut, priorité) filtrable et triable serait très utile sur desktop.

3. **AI — suggestions de prochaines étapes** — Asana et ClickUp le font. Brief a déjà l'assistant IA, les données des tâches/RDV/projets. L'IA pourrait dire "tu devrais faire X avant Y", "cette tâche traîne depuis 3 jours", "tu as 5 tâches en retard sur Frip & Trend".

### ⭐⭐ Priorité moyenne

4. **Custom fields / Étiquettes** — sur des tâches (ex: "urgent", "en attente", "bloqué"). ClickUp et Monday le font bien. Pour Brief : tags simples sur les items.

5. **AI — détection de retard** — signaler les tâches qui traînent, les projets en stagnation. Brief a déjà `overdueItems()` dans le dashboard, l'IA pourrait aller plus loin.

6. **Automatisations** — règles du type "si une tâche est en retard de 3 jours, notifie-moi". Brief a déjà le cron, on pourrait ajouter des règles simples.

7. **Vue Timeline** — moins prioritaire que Kanban, mais utile pour visualiser les chevauchements de projets.

### ⭐ À réfléchir

8. **Templates de projet** — pour des projets récurrents (ex: "lancement collection Frip", "soutenance Web@cadémie")

9. **Goals / Objectifs** — lier les tâches à des objectifs hebdomadaires/mensuels

10. **Table view** — vue spreadsheet filtrable

## Ce que Brief a déjà (et que les concurrents n'ont pas)

- **Capture vocale → LLM → structuration automatique** — aucun concurrent ne le fait (sauf Todoist Assist, basique). C'est l'avantage unique de Brief.
- **Sync CalDAV bidirectionnelle avec Apple Calendar** — aucun concurrent.
- **PWA installée sur iPhone** — la plupart sont des apps natives.

## Recommandation — par où commencer

1. **Kanban** (demande explicite d'Aramis) — board par projet ou global, colonnes = statuts (À faire / En cours / Fait / En retard), drag & drop
2. **Vue Table** — filtrable, triable, vue d'ensemble de toutes les tâches
3. **AI suggestions** — enrichir l'assistant IA existant avec des suggestions proactives
4. **Tags / Étiquettes** — simple, sur les items