# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-29 · Landing page multi-utilisateur v1 (preview, à retravailler)

| | |
|---|---|
| **Agent** | **Hermes Agent** — *je reprends la main explicitement* (passation précédente : Hermes Agent, 27/08 matin) |
| **Branche** | `feat/landing-multi-user` (nouvelle, poussée sur origin — **PAS de prod**, branche de travail) |
| **Base** | `origin/main` (7c07ad0) — prod reste sur `feat/email-password-auth` (832a811), inchangée |

## Goal — l'objectif

Brief va devenir un SaaS **multi-utilisateur** (chaqu'un crée son compte et a
son propre Brief). Aramis a demandé une **preview de landing page** dans le
style de MyFlip (https://myflip.vercel.app), fidèle au design system Claude
Design v1, livrée en preview locale — puis **archivée dans le repo avec la
consigne explicite qu'il faudra la modifier** (bonne v1, mais beaucoup à
changer).

## Current state — ce qui a été fait

1. **Landing `docs/landing/multi-user-v1.html`** — HTML autonome (CSS inline,
   seule dépendance : Google Fonts Plus Jakarta Sans). Structure MyFlip :
   hero + mockup téléphone → 3 douleurs → fonctionnalités (grille
   asymétrique) → méthode 3 étapes → tarifs 3 plans (0/6/12 €, *prix
   inventés*) → FAQ → CTA final. Angle multi-user partout (« Crée ton compte,
   ton Brief est à toi » + FAQ dédiée).
2. **Tokens fidèles au design system Brief v1** (`/opt/data/brief-design-claude/`)
   : fond #F4F4F2, encre #101010, pastels task/meet/idea, pill, hairline
   ink/8 %, shadow-card/fab. **Carte phare = le rail vocal** (dictée « Duval »
   animée qui se déplie en tâche/sous-tâche/idée).
3. **`docs/landing/README.md`** = la notice de travail demandée par Aramis :
   statut v1 (à retravailler), contexte, checklist **« Ce qu'il faudra
   modifier »** (prix à trancher, CTA à brancher sur le futur signup, mockup à
   actualiser, découpage composants Next.js, dark mode, SEO/perf…) et les
   idées qu'il faut GARDER (rail vocal phare, tokens, ton, structure).
4. **3 screenshots de référence** (`preview-desktop-full/hero.png`,
   `preview-mobile-hero.png`) vérifiés visuellement ; un bug de gouttière
   mobile (`padding` écrasant celle de `.wrap`) trouvé et corrigé (fix
   `padding-block`).

## Decisions — choix critiques

- **v1 ton assumé** : tutoiement, « ton Brief est à toi » — à harmoniser avec
  la voix de marque retenue (checklist).
- **Prix 0/6/12 € = placeholders** assumés dans le README. À trancher avec
  Aramis avant toute mise en ligne (aucune limite technique n'existe encore).
- **Aucune intégration Next.js** : fichier autonome volontairement (preview
  itérative). Le découpage en composants est listé dans le README.

## Changed — fichiers

| Fichier | Nature |
|---|---|
| `docs/landing/multi-user-v1.html` | landing v1 (nouveau) |
| `docs/landing/README.md` | notice de travail + checklist « à modifier » (nouveau) |
| `docs/landing/preview-*.png` | 3 screenshots de référence (nouveaux) |

## Validations

### ✅ Passants

| Commande / geste | Résultat |
|---|---|
| Parseur HTML (équilibrage balises + ancres) | 0 erreur, toutes les ancres résolues |
| Playwright + Chromium 151 (serveur `http.server` :4173) | page rendue, **0 erreur console** |
| Screenshots inspectés (desktop 1440 pleine page + mobile 390) | rendu correct ; bug gouttière mobile détecté puis **corrigé** (`padding-block`) |
| Preview distante via tunnel localtunnel | validée par Aramis (« super ») — fermer le tunnel si encore actif |

### ❌ Échoués

Aucun.

## Blockers

Aucun. Rappels d'état inchangés (prod = `feat/email-password-auth`, ne pas
toucher ; ne pas lancer `npm run dev` ici — port 3000 = bridge WhatsApp).

## Next — la prochaine action

1. **Aramis tranche** les points du § « Ce qu'il faudra modifier » du
   `docs/landing/README.md` — en priorité : prix des plans et parcours signup
   (dépend de l'auth multi-user, chantier à venir côté Supabase).
2. **Lancer le chantier auth multi-utilisateur** : la landing le promet, le
   backend ne le permet pas encore.
3. Le reste du `Next` de la passation du 27/08 reste valable (Frip & Trend,
   P0 bis de `TODOS.md`, refontes Claude Design).

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-29** | **Landing multi-user v1 (preview à retravailler)** | **Hermes Agent** | *(cette passation)* |
| 2026-08-27 (matin) | Tâches & RDV : tri + filtres câblés + « Faites » réparé | Hermes Agent | [fiche](docs/handoffs/2026-08-27-matin-taches-rdv-tri-filtres.md) |
| 2026-08-26 (soir) | Auth Supabase (email + mdp) DÉPLOYÉE — PIN retiré | Hermes Agent | [fiche](docs/handoffs/2026-08-26-auth-supabase-deployee.md) |
| 2026-08-26 (après-midi) | PIN → Supabase Auth : code + provisionnement prêts, déploiement pour Hermes | Claude Code | [fiche](docs/handoffs/2026-08-26-email-password-auth-claude-code.md) |
| 2026-08-26 (matin) | Cinq chantiers poussés et déployés ; refonte Calendrier + Fiche par Claude Design | Hermes Agent | [fiche](docs/handoffs/2026-08-26-matin-chantiers-deployes-hermes.md) |
| 2026-08-25 (soir) | Cinq chantiers front-end : waveform, DnD Kanban, calendrier, fiche, graphe | Claude Code | [fiche](docs/handoffs/2026-08-25-cinq-chantiers-frontend-claude-code.md) |
| 2026-08-25 (matin) | État du repo + défi Kanban/dépendances/Graphe pour Claude Code | Hermes Agent | [fiche](docs/handoffs/2026-08-25-hermes-etat-repo-mission-bugs.md) |
| 2026-08-24 (après-midi) | Vue Graphe et recette de l'existant | Claude Code | [fiche](docs/handoffs/2026-08-24-graphe-recette-claude-code.md) |
| 2026-08-24 (matin) | Kanban, tags, dépendances, fiche tâche, donut fix | Hermes Agent | [fiche](docs/handoffs/2026-08-24-kanban-tags-dependances-fiche.md) |
| 2026-08-23 (matin, 2e) | Desktop V1.1 : Réglages, priorités, IA, projets | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-kanban-tags-deps.md) |
| 2026-08-23 (matin) | Déploiement desktop V1 + audio/IA du 22/08 | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-deploy-desktop-v1.md) |
| 2026-08-23 (nuit) | Version desktop V1 (5 écrans, nav pilule, dashboard 3 cartes) | Claude Code | [fiche](docs/handoffs/2026-08-23-claude-code-desktop-v1.md) |
