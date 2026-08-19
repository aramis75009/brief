@AGENTS.md

# Spécifique à Claude Code

`AGENTS.md` ci-dessus porte le contrat commun aux trois agents : invariants,
commandes de vérification, règles git, gabarit de passation. **Ce qui suit ne
concerne que Claude Code.** Ne pas y remettre une règle qui vaut aussi pour
Hermes — elle irait dans `AGENTS.md`, le seul fichier qu'il charge tout seul.

## Avant de coder

- **`HANDOFF.md` d'abord.** Toujours.
- **`docs/coordination.md`** — Brief est travaillé en parallèle par plusieurs
  agents. Lance `bash scripts/coord/status.sh` pour comparer les copies
  (GitHub / ta copie locale / prod VPS). Si la prod a avancé, fast-forward
  avant de coder. Un agent = une branche à la fois.
- **`superpowers:brainstorming` avant de concevoir une fonctionnalité**, pas
  après avoir commencé à coder.
- **`superpowers:systematic-debugging` devant un bug**, plutôt que `/investigate`
  ou `debugging-wizard`.
- **`DESIGN.md` avant toute décision visuelle**, puis `frontend-design` pour la
  direction.
- Documentation d'une bibliothèque : MCP `context7`, jamais la mémoire du
  modèle. Next.js 16 et React 19 sont postérieurs à beaucoup de ce que tu crois
  savoir — et `AGENTS.md` rappelle que les guides font foi dans
  `node_modules/next/dist/docs/`.

## Arbitrage des skills

| Besoin | Utiliser | Pas |
|---|---|---|
| Naviguer / tester le site | `/browse` | `mcp__claude-in-chrome__*` |
| Relire un diff avant merge | `/code-review` | `/review`, `code-reviewer` |
| Merger + PR | `/ship` | git à la main |
| Déployer sur Vercel | `vercel-deploy-workflow` | `vercel:deploy` |

Vercel n'est **pas** la cible réelle de Brief : stockage éphémère, aucun cron à
la minute. Le VPS l'est.

## Mémoire

Le dossier mémoire de ce projet est
`~/.claude/projects/-Users-ams-Documents-02-Perso-Projets-perso-brief/memory/`.

Y écrire quand un fait résiste à l'oubli : un piège d'outil, une décision
produit, une contrainte non déductible du code. **Ne pas y écrire ce que
`HANDOFF.md`, `AGENTS.md`, `TODOS.md` ou git disent déjà** — c'est du doublon
qui se périme séparément.

## Système de design

Lire `DESIGN.md` avant toute décision visuelle ou d'UI. Les polices, couleurs,
échelles d'espacement, rayons, durées d'animation et l'icône y sont définis.

Ne pas s'en écarter sans accord explicite. En revue ou en QA, signaler tout code
qui ne s'y conforme pas — la section « Ce qu'il reste à faire côté code » liste
les écarts connus et assumés.
