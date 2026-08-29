# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-08-29 (fin) · Finitions du ménage + prod alignée sur `main`

| | |
|---|---|
| **Agent** | **Hermes Agent · kimi-k3** — reprise en autonomie après le ménage de l'après-midi |
| **Branche** | `main` (HEAD `31f12fa`) — unique branche restante |
| **Base** | `326f3a3` (fix status.sh) — le ménage `5e613cb` était déjà mergé |

## Goal — l'objectif

Terminer ce que le « grand ménage » de l'après-midi (passation précédente,
archivée dans `docs/handoffs/2026-08-29-grand-menage-repo.md`) n'avait pas
fini, et remettre la production à niveau. Suite de la directive d'Aramis :
« fais tout en autonomie, corrige-toi s'il y a un problème, ne casse rien ».

## Current state — ce qui a été fait

1. **`.env.example` nettoyé** : `BRIEF_PIN` retiré (mécanisme mort depuis le
   26/08). Ajout des variables que le code lit réellement mais qui manquaient
   au template : `OLLAMA_API_KEY`, `CHAT_MODEL`, `BRIEF_CALDAV_ROOT`,
   `BRIEF_CALDAV_MAPPING`, `NEXT_PUBLIC_APP_URL`, `BRIEF_DATA_DIR`.
   Le commentaire « distinct de BRIEF_PIN » est devenu « distinct de la
   session utilisateur ». **Correction d'audit** : `BRIEF_CALDAV_TOKEN` est
   bien utilisé (route `caldav-sync`) — conservé.
2. **`README.md`** : mention PIN historique clarifiée (les commentaires morts
   du code ont été nettoyés le 29/08 — plus rien « à corriger quand on y
   touche »).
3. **Branches purgées** : locales `cleanup/mega-clean-2026-08-29`,
   `feat/email-password-auth`, `feat/landing-multi-user` (toutes mergées) +
   distantes `origin/cleanup/...` et `origin/feat/landing-multi-user`.
   Il ne reste **que `main`**, en local et sur GitHub.
4. **Production alignée** : le VPS tournait sur `main@5e613cb7`, en retard
   d'un commit. Diff vers `326f3a3` = **uniquement `scripts/coord/status.sh`**
   (doc). Pull en fast-forward, pas de rebuild (aucun code modifié). La copie
   de travail `/opt/data/Projets/brief` a ensuite commité les docs
   (`31f12fa`) — la prod est donc maintenant un commit doc derrière, sans
   impact (aucune route/dépendance touchée).

## Decisions — choix critiques

- **Pas de redeploy `--build`** pour l'alignement prod : le seul commit
  manquant était `status.sh` (script de coordination, hors du bundle Next).
  Un rebuild aurait été du bruit. Le `.env.example`/`README.md` committé
  ensuite ne change pas le runtime non plus.
- **Artefacts de session non commités** : `scripts/coord/apply-cleanup-…sh`
  et `purge-branches-…sh` (one-shots déjà exécutés) et
  `docs/landing/landing-desktop-full.png` (screenshot d'audit) restent
  non-trackés — ce sont des outils jetables, pas du repo.

## Validations

| Étape | État |
|---|---|
| `npx tsc --noEmit` | ✅ passant, aucune erreur |
| `npx vitest run` | ✅ **374 / 374 tests passent** (29 fichiers) |
| `bash scripts/coord/status.sh` | ✅ Prod = GitHub = locale @ `326f3a3f` au moment du déploiement |
| `git branch -a` | ✅ seule `main` (locale + origin) |

Non testé : comportement runtime (aucun code modifié depuis la dernière
validation prod).

## Next steps

1. **Landing SaaS multi-user** : `docs/landing/multi-user-v1.html` reste en
   v1. Prix à trancher avec Aramis, CTA à brancher sur le futur signup.
2. **Recettage desktop** : refonte calendar + fiche tâche par Claude Design
   (livrable `.dc.html` à venir, voir `DECISIONS.md` 2026-08-26).
3. **Nettoyage optionnel des artefacts non-trackés** listés plus haut (à
   supprimer à la main si gênants — pas commités volontairement).
4. Si on veut une prod « à jour au commit près » : pull de `31f12fa` (doc
   only) — purement cosmétique, non requis.

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-29 (fin) | Finitions du ménage + prod alignée sur `main` | Hermes Agent | (cette passation) |
| 2026-08-29 | Grand ménage du repo — main redevient la source de vérité | Hermes Agent | [fiche](docs/handoffs/2026-08-29-grand-menage-repo.md) |
| 2026-08-29 (matin) | Landing page multi-utilisateur v1 (preview, à retravailler) | Hermes Agent | [fiche](docs/handoffs/2026-08-29-landing-multi-user-v1.md) |
| 2026-08-27 (matin) | Tâches & RDV : tri, filtres, occurrences, état « Done » fonctionnel | Hermes Agent | [fiche](docs/handoffs/2026-08-27-matin-taches-rdv-tri-filtres.md) |
| 2026-08-26 (soir) | Auth Supabase (email + mdp) DÉPLOYÉE — PIN retiré | Hermes Agent | [fiche](docs/handoffs/2026-08-26-auth-supabase-deployee.md) |
