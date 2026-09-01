# Compte agent de recette — login authentifié sans navigateur d'Aramis

**Créé le 2026-09-01** (déploiement v1.2.0.0, lot 1 multi-utilisateur).
Tout agent (Hermes, Claude Code, Codex, ou tout autre LLM outillé) peut se
connecter à la prod pour la **recette authentifiée** : voir l'app comme un
utilisateur, cliquer les écrans, tester le drag & drop, vérifier un fix visuel.

## Règle absolue

**Ce compte a son propre store, cloisonné par la v1.2.0.0.** Il ne contient et
ne contiendra QUE des données de test créées par les agents. Ne jamais chercher
à lire/modifier les données d'Aramis avec ce compte — c'est impossible par
conception (`storeForUser(userId)`), et c'est le but.

## Où sont les credentials

Dans **`.env.local`** à la racine du repo — fichier **local, jamais commité**
(`.env.*` gitigné) :

```
BRIEF_AGENT_EMAIL=…        # agent.brief@aramis.local
BRIEF_AGENT_PASSWORD=…     # mot de passe généré, voir .env.local
BRIEF_AGENT_USER_ID=…      # 41c52c5b-f6a8-4659-bbed-70e7f9350458
```

Chaque machine hôte a le sien : ce repo local (Hermes/VPS) et le clone Mac de
Claude Code. Si `.env.local` n'existe pas ou ne contient pas ces clés, demander
à Aramis — ne JAMAIS mettre les valeurs dans un fichier commité, un message
Telegram/WhatsApp, ou une PR (repo public).

## Comment se connecter — deux méthodes

### ❌ Bearer token brut : NE MARCHE PAS

Les routes `/api/*` valident la session via les **cookies** `@supabase/ssr`
(`getClaims()` lit le cookie, pas le header). Un `Authorization: Bearer <jwt>`
Supabase répond **401 « Session invalide ou expirée »** même avec un jeton
valide. Perte de temps assurée.

### ✅ Méthode 1 — Playwright (recommandée : c'est la recette réelle)

Un vrai navigateur qui remplit le formulaire. Les scripts existants :

| Script | Ce qu'il fait |
|---|---|
| `/opt/data/scripts/brief_agent_recette2.py` | login → ouvre les onglets (Dashboard, Kanban, Idées, Chercher) → exceptions JS |
| `/opt/data/scripts/brief_kanban_dnd4.py` | login → crée une carte → **drag & drop clavier dnd-kit** (Espace + flèches) → vérifie la persistance après reload |

Prérequis : `uv pip install playwright` dans un venv + Chromium Playwright
(déjà présents sur le VPS Hermes : venv `/opt/data/.venv-pw`).

Pattern de connexion :

```python
page.goto("https://brief.srv1899780.hstgr.cloud")
page.fill('input[type="email"]', EMAIL)
page.fill('input[type="password"]', PASSWORD)
page.locator('button[type="submit"]').click()
time.sleep(4)  # laisser l'hydratation finir
```

### ✅ Méthode 2 — cookies API (curl / scripts sans navigateur)

Se loguer via l'API Supabase **puis transmettre le jeton en cookie**, pas en
Bearer. Les cookies attendus par `@supabase/ssr` sont `sb-<project-ref>-auth-token`
(à vérifier dans DevTools si besoin). La méthode navigateur reste plus simple
et plus fidèle à l'app réelle.

## Le Kanban en recette — piéges dnd-kit

Le Kanban n'utilise PAS le drag HTML5 natif (`[draggable="true"]` ne trouve
RIEN). C'est **dnd-kit** :

- Les cartes sont des éléments `aria-roledescription="sortable"` — chercher
  les textes, pas les attributs drag.
- **Le drag clavier est le plus fiable en headless** : clic sur la carte
  (focus), `Space` (saisir), `ArrowRight`/`ArrowLeft` (changer de colonne),
  `Space` (déposer). Voir `brief_kanban_dnd4.py`.
- Les colonnes n'ont pas de `data-column-id` : la colonne d'une carte se lit
  en remontant le DOM jusqu'au conteneur qui a le bouton
  `aria-label="Ajouter une carte"`, puis le header `button.flex-1`.
- Créer une carte : bouton `+` de la colonne → `input[placeholder="Titre de la carte…"]`
  → taper le titre → `Enter`.
- Après un `page.reload()`, on retombe sur le **Dashboard** : toujours
  re-cliquer l'onglet Kanban avant de vérifier quoi que ce soit.

## Ce qui a été recetté avec ce compte (2026-09-01)

- Login formulaire OK, Dashboard rend.
- Onglets Idées / Chercher : ouverts, rendus, zéro exception JS.
- **Kanban drag & drop : carte déplacée « À faire » → « En cours » et
  position persistée après reload.** (PR #9 validée en prod.)

## Hygiène

- Les données de test du compte agent restent dans son store — pas besoin de
  nettoyer, mais éviter d'accumuler des centaines de cartes test.
- Si le compte est compromis : Supabase Dashboard → Authentication → Users →
  supprimer/réinitialiser `agent.brief@aramis.local`, puis recréer via la
  même méthode (API admin, voir `git log` de ce doc).