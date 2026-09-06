# Handoff — Refonte Brief façon Asana (session 06/09/2026)

## Mission
Rendre l'onglet Brief « Tâches et rendez-vous » quasi identique à Asana :
- UN onglet regroupant plusieurs vues : Liste, Tableau (kanban), Chronologie, Calendrier (+ Aperçu, Tableau de bord)
- Supprimer les onglets Brief « Calendrier » et « Kanban » actuels (remplacés par les vues)
- Améliorer l'onglet Objectifs et l'onglet Graph en s'inspirant d'Asana

## Compte Asana
- email: aramis.begnene@gmail.com — mdp: /opt/data/state/asana_creds.txt (chmod 600)
- Workspace: 1218206794277729, Projet « Aramis : premier projet » 1218234727323378 (essai Advanced, 14j)
- URLs vues: .../project/1218234727323378/{list,board,timeline,calendar}
- Login nouvel appareil = magic link OBLIGATOIRE (mdp refusé, « for your account's security »)

## État navigateur (VPS)
- Session Asana CONNECTÉE le 06/09 ~20:55 via magic link (2e tentative — 1er token consommé)
- Navigateur: gstack browse CLI ($B = /opt/data/.claude/skills/gstack/browse/dist/browse, CONTAINER=1, bun dans PATH)
- browser_exec ne fonctionne PAS sur cet hôte → toujours gstack
- Screenshot déjà pris: /opt/data/images/asana_list_view.png

## Ce qui est déjà observé (vue Liste)
- Onglets projet: Aperçu, Liste, Tableau, Chronologie, Tableau de bord, Calendrier, + (réorganisables)
- Toolbar vue: + Ajouter une tâche, Filtrer, Trier, Regrouper, Options, recherche
- Colonnes: Nom (checkbox ronde), Responsable (avatar), Échéance (plages relatives « Aujourd'hui – sep 8 »), Priorité (Faible/Moyenne/Élevée colorée), Statut (Dans les délais/À risque/En retard), + colonne custom
- Sections: À faire / En cours / Terminé (workflow par défaut, dépliables, « Ajouter une section »)
- 3 tâches de test: Tâche 1 (AB, Aujourd'hui–8 sep, Faible, Dans les délais), Tâche 2 (AB, 7–9 sep, Moyenne, À risque), Tâche 3 (non assignée, 8–10 sep, Élevée, En retard)
- Onboarding modal actif: « Sélectionnez une vue par défaut » (Liste/Tableau/Calendrier/Chronologie + Continuer)

## Reste à explorer (prochaine session)
1. Fermer la modal onboarding, explorer chaque vue: Tableau (drag & drop cartes), Chronologie (Gantt, drag barres, dépendances), Calendrier, Aperçu, Tableau de bord
2. Panneau détail tâche (clic sur tâche): sous-tâches, dépendances, commentaires, pièces jointes, champs custom
3. Créer/déplacer des tâches de test (projet vierge, aucun risque), tester tri/regroupement/filtres
4. Captures + structure DOM de chaque vue → spec de rendu
5. Rattacher au design system Brief existant (skill brief-codebase-conventions, refs design-system + desktop-tasks-rdv-*), rédiger la spec de la refonte

## Conventions Brief (rappel)
- Repo: /opt/data/Projets/brief — GitHub = vérité, prod = main sur VPS (/docker/brief)
- Commits anglais (type: sujet), ligne Agent dans handoff
- Boutons morts → câbler une vraie feature, ne pas supprimer
- QA sans creds: SHA, /app/VERSION, HTTP, DOM hydraté (Chromium headless gstack), API 401/405/404