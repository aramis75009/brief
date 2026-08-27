# Workflow chantiers front-end — Brief (2026-08-25)

Contexte : 7 points remontés depuis les captures d'écran de l'app (mobile "Capture" + vues desktop Calendrier/Kanban/Détail tâche/Graphe), à traiter avec gstack installé (`~/.claude/skills/gstack`) dans une session Claude Code ouverte sur ce repo.

**⚠️ Prérequis confirmé le 25/08 : gstack n'était pas installé.** `/investigate` et `/qa` n'existent ni en commande projet, ni en commande utilisateur, ni dans le plugin "everything-claude-code" déjà présent — ces commandes viennent uniquement de gstack. Sans lui, Claude Code retombe sur d'autres skills disponibles (ex. `superpowers:systematic-debugging`), ce qui peut dépanner pour un bug isolé mais ne donnera jamais `/design-shotgun`, `/design-html`, `/office-hours` ni `/plan-eng-review` — indispensables pour les chantiers 3, 4 et 5.

## Chantier 0 — Installer gstack (à faire avant tout le reste)

**Mise à jour (25/08, après investigation par Claude Code) : gstack v1.2.0 était déjà présent**, posé le jour même par `npx skills add` (copie d'archive symlinkée dans `~/.claude/skills/gstack`, sans `.git` — donc pas de `git clone` possible par-dessus, pas de `git pull` possible dessus non plus). Les ~60 sous-skills (`investigate`, `qa`, `design-shotgun`, `plan`, `ship`, `review`...) existent bien sur le disque en `SKILL.md`/`SKILL.md.tmpl` mais ne sont **pas enregistrées** tant que `./setup` n'a pas tourné — d'où `/investigate` et `/qa` invisibles dans l'autocomplétion malgré une install "présente".

La commande à lancer n'est donc plus le clone, juste :

```bash
cd ~/.claude/skills/gstack && ./setup
```

**Dépendance découverte au passage : `./setup` exige `bun`** — absent de la machine au moment du test (node et git étaient là, pas bun). Le script installe aussi Playwright + compile un binaire Chromium pour la validation visuelle (`/qa`). Garde-fou intégré : il ne remplace un dossier de skill existant que si son `SKILL.md` porte la bannière `<!-- AUTO-GENERATED from -->`, donc en théorie aucune des skills déjà installées n'est écrasée.

**Trois pièges rencontrés en le faisant tourner sur cette machine (Windows), à éviter la prochaine fois :**

1. **La version de bun n'est pas épinglée par défaut.** L'install "au fil de l'eau" (`curl bun.sh/install | bash`) pose la dernière version, pas forcément celle attendue par gstack. Épingler explicitement : `bash install "bun-v1.3.10"` (ou l'équivalent `BUN_VERSION=1.3.10` selon la méthode d'install choisie).
2. **L'installeur Windows de bun ne pose pas `bunx.exe`**, seulement `bun.exe` — `./setup` continue quand même et sort en `exit 0` sans avoir installé Chromium (échec silencieux). Fix : copier `bun.exe` en `bunx.exe` dans `~/.bun/bin` (bun se redispatche selon `argv[0]`).
3. **Lancer `./setup` depuis le bon chemin, celui du symlink, pas le chemin physique.** Le script détermine son dossier cible via le `pwd` logique de là où il tourne. Lancé depuis `~/.claude/skills/gstack` (même si c'est un lien vers une install ailleurs), il vise correctement `~/.claude/skills`. Lancé depuis le chemin physique réel (ex. `~/.agents/skills/gstack`), il installe tout là — invisible pour Claude Code. La commande de ce doc (`cd ~/.claude/skills/gstack && ./setup`) est correcte *à condition de vraiment se trouver sous ce chemin* avant de la lancer (`pwd` pour vérifier).

Vérifie ensuite dans Claude Code que `/design-shotgun` apparaît bien dans l'autocomplétion des commandes avant de lancer le chantier 3.

## Envoyer plusieurs chantiers d'un coup (sans rester devant l'écran)

**Option simple (une seule fenêtre Claude Code)** : colle les prompts des chantiers 2, 3, 4, 5 les uns après les autres dans la même session. Claude Code les traite dans l'ordre d'arrivée (le suivant ne démarre qu'une fois le précédent terminé) — donc aucun risque de conflit git, juste plus lent que du vrai parallèle.

**Option rapide (plusieurs fenêtres Claude Code)** : un `git worktree` par chantier pour un vrai travail en parallèle sans conflit, chacun sur sa branche :

```bash
cd chemin/vers/brief
git worktree add ../brief-kanban -b fix/kanban-dnd
git worktree add ../brief-calendrier -b design/calendrier
git worktree add ../brief-taskdetail -b design/task-detail
git worktree add ../brief-graphe -b design/graphe
```

Ouvre une session Claude Code dans chaque dossier et colle le prompt correspondant. Attention : chaque worktree est un checkout à part, sans `node_modules` — il faut relancer `npm install` dans chacun avant que `/qa` puisse lancer un vrai navigateur.

Chaque prompt ci-dessous a été adapté pour tourner **sans validation humaine intermédiaire** (choix de variante de design compris) puisque tu ne seras pas disponible — il s'arrête juste avant `/ship`/déploiement, pour que tu relises avant que quoi que ce soit parte plus loin.

## Principe du workflow

- **Un chantier = un message/une session Claude Code**, pas un seul gros prompt fourre-tout : gstack fonctionne en pipeline (Think → Plan → Build → Review → Test → Ship), le faire tourner sur 7 sujets en même temps rend le diff illisible et `/review` inefficace.
- **"Front-end design activé"** ne veut pas dire un réglage à cocher : ça veut dire qu'on passe par les commandes `/design-shotgun` → `/design-html` (au lieu de laisser Claude Code coder directement l'UI à l'aveugle) pour tout ce qui touche au visuel/layout. Les bugs purement fonctionnels (pas de refonte visuelle) passent par `/investigate` à la place.
- **Ordre recommandé** : d'abord les 2 bugs rapides (déminent le terrain, aucun risque de régression visuelle), puis les 3 chantiers design par taille croissante, le Graphe en dernier car c'est le plus gros morceau.

| # | Ordre | Chantier | Type | Fichier(s) principal(aux) |
|---|-------|----------|------|----------------------------|
| 1 | 1er | Animation waveform Chrome/Windows | Bug | `src/components/Waveform.tsx`, `src/lib/useRecorder.ts`, `src/components/CaptureSheet.tsx` |
| 2 | 2e | Drag & drop Kanban cassé | Bug | `src/components/desktop/DesktopKanban.tsx`, `src/components/desktop/KanbanCard.tsx` |
| 3 | 3e | Calendrier — chevauchement des événements | Design + logique | `src/components/desktop/DesktopCalendar.tsx` |
| 4 | 4e | Détail de tâche — refonte + flow étiquettes | Design | `src/components/desktop/DesktopTaskDetail.tsx` |
| 5 | 5e (le plus gros) | Graphe de dépendances — refonte + drag-to-connect | Design + feature | `src/components/desktop/DependencyGraph.tsx`, `src/lib/graph.ts` |

Une fois les 5 chantiers ship : lancer `/retro` pour capitaliser sur ce qui a marché/pas marché avant la prochaine vague.

**Précision trouvée le 25/08 (confirmée par CLAUDE.md du repo) sur les chantiers design (3, 4, 5) :** `frontend-design` n'est pas automatique, et CLAUDE.md la rend obligatoire avant toute décision visuelle. Séquence correcte : lecture de `DESIGN.md` → skill `frontend-design` (direction visuelle : typo, intention, cohérence avec le design system v1 déjà en prod) → puis le pipeline gstack `/design-shotgun` → `/design-html` (génération et comparaison des variantes). gstack ne remplace pas `frontend-design`, il vient après.

**Conflit non tranché, à régler plus tard :** CLAUDE.md recommande `superpowers:systematic-debugging` plutôt que `/investigate`, et `/code-review` plutôt que `/review`. Les prompts de ce doc utilisent volontairement `/investigate`/`/review` (gstack) pour cette vague de chantiers — décision reprise telle quelle par Claude Code le 25/08 (consigne du jour plus récente et explicite que CLAUDE.md). À la relecture des 5 chantiers, il faudra décider si CLAUDE.md doit être mis à jour pour aligner sur gstack, ou si gstack doit rester ponctuel et CLAUDE.md rester la référence par défaut.

---

## Chantier 1 — Animation waveform (bug, Chrome/Windows)

**Statut (25/08) : en cours sans gstack.** `/investigate` n'étant pas dispo, Claude Code a traité le prompt ci-dessous comme une consigne en langage naturel via `superpowers:systematic-debugging` (cause racine → correctif → validation visuelle Chromium). Ça reste une approche valable pour un bug isolé comme celui-ci — pas besoin de relancer une fois gstack installé, sauf si tu veux repasser par `/review` + `/qa` en plus pour la forme.

**Séquence gstack (si dispo)** : `/investigate` → fix → `/review` → `/qa`

```
/investigate
Sur Chrome Windows, les barres de la waveform dans l'écran de capture
(src/components/Waveform.tsx, monté depuis src/components/CaptureSheet.tsx)
restent figées pendant l'enregistrement au lieu de bouger avec le niveau
audio capté par src/lib/useRecorder.ts. [précise ici si ça marche sur
Mac/Firefox ou si c'est cassé partout]. Trouve la cause racine (probable :
Web Audio API / requestAnimationFrame / permissions micro spécifiques à
Chrome+Windows) et corrige. Termine par /qa pour valider visuellement
dans un vrai Chromium que l'animation tourne pendant un enregistrement.
```

*(Il manque une info pour que Claude Code cible juste : est-ce que ça marche sur d'autres navigateurs/OS ? À compléter avant d'envoyer.)*

---

## Chantier 2 — Drag & drop Kanban (bug)

**Séquence gstack** : `/investigate` → fix → `/qa`

```
/investigate
Dans le Kanban desktop (src/components/desktop/DesktopKanban.tsx et
KanbanCard.tsx), les cartes de la ligne "Non placées" ne peuvent pas être
glissées-déposées dans les colonnes En cours / Fait / À faire — le drop
ne fait rien. Identifie pourquoi (zone de drop non enregistrée, état non
mis à jour, lib de drag&drop mal branchée sur cette liste spécifique) et
corrige. Termine par /qa en testant le drag&drop réel dans le navigateur.

Je ne serai pas devant l'écran pendant que tu travailles : une fois /qa
validé, reste sur une branche locale (ne push pas, ne déploie pas, pas
de /ship) — je relirai et je déciderai de la suite à mon retour.
```

---

## Chantier 3 — Calendrier : chevauchement des événements (design + logique)

**Séquence gstack** : `/design-shotgun` → (tu choisis une variante) → `/design-html` → `/plan-eng-review` → build → `/review` → `/qa`

```
/design-shotgun
Dans la vue Calendrier desktop (src/components/desktop/DesktopCalendar.tsx),
les événements qui tombent sur le même créneau horaire se superposent
au lieu de se répartir côte à côte (voir capture jointe : mercredi 15h/16h
et jeudi 16h montrent des blocs empilés illisibles). Génère plusieurs
variantes de gestion des chevauchements façon Google Calendar/Fantastical
(colonnes proportionnelles à la largeur disponible, léger décalage,
indicateur "+N autres" si trop d'événements sur le créneau). Garde la
charte visuelle actuelle (fond clair, blocs colorés par catégorie/tag).

Je ne serai pas disponible pour choisir entre les variantes : choisis
toi-même la plus proche de Google Calendar (colonnes proportionnelles,
lisible même avec beaucoup d'événements) et enchaîne directement sur
/design-html, /plan-eng-review, l'implémentation, /review puis /qa sans
attendre ma validation à chaque étape. Reste sur une branche locale, pas
de /ship ni de déploiement.
```

---

## Chantier 4 — Détail de tâche : refonte + flow étiquettes (design)

**Séquence gstack** : `/design-shotgun` → `/design-html` → `/review` → `/qa`

```
/design-shotgun
Le panneau de détail de tâche desktop (src/components/desktop/DesktopTaskDetail.tsx)
est fonctionnel mais visuellement plat et dense (voir captures jointes de
l'état actuel). Prends comme référence de hiérarchie visuelle une carte
Trello (capture jointe) : étiquettes visibles en haut, actions rapides
groupées, description qui respire. Concentre-toi surtout sur le flow de
création/ajout d'étiquette, qui est actuellement un popup mal intégré au
milieu de l'écran (voir capture) — propose un composant d'étiquette
inline plus fluide (picker de couleur + nom en un seul geste). Génère
plusieurs variantes.

Je ne serai pas disponible pour choisir : sélectionne toi-même la
variante la plus proche de la référence Trello en termes de hiérarchie
visuelle, puis enchaîne directement sur /design-html (en gardant toutes
les fonctionnalités actuelles : sous-tâches, liaison de tâches, échéance,
projet, historique), /review et /qa sans attendre ma validation. Reste
sur une branche locale, pas de /ship ni de déploiement.
```

---

## Chantier 5 — Graphe de dépendances : refonte + drag-to-connect (design + feature, le plus gros)

**Séquence gstack** : `/design-shotgun` → `/design-html` → `/plan-eng-review` (nouvelle interaction + modèle de données) → build → `/review` → `/qa`

*(le cadrage `/office-hours` est déjà fait ci-dessous dans le brief — normalement il pose des questions avant de maquetter, mais je ne serai pas là pour y répondre, donc le brief est pré-rempli et on saute direct à `/design-shotgun`.)*

```
/design-shotgun
Je veux repenser la vue Graphe desktop (src/components/desktop/DependencyGraph.tsx,
logique de données dans src/lib/graph.ts). Aujourd'hui : 42 tâches
s'affichent empilées verticalement sans qu'on voie aucune connexion,
c'est illisible. Je veux (1) un layout qui étale les nœuds intelligemment
au lieu de les empiler (inspiration : React Flow, Miro, Linear roadmap
graph), (2) des points d'ancrage sur les bords de chaque tuile pour
tirer un lien à la souris et créer une dépendance entre deux tâches,
(3) que les dépendances existantes soient visuellement claires
(couleur/style de connecteur selon l'état prête/bloquée/terminée, cf
légende actuelle). Génère plusieurs variantes de layout.

Je ne serai pas disponible pour choisir ni répondre à des questions de
cadrage : choisis toi-même la variante la plus lisible et enchaîne
directement sur /design-html, puis /plan-eng-review — c'est la partie la
plus délicate techniquement (drag-to-connect entre deux nœuds,
création/suppression de dépendance en base, gestion des cycles), lis
l'existant dans src/lib/graph.ts et graph.test.ts avant de proposer un
nouveau modèle pour ne rien casser. Implémente, /review, puis /qa en
testant la création d'un lien de bout en bout. Reste sur une branche
locale, pas de /ship ni de déploiement — je validerai à mon retour.
```

---

## Notes

- Pour les chantiers design (2, 3-5, Graphe), pense à joindre les captures d'écran correspondantes directement dans le message Claude Code (drag & drop dans le terminal ou chemin de fichier) — sans image, `/design-shotgun` travaille à l'aveugle sur la description texte seule.
- Le fichier `src/components/desktop/DependencyGraph.tsx` fait déjà 38 Ko et `src/lib/graph.ts` a déjà des tests (`graph.test.ts`) : ce n'est pas un composant à créer de zéro, demande explicitement à Claude Code de lire l'existant avant de proposer un nouveau layout, pour ne pas casser le modèle de données déjà en place.
