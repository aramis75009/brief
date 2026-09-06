# Asana — Inventaire exhaustif (scraping réel + web, 06/09/2026)

> Objectif : refonte de Brief « le plus proche possible d'Asana avec nos
> particularités » (capture vocale, Apple Calendar, rappels, dashboard).
> Sources : compte Asana réel d'Aramis (scraping UI connecté, 8 screenshots)
> + ~18 pages officielles asana.com (features, pricing, IA, raccourcis).

## Ce qu'est Asana aujourd'hui (2025-2026)

« OS des équipes humain-agent » (*Agentic Work Management*). 5 produits :
Agentic Work Management (cœur), Service Management, Client Management,
Command (dev), StackAI. 170 000+ organisations, 200+ intégrations.

## 1. Navigation structurelle (observée dans l'UI réelle)

- **Rail gauche d'univers** : Travail · Agents · Stratégie · Connaissances ·
  Personnes · plus
- **Sidebar Travail** : Accueil · Boîte de réception (badge notif) ·
  Mes tâches · Projets · Portefeuilles · projets épinglés
- **Top bar** : bouton **« + Créer »** (CTA orange/corail) · recherche
  centrale (Ctrl+K) · aide · avatar
- **Menu Créer** : Tâche · Projet · **Page** · **Message** · Portefeuille ·
  **Objectif** · **AI Teammate** · Inviter
- **Design observé** : sidebar anthracite #2D2D2D, fond #F5F5F5, accent
  corail #F06A50, bleu #1E91D6 pour sélection/actif, cartes blanches
  radius ~8px, ombres très subtiles, Inter-like, densité aérée.

## 2. Home (Accueil) — dashboard personnalisable

- Salutation + date, sélecteur de période (« Ma semaine »), compteurs
  (tâches terminées, collaborateurs), bouton **Personnaliser**
- **Widgets drag-and-drop** : Mes tâches (onglets À venir/En retard/
  Terminées), Projets récents, Tâches que j'ai attribuées, Personnes
  (en retard/terminées/à venir par collab), bloc-notes privé, brouillons
  de commentaires, raccourcis récents, **choix de fond d'écran**
- Cartes d'onboarding intégrées (tutos 3-15 min)

## 3. My Tasks (Mes tâches) — le cœur personnel

- **Sections temporelles par défaut** : Récemment attribuées · À faire
  aujourd'hui · À faire la semaine prochaine · À faire plus tard
  (+ sections custom, drag-and-drop)
- **Formats** : Liste · Tableau (Kanban) · Calendrier · Tableau de bord ·
  Fichiers · **+** (ajouter une vue)
- **Toolbar** : + Ajouter une tâche · Filtrer · Trier · Regrouper ·
  Options · loupe
- **Colonnes** : Nom · Échéance · Collaborateurs · Projets · Visibilité
  des tâches · **+** (custom fields)
- En Kanban, « Mes tâches » = **colonnes temporelles** (pas des statuts)
- **Règles dans My Tasks** : tri automatique par section selon la due date

## 4. Projet — vues multiples d'un même contenu

| Vue | Points clés |
|---|---|
| **Liste** | Sections custom, colonnes tableur (somme/moyenne/count) |
| **Tableau (Board)** | Colonnes = sections/étapes ; cartes : checkbox, titre, badge projet, échéance, assigné, sous-tâches |
| **Calendrier** | Vue semaine (DIM→SAM), tâches = **bandes horizontales qui s'étirent** sur leur plage, drag = change l'échéance, + Ajouter une tâche par jour, vues Jour/Semaine/Mois |
| **Tableau de bord** | Widgets : **KPI cards** (compteurs géants filtrables), **bar chart** (par section, par projet), **donut** (par statut), **aire/ligne** (achèvement au fil du temps) ; + Ajouter un widget ; Personnaliser (réagencer/redimensionner) ; filtre par widget ; charts **cliquables** (drill-down) |
| **Fichiers** | Pièces jointes de toutes les tâches du projet |
| **Timeline/Gantt** | Payant (Starter+) : décalage en cascade, **dépendances visualisées**, blockers |
| **Workload** | Charge par personne (tâches/heures/points), barre rouge surcapacité — payant |

Jusqu'à **50 onglets sauvegardés** par projet ; vue par défaut par membre.

## 5. Fiche tâche (observée en vrai)

- Header : **Marquer comme terminée** (coche) · avatar assigné · Partager ·
  👍 like · 🔗 lien · **... menu** · ⛶ plein écran (focus mode)
- Bandeau de visibilité (« Cette tâche est visible par : Mon espace de
  travail »)
- **Titre éditable grand format**
- Champs : Responsable · Échéance (jour ou **période**) · **Dépendances**
  (« Ajouter des dépendances ») · Projets (multi-homing jusqu'à 20
  projets, sync auto)
- Dans le contexte projet : **Priorité** (badge « Moyenne ») et **Statut**
  (badge « À risque »)
- **Description** riche formatée (« En quoi consiste cette tâche ? »)
- **Sous-tâches** (+, tri/filtre)
- **Commentaires** (@mentions, followers notifiés, hearts)
- Approvals (approver/reject/request changes) — payant

## 6. Tâches — modèle de données

- 1 assigné unique (responsabilité claire) ; multi-homing (1 tâche → 20
  projets, un seul enregistrement) ; récurrences via date picker ;
  tags transverses ; followers ; périodes (travail continu) vs dates.

## 7. Organisation

