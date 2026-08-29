# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-08-29 (soir) · Landing SaaS servie sur `/landing` + marque vectorielle — déployé en prod

| | |
|---|---|
| **Agent** | **Hermes Agent · glm-5.3** — reprise en autonomie (2 crash model kimi-k3 absorbés, session préservée) |
| **Branche** | `main` (HEAD `550aa8e`) — unique branche |
| **Prod** | **Déployée** sur le VPS au même commit (`550aa8e`), conteneur sain (`Healthy`), `/landing` + `/logo.svg` + `/` vérifiés 200 depuis le conteneur |

## Goal — l'objectif

Terminer le chantier landing demandé par Aramis : connecter tous les CTA au
parcours d'authentification Supabase, corriger la mise en page, utiliser le
**logo validé** (PWA / écran de connexion — pas en créer un nouveau), animer
le hero, et pousser sur un `main` propre.

## Current state — ce qui a été fait

1. **`logo.svg` à la racine du repo** : la marque validée (« Trois
   destinations » — 3 barres pastel task/meet/idea décroissantes sur tuile
   encre, même motif que `icon-192.png` et le composant `Mark()` de
   `AuthGate.tsx`) exportée en **vectoriel**, source de vérité. Copie servie
   dans `public/logo.svg`. Correction mid-course d'Aramis : ne PAS créer un
   nouveau logo — j'avais d'abord proposé un glyph micro, abandonné.
2. **`public/landing.html`** (v2, remplace la preview
   `docs/landing/multi-user-v1.html` qui reste en archive) :
   - **7 CTA câblés** : tous pointent vers `/` (l'app, qui affiche
     l'écran de connexion Supabase `AuthGate`). Pas de faux parcours signup :
     l'auth actuelle est une allowlist `authorized_users`, sans signup libre.
   - **Logo validé** en inline SVG : header (tuile encre), favicon, CTA
     final (tuile blanche inversée).
   - **Animations hero** : entrée décalée du copy, téléphone flottant,
     micro pulsant, waveform vivante, halo pastel derrière le mockup,
     reveal au scroll **no-JS-safe** (caché uniquement si JS pose `.anim`
     sur `<html>` — crawlers et lecteurs voient tout).
   - **Copy CalDAV corrigée** : « synchro bidirectionnelle » (décision
     Aramis 18/08) au lieu de « lecture seule » qui contredisait le code.
   - **Fix débordement horizontal** mobile (+22px) / tablette (+67px) : le
     halo (`inset:-8% -12%`) débordait → `overflow-x:clip` sur html/body.
3. **`next.config.ts`** : `rewrites()` `/landing` → `/landing.html` (Next ne
   sert pas les index.html des sous-dossiers de `public/`).
4. **Docs** : README (pages publiques `/` et `/landing`), DESIGN.md (la
   marque vectorielle existe — retire « Logo à créer »).
5. **Déploiement prod** : pull + `docker compose up -d --build`, conteneur
   `Healthy`. ⚠️ Un curl direct vers le domaine public depuis le VPS Hermes
   a été bloqué par l'approbation locale — vérifié en 200 **depuis le VPS
   lui-même** (loopback conteneur). Aramis devrait ouvrir
   `https://brief.srv1899780.hstgr.cloud/landing` une fois pour confirmer
   le rendu visuel de bout en bout (TLS/Traefik).

## Decisions — choix critiques

- **CTA → `/` et pas un signup** : le login exige l'allowlist
  `authorized_users` ; un bouton « Crée ton compte » serait un mensonge.
  « Ouvrir Brief » est honnête et mène à l'écran de connexion validé.
- **Landing en statique `public/landing.html`** et pas en composants
  Next : zéro risque pour la PWA et les routes API, pas de bundle, cache
  simple. L'intégration en composants reste possible plus tard (voir
  `docs/landing/README.md`, non urgent).
- **Tarifs laissés tels quels** (0/6/12 €, placeholders) : README de la
  landing le documente ; arbitrage produit avec Aramis en attente. Les
  boutons pointent vers `/` (pas de paiement branché — aucun n'existe).
- **QA visuel sans modèle vision** : le modèle vision auxiliaire (qwen3.5)
   renvoyait 400 en fin de session → QA **programmatique** Playwright sur 3
   viewports (débordements, reveals, ancres, FAQ, animations, liens) — tout
   passe. Captures finales dans `/tmp/final-{desk,mob}-full.png`.

## Validations

| Étape | État |
|---|---|
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npx vitest run` | ✅ **374/374** |
| `npx eslint .` | ✅ 0 erreur (30 warnings préexistants, fichiers non touchés) |
| `npm run build` | ✅ standalone OK |
| Serveur standalone (mode prod Docker) | ✅ `/landing`, `/logo.svg`, `/`, `/manifest.webmanifest` → 200 |
| QA Playwright 3 viewports | ✅ zéro débordement, 0 `.reveal` non déclenchés, FAQ dépliable, ancres OK, 7 CTA corrects, 4 animations actives |
| Prod VPS | ✅ `main@550aa8e`, conteneur Healthy, 200 vérifiés depuis le VPS |

## Next steps

1. **Aramis vérifie visuellement** `https://brief.srv1899780.hstgr.cloud/landing`
   (rendu de bout en bout après Traefik/TLS) — le dernier maillon que je
   n'ai pas pu vérifier depuis ici.
2. **Arbitrage tarifs** (0/6/12 € placeholders) + brancher les CTA sur un
   vrai signup quand l'auth multi-user existera (aujourd'hui : allowlist).
3. **Chantiers suivants** (demande Aramis) : projets & objectifs dans
   Brief ; petits bugs dashboard avec tâches récurrentes.
4. La preview historique `docs/landing/multi-user-v1.html` peut être
   supprimée quand Aramis valide la v2 servie.

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-29 (soir) | Landing SaaS `/landing` + logo vectoriel — déployé prod | Hermes Agent | (cette passation) |
| 2026-08-29 (fin aprem) | Finitions du ménage + prod alignée sur `main` | Hermes Agent | [fiche](docs/handoffs/2026-08-29-finitions-menage-prod-alignee.md) |
| 2026-08-29 | Grand ménage du repo — main redevient la source de vérité | Hermes Agent | [fiche](docs/handoffs/2026-08-29-grand-menage-repo.md) |
| 2026-08-29 (matin) | Landing page multi-utilisateur v1 (preview, à retravailler) | Hermes Agent | [fiche](docs/handoffs/2026-08-29-landing-multi-user-v1.md) |