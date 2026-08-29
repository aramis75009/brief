@AGENTS.md

# Spécifique à Claude Code

`AGENTS.md` ci-dessus porte le contrat commun aux trois agents : invariants,
commandes de vérification, règles git, gabarit de passation. **Ce qui suit
ne concerne que Claude Code.** Ne pas y remettre une règle qui vaut aussi
pour Hermes — elle irait dans `AGENTS.md`, le seul fichier qu'il charge
tout seul.

## Avant de coder

- **`HANDOFF.md` d'abord.** Toujours.
- **`docs/coordination.md`** — Brief est travaillé en parallèle par plusieurs
  agents. Lance `bash scripts/coord/status.sh` pour comparer les copies
  (GitHub / ta copie locale / prod VPS). Si la prod a avancé, fast-forward
  avant de coder. Un agent = une branche à la fois.
- **Lire les tâches et rendez-vous d'Aramis** : `bash scripts/brief-agents.sh
  digest` (récap du jour) ou `agenda AAAA-MM-JJ` (jour précis). Secrets dans
  `.env.local`, jamais commités — voir `docs/agent-calendar-access.md`.
- **`superpowers:brainstorming` avant de concevoir une fonctionnalité**, pas
  après avoir commencé à coder.
- **`superpowers:systematic-debugging` devant un bug**, plutôt que
  `/investigate` ou `debugging-wizard`.
- **Le design system Claude Design v1 est la source de vérité visuelle** —
  prototype iOS dans `docs/design-system-ref.dc.html`, tokens et recettes
  actuelles dans `DESIGN.md` (racine). Toute nouvelle direction passe par
  `frontend-design` avec livrable `.dc.html`.
- **Sécurité** : `requireSession()` (Supabase Auth, JWT) est l'unique garde
  des routes `/api/*`. L'ancien mécanisme PIN est supprimé depuis le
  2026-08-26. Ne jamais réintroduire `requirePin`, `BRIEF_PIN` ou
  `x-brief-pin`.
- Documentation d'une bibliothèque : MCP `context7`, jamais la mémoire du
  modèle. Next.js 16 et React 19 sont postérieurs à beaucoup de ce que tu
  crois savoir — et `AGENTS.md` rappelle que les guides font foi dans
  `node_modules/next/dist/docs/`.

## Arbitrage des skills

| Besoin | Utiliser | Pas |
|---|---|---|
| Naviguer / tester le site | `/browse` | `mcp__claude-in-chrome__*` |
| Relire un diff avant merge | `/code-review` | `/review`, `code-reviewer` |
| Merger + PR | `/ship` | git à la main |
| Déployer sur Vercel | `vercel-deploy-workflow` | `vercel:deploy` |

Vercel n'est **pas** la cible réelle de Brief : stockage éphémère, aucun
cron à la minute. Le VPS l'est.

## Mémoire

Le dossier mémoire de ce projet est
`~/.claude/projects/-Users-ams-Documents-02-Perso-Projets-perso-brief/memory/`.

Y écrire quand un fait résiste à l'oubli : un piège d'outil, une décision
produit, une contrainte non déductible du code. **Ne pas y écrire ce que
`HANDOFF.md`, `AGENTS.md`, `TODOS.md` ou git disent déjà** — c'est du
doublon qui se périme séparément.

## Système de design

Le design system **Claude Design v1** est LA source de vérité visuelle :

- **Prototype iOS (mobile)** : `docs/design-system-ref.dc.html` — tokens
  exacts (fond `#F4F4F2`, encre `#101010`, pastels task / meet / idea / AI,
  radius 20/24/pill, ombres card/fab/nav, Plus Jakarta Sans 400–800).
- **Tokens et recettes actuels (mobile + desktop)** : `DESIGN.md` (racine du
  repo). Ce fichier décrit ce qui est réellement en code — la spec `.dc.html`
  est la référence visuelle, `DESIGN.md` est la source opérationnelle.
- **Implémentation** : `src/app/globals.css` (tokens Tailwind v4) +
  `src/components/` (mobile) + `src/components/desktop/` (desktop).

Ne pas s'écarter des tokens sans accord explicite. En revue ou en QA,
signaler tout code qui ne s'y conforme pas — les écarts connus et assumés
sont listés dans `DESIGN.md`, section « Écarts connus ».

L'ancien système corail / General Sans a été abandonné le 2026-08-20 et
supprimé (`DECISIONS.md`) — ne pas le ressusciter.
