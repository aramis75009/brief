# TODOS — Brief

Registre du travail différé. **Rien de différé ne vit ailleurs** (ré-écrit
le 2026-08-29 lors du grand ménage, sections « ✅ FAIT / DÉPLOYÉ » archivées
dans `docs/handoffs/`).

---

## P0 — En cours (branches actives)

### Landing page SaaS multi-utilisateur

**Quoi :** Brief va devenir un SaaS multi-utilisateur. Une preview d'accueil
est faite dans `docs/landing/multi-user-v1.html` (style MyFlip, tokens
fidèles au design system v1, rail vocal en carte phare). **À retravailler**
avant mise en ligne.

- **Prix 0/6/12 € = placeholders** à trancher avec Aramis.
- **CTA non branché** sur le futur signup Supabase multi-user.
- **Mockup téléphone** à actualiser une fois l'app stabilisée.
- **Découpage** en composants Next.js + route `/` marketing (non livré).
- **Dark mode + SEO/perf** non traités.
- Règle : la landing est un **modèle de travail**, pas une page finie. Voir
  `docs/landing/README.md` pour la checklist complète.

### Pivot multi-utilisateur Brief

**Quoi :** chaque utilisateur crée son compte et a **son** Brief (dictées,
tâches, idées propres, sans partage par défaut).

- Auth Supabase **déployée** (26/08) sur la prod actuelle.
- Les modèles de données (`store.ts`, `data/items.json`) sont mono-user :
  migration à prévoir (table `user_id` ou schéma par utilisateur).
- Voir `DECISIONS.md` (2026-08-26) pour le design complet.

---

## P1 — Desktop (livrée V1, en recettage)

### Recettage desktop — retirer les écarts Claude Design

- **Calendrier desktop** (`DesktopCalendar.tsx`) : affichage des événements
  sur **voies** (pas de superposition). Livré, en recettage par Aramis.
  Refonte complète à venir (décision du 26/08, livrable Claude Design
  attendu).
- **Fiche tâche desktop** (`DesktopTaskDetail.tsx`) : livrée et recettée,
  refonte Claude Design à venir (décision du 26/08).
- **Kanban desktop** : les tags `unplaced` apparaissent parfois dans la
  colonne mauvaise — `DesktopKanban.tsx:399` filtre par projet sans tenir
  compte du `columnId` (à vérifier en recettage).
- **Teintes iOS saturées** (`DesktopTaskDetail.tsx:40`) : 10 couleurs
  saturées (`#FF3B30`…) apparaissent dans la liste d'affectation projet —
  doivent être remplacées par les teintes `p1–p8` du design system.
- **Saisie d'idées par le clavier** dans `CaptureBar` desktop : fonctionne,
  à recetter.

### Bugs desktop ouverts (de la session 2026-08-25)

- **Bouton « Rien à structurer »** reste visible sur une dictée vide —
  masqué côté mobile, à faire aussi sur desktop.
- **`<button>` imbriqué** dans `TodayRow` / `RowCheckbox` : erreur HTML
  (hydration React), à corriger quand on y touche.

---

## P1 — Mobile (iPhone PWA)

### Micro et raccourci

- **Micro iOS de la PWA** reste capricieux au premier accès — la demande de
  permission ne s'affiche pas toujours. Workaround actuel : saisie clavier.
  À reprendre proprement (raccourci iOS dédié fonctionne).
- **Raccourci iOS sur bouton Action** : fonctionne, reste à fiabiliser
  (network timeout + notification silencieuse en cas d'échec).

### Workflow Telegram ↔ Hermes ↔ Brief

**Quoi :** brancher les interactions Telegram sur les items Brief (récap
matinal n8n déjà en prod) pour créer / modifier des items depuis Telegram.
Stade : design écrit (`docs/research/`), pas de code.

---

## P2 — Prévu, pas urgent

### Stocker les enregistrements vocaux

**Annoncé par Aramis le 2026-08-19** comme le prochain chantier. Garder le
fichier audio attaché à l'item (`data/audio/`), pour qu'il puisse réécouter
la dictée. Non chiffré.

### Workflow conversationnel n8n

Évolutions du hub d'automatisations n8n (récap 8h30 + 18h30 déjà en prod) :
intégration Brief native (pas uniquement digest), réponses aux questions
Brief, notifications ciblées.

### Dette connue

Leçons du passé à garder sous la main (à consulter avant de coder sur un
sujet proche) :

- **CalDAV flottant** : `docs/handoffs/2026-08-19-caldav-floating-dtstart.md`
  — un `DTSTART` ICS sans `Z` ni tirets a crashé toute l'app le 19/08. Le
  fix est en 3 couches dans `store.ts` + `caldav.ts`. **Toujours tester
  la donnée, pas seulement l'API.**
- **`<button>` imbriqué** dans `TodayRow` — voir P1.
- **Drag & drop Kanban** : recetté partiellement, à vérifier edge cases.
- **Bouton mort → câbler une vraie feature**, jamais supprimer (règle
  Aramis).
- **Traefik `exposedbydefault=false`** : vérifier les labels si le site
  ne répond pas.

### « Retiré — ne pas réintroduire »

- **`BRIEF_PIN` / `x-brief-pin` / `requirePin()`** : supprimés le 26/08,
  ne pas réintroduire. La garde est `requireSession()` (Supabase Auth JWT).
- **Ancien système corail / General Sans** : supprimé le 20/08, ne pas
  ressusciter.
- **Branche `feat/ui-redesign-claude`** : absorbée puis supprimée à la fin
  août — ne pas la recréer.

---

## P3 — Recherches ouvertes

### Roadmap « Asana personnalisé » (vision Brief)

Vision exprimée par Aramis : un Asana perso — **Kanban, tags, sous-tâches,
dépendances visuelles (graphe nœuds type n8n)**, dark mode à la fin. Le
socle Kanban / tags / sous-tâches existe déjà sur desktop. Non chiffré,
discussion à avoir avec Aramis avant engagement.

### Apprentissage des corrections de destination

Si Aramis corrige souvent une dictée vers `task` vs `idea` (ou inverse),
Brief devrait apprendre la préférence par contexte.

### Rappels déclenchés par un lieu

Geofencing iOS. Non prévu dans la roadmap actuelle, complexité non chiffrée.

### Scraper les concurrents (Asana, Monday, Trello)

Analyse comparative des features desktop pour prioriser la roadmap. Pas
commencé.

---

## Comment utiliser ce registre

- **Ne pas y déplacer de choses finies.** Archiver dans `docs/handoffs/`.
- **Un TODO sans P0/P1/P2/P3 n'existe pas ici.**
- **Si tu termines un TODO**, archive-le dans une passation `docs/handoffs`
  et retire la section d'ici.
- **Ne pas mettre en P0 plus de 2 sujets à la fois** — sinon rien n'est
  prioritaire.