- **Sections** custom partout (drag-and-drop)
- **Custom Fields** (payant) : **17 types** (texte, nombre, date, select,
  multi-select, personnes, **formule calculée**), 100 champs/projet,
  16 couleurs, bibliothèque réutilisable, visibles dans My Tasks,
  dashboards, workload, API
- **Project brief** (rôles, ressources, contexte) ; icône de projet
- **Templates** : 80+ prêts + conversion projet→template en un clic ;
  rôles de projet, **dates dynamiques relatives**, skip week-ends
- **Portefeuilles** (payant) : projets groupés, santé en un coup d'œil,
  roll-ups, timeline inter-projets, portfolios imbriqués
- **Status Updates** : On track/At risk/Off track/On hold/Complete +
  charts drag-and-drop + rappels programmés (J-1) + IA qui rédige

## 8. Automatisation (payant sauf mention)

- **Rules** : builder trigger→actions multiples ; triggers : tâche
  ajoutée, due date proche/dépassée, soumission form, changement de
  champ, tâche débloquée, changement de section ; actions : assigner,
  déplacer de section, changer date, MAJ custom field, commenter,
  email/Slack, créer ticket Jira, demander approbation, rappels ;
  journal d'activité ; règles **dans My Tasks aussi**
- **Forms** : champs requis, pièces jointes, branding, embed web ;
  soumission → **tâche auto-créée** ; routage vers sections par règles ;
  logique conditionnelle (Advanced)
- **AI Studio** (voir IA)

## 9. IA — Agentic Work Management

Partenaires OpenAI + Anthropic. Aucun entraînement sur données client.

- **AI Studio** (no-code) : workflows IA avec 9 capacités — **Check**
  (complétude/doublons), **Classify** (catégorisation/scoring/SLA),
  **Route** (owner/étape), **Alert** (risques/blockers), **Report**
  (roll-ups/résumés), **Research** (docs/web), **Create** (briefs),
  **Integrate**, **Translate** ; branching + approbation humaine
- **AI Teammates** (add-on) : 30 agents pré-construits (Campaign Brief
  Writer, Status Reporter, Workflow Optimizer, Bug Investigator…) +
  agents custom en langage naturel (rôle, permissions) ; **audit trail,
  chaque action réversible** ; mémoire Work Graph
- **Asana Dash** (« AI Chief of Staff ») : **brief matinal automatique**
  (blockers, décisions en attente, priorités), questions en langage
  naturel, recommande la prochaine action, délègue aux AI Teammates
- **AI Connectors/MCP** : accès depuis ChatGPT/Claude/Gemini/Copilot
- IA embarquée : suggère statut, rédige status updates, smart goals

## 10. Raccourcis clavier (extraits clés)

- `Tab+Q` création rapide · `Tab+D` due date · `Tab+M` m'assigner ·
  `Tab+↵` détails · `Tab+S` sous-tâches · `Tab+P` ajouter au projet ·
  `Tab+T` tag · `⌘/Ctrl+↵` compléter · `Tab+X` focus mode
- `Tab+Z` My Tasks · `Tab+I` Inbox · `Tab+H` Home · `Tab+/` recherche ·
  `Tab+O` replier sidebar · `⌘/` cheatsheet

## 11. Modèle éditorial/UX à retenir

- **Un contenu, N vues** : le même projet bascule Liste/Board/Calendrier/
  Dashboard/Fichiers sans duplication — chaque vue = un onglet
- **Personnalisation par widgets** : Home et Dashboards sont des grilles
  de cartes réagencables
- **Filtre/Trier/Regrouper/Options** : barre standard au-dessus de chaque
  liste
- **Onboarding intégré** : cartes tuto dans le flux
- **Sections temporelles** : l'organisation par défaut est le TEMPS, pas
  le statut (dans My Tasks)

## 12. Ce que Brief a déjà et qu'Asana n'a pas (le moat)

- **Capture vocale → Whisper → LLM → structuration auto** (Asana n'a
  rien d'équivalent natif)
- **Sync CalDAV bidirectionnelle Apple Calendar** (source de vérité
  horaires)
- **Web Push depuis un serveur possédé** (PWA installable)
- **Graphe de dépendances interactif** (n8n-style) — Asana les montre
  en Gantt seulement

## 13. Traduction pour Brief — les chantiers à prévoir

1. **Structure navigation** : sidebar univers (rail) + Accueil/Boîte de
   réception/Mes tâches/Projets/Portefeuilles
2. **Un projet = N vues onglets** (Liste, Tableau, Calendrier, Dashboard)
   — le modèle d'onglets sauvegardés
3. **Mes tâches avec sections temporelles** (Aujourd'hui/Demain/Cette
   semaine/Plus tard) + toolbar Filtrer/Trier/Regrouper
4. **Home à widgets drag-and-drop** + compteurs de période
5. **Dashboard projet** : KPI cards + charts (bar/donut/ligne) filtrables
6. **Fiche tâche** : bandeau visibilité, priorité/statut en badges,
   dépendances, sous-tâches, description riche, focus mode
7. **Priorités + Statuts** choisis par l'utilisateur (Asana les affiche —
   Brief les invente via LLM aujourd'hui)
8. **Raccourcis clavier** (Tab+Q, Tab+D…)
9. **Règles d'automatisation simples** (« si en retard de 3 jours →
   notifie »)
10. **IA** : brief matinal (Dash-like), suggestions de priorisation,
    rédaction de résumés

## Screenshots (UI réelle, compte Aramis)

`/opt/data/brief-preview/asana-01-home.png` → `asana-09-menu-creer.png`
(Home, Mes tâches Liste, Liste projet, Kanban, Calendrier, Dashboard,
Fichiers, fiche tâche, menu Créer)