# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-08-29 · Grand ménage du repo — `main` redevient la source de vérité

| | |
|---|---|
| **Agent** | **Hermes Agent v0.20.0 · deepseek-v4-flash** — je reprends la main explicitement (passation précédente : Hermes Agent, 29/08 matin) |
| **Branche** | `cleanup/mega-clean-2026-08-29` (poussée sur origin, mergeable dans `main` par Aramis) |
| **Base** | `feat/landing-multi-user` @ `c7ac830` — la prod reste sur `feat/email-password-auth` (`832a8116`), **inchangée** |

## Goal — l'objectif

Le repo était pollué : 12 branches locales dont 11 mergées, docs qui
décrivaient le mécanisme PIN supprimé le 26/08, branche de prod
hardcodée `feat/ui-redesign-claude` (absorbée puis supprimée), 11 variables
d'environnement manquantes du README, pas de `DESIGN.md` (l'ancien restore
était resté prisonnier d'une branche non mergée), `TODOS.md` à 545 lignes où
les sections « FAIT » masquaient le réel travail différé, `data/items.json`
sample au format ancien (`dueAt`/`completedAt`) capable de corrompre
`items.json` à la copie. Objectif : que le repo reflète la réalité du code,
rien d'autre.

## Current state — ce qui a été fait

1. **Audit complet** du filesystem (routes, guards, env vars, composants,
   git archaeology sur DESIGN.md et la branche prod) : ~30 incohérences
   trouvées, classées critiques / importantes / mineures. Le fichier
   `docs/audit-incoherences-2026-08-28.md` (audit précédent de Claude Code,
   jamais commité) reste perdu sur une branche de travail — mes constats
   confirment les siens à ~95%.
2. **`scripts/coord/status.sh`** : la branche de prod n'est plus hardcodée
   — le script la découvre dynamiquement via SSH sur `/docker/brief`. Plus de
   faux négatif permanent.
3. **Réécriture des 7 fichiers de contrat** (`AGENTS`, `README`, `HERMES`,
   `CLAUDE`, `docs/coordination`, `TODOS`, `DECISIONS`) à partir de la
   réalité du code : mécanisme PIN supprimé partout, `requireSession()`
   Supabase Auth, branche prod dynamique (plus de hardcoded), table env
   complète (avec `NEXT_PUBLIC_SUPABASE_*`, `OLLAMA_API_KEY`, `BRIEF_CALDAV_*`),
   routes API complètes (auth/, agenda, audio, board, caldav, chat, search,
   tags — manquaient dans le README).
4. **`DESIGN.md` recréé** à la racine depuis `docs/design-system-ref.dc.html`
   + `src/app/globals.css` + `src/components/` (mobile + desktop). Couvre
   les tokens (bg/encre/pastels/rayons/typo/ombres/animations), les
   composants réels (mobile 26, desktop 12), les pièges d'implémentation et
   les écarts connus.
5. **`TODOS.md`** réduit de 545 → ~140 lignes : sections « ✅ FAIT /
   DÉPLOYÉ » archivées dans `docs/handoffs/`, reste = P0 landing + pivot
   multi-user, P1 desktop (recettage) + mobile (micro), P2 / P3 ordonnés.
6. **Purge code mort** : commentaire PIN dans `src/lib/cron-auth.ts`, comment
   DESIGN.md dans `DesktopHeader.tsx`, suppression de `data/items.json`
   (sample obsolète au format `dueAt`/`completedAt`).

## Decisions — choix critiques

- **`main` redevient la cible** : la prod VPS tourne actuellement sur
  `feat/email-password-auth` (832a8116, point de merge dans `main` 7c07ad0) —
  après ce ménage, elle rebascule sur `main` au prochain déploiement planifié.
- **DESIGN.md recréé plutôt que retrouvé** : l'ancien DESIGN.md (restauré par
  Claude Design le 20/08) était prisonnier d'une branche jamais mergée,
  introuvable. Recréation from scratch à partir de la spec `.dc.html` et du
  code réel est plus fiable.
- **30 warnings eslint non traités** : tous sur des fichiers non modifiés
  par ce ménage, correspondent aux « boutons morts » ou fonctions non
  utilisées déjà listés dans `TODOS.md`. Pas mon scope.
- **Suppression de `data/items.json`** : fichier d'échantillon obsolète au
  format ancien (`dueAt`/`completedAt`). Le code lit le volume Docker
  `brief-data` (`BRIEF_DATA_DIR=/app/data`), pas ce fichier — sa présence
  dans le repo était un piège.

## Validations

| Étape | État |
|---|---|
| `npx eslint .` | ✅ passant (30 warnings, tous préexistants sur des fichiers non modifiés) |
| `npx tsc --noEmit` | ✅ passant, aucune erreur |
| `npx vitest run` | ✅ **374 / 374 tests passent** (29 fichiers, 13.7 s) |
| `bash scripts/coord/status.sh` | ✅ sortie cohérente, dynamique, plus de hardcoded `feat/ui-redesign-claude` |

Non testé : comportement runtime de l'app (un ménage de doc ne change pas le
code — tests Vitest suffisent), le déploiement prod (reporté, voir « Next
steps »).

## Next steps

1. **Aramis valide** le diff de cette branche `cleanup/mega-clean-2026-08-29`
   et la merge dans `main` (`git checkout main && git merge --no-ff
   cleanup/mega-clean-2026-08-29`).
2. **Rebasculer la prod VPS sur `main`** au prochain déploiement planifié
   (pas en urgence : la prod actuelle est saine) :
   ```bash
   ssh root@186.241.16.37 'cd /docker/brief && git checkout main && git pull
   origin main && docker compose --env-file .env.production up -d --build'
   ```
3. **Purger les branches mergées** (locales + origin) après validation du
   merge : 11 branches locales sont mergées dans `main` (voir cette
   passation archivée).
4. **Landing SaaS multi-user** : `docs/landing/multi-user-v1.html` reste en
   v1 (voir `docs/landing/README.md` / `TODOS.md`). Prix à trancher avec
   Aramis, CTA à brancher sur le futur signup.
5. **Recettage desktop** : refonte calendar + fiche tâche par Claude Design
   (livrable `.dc.html` à venir, voir `DECISIONS.md` 2026-08-26).

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-29 | Grand ménage du repo — main redevient la source de vérité | Hermes Agent | (cette passation) |
| 2026-08-29 (matin) | Landing page multi-utilisateur v1 (preview, à retravailler) | Hermes Agent | [fiche](docs/handoffs/2026-08-29-landing-multi-user-v1.md) |
| 2026-08-27 (matin) | Tâches & RDV : tri, filtres, occurrences, état « Done » fonctionnel | Hermes Agent | [fiche](docs/handoffs/2026-08-27-matin-taches-rdv-tri-filtres.md) |
| 2026-08-26 (soir) | Auth Supabase (email + mdp) DÉPLOYÉE — PIN retiré | Hermes Agent | [fiche](docs/handoffs/2026-08-26-auth-supabase-deployee.md) |
| 2026-08-26 (après-midi) | PIN → Supabase Auth : code + provisionnement prêts, déploiement pour Hermes | Claude Code | [fiche](docs/handoffs/2026-08-26-email-password-auth-claude-code.md) |
