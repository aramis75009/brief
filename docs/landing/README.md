# Landing page multi-utilisateur — v1 (preview)

> **Statut : v1 à retravailler.** Bonne base avec de bonnes idées (structure
> type MyFlip, rail vocal en carte phare, tokens du design system Brief v1
> fidèles), mais **beaucoup de choses à modifier** avant toute mise en ligne.
> Considérer ce dossier comme une **maquette de travail**, pas comme une page
> finie.

## Contexte

Brief est organisé pour devenir un SaaS **multi-utilisateur** : aujourd'hui
personnel, tout utilisateur devra pouvoir créer un compte et avoir **son propre
Brief** (ses dictées, ses tâches, ses idées — rien de partagé par défaut).

Cette landing page preview le positionnement : hérite directement des **tokens
exact du design system Brief v1** (fond `#F4F4F2`, encre `#101010`, pastels
task/meet/idea, Plus Jakarta Sans, radius 20/24/pill, hairline ink/8%).

La structure s'inspire de la landing MyFlip (https://myflip.vercel.app) :
œil → H1 → CTA → mockup produit → douleurs → fonctionnalités → méthode 3 étapes
→ tarifs → FAQ → CTA final.

## Fichiers

| Fichier | Rôle |
|---|---|
| `multi-user-v1.html` | La landing, autonome (CSS inline, aucune dépendance hors Google Fonts). Openable directement dans un navigateur. |
| `preview-desktop-full.png` | Screenshot pleine page (1440 px). |
| `preview-desktop-hero.png` | Screenshot hero (1440 px). |
| `preview-mobile-hero.png` | Screenshot mobile (390 px). |

Le fichier `multi-user-v1.html` est **auto-porteur** : pas de build, pas de
serveur nécessaire, il s'ouvre tel quel.

## Ce qu'il faudra modifier (non exhaustif — v1 volontairement brute)

### Contenu / positionnement

- [ ] **Prix annoncés (0/6/12 €)** : inventés pour la preview. À fixer après Arbitrage produit, et vérifier ce que couvre chaque plan face au SaaS multi-user réel (limites de dictées ? export ? assistant ?).
- [ ] **Copy tarifs** : le découpage Découverte/Plus/Pro est plausible mais **aucune limite technique n'existe encore** (30 dictées, 100 idées, etc. = placeholders).
- [ ] **CTA « Créer mon Brief »** : pointe vers `#tarifs` pour l'instant ; à brancher sur un vrai parcours signup quand l'auth multi-user existera.
- [ ] **Mockup téléphone** : reprend le contenu du design system v1 (Léa, devis Duval). À actualiser avec de vrais écrans de l'app quand l'UI aura progressé.
- [ ] **FAQ** : réponse « Sur quoi est-ce disponible ? » décrit une PWA ; à ajuster si la stratégie de distribution évolue (store, widgets iOS…).
- [ ] **Ton** : tutoiement partout (assumé en v1) ; à harmoniser avec la voix de marque retenue.

### Design / intégration

- [ ] **Dark mode** : non traité (comme le design system, qui le reporte à plus tard).
- [ ] **Intégration Next.js** : le HTML est autonome ; à découper en composants (`Hero`, `PainCards`, `FeatureGrid`, `RailVocal`, `Steps`, `Pricing`, `FAQ`, `FinalCta`) + tokens dans `tailwind.config.ts` quand on l'intègre au repo.
- [ ] **Rail vocal animé** : CSS keyframes simples ; à migrer en Framer Motion ou équivalent si on veut un contrôle fin.
- [ ] **Accessibilité** : focus visibles présents, mais audit complet à faire (contrastes des pastels en mode clair, navigation clavier, `prefers-reduced-motion` déjà géré).
- [ ] **SEO / métadonnées** : title + description basiques ; Open Graph, favicon, canonical à ajouter.
- [ ] **Performance** : Google Fonts en remote ; à self-host (`next/font`) à l'intégration.

## Idées à garder (v1 validées)

- ✅ **Rail vocal en carte phare** (dictée → items structurés) : la fonctionnalité signature est bien mise en scène.
- ✅ **Tokens du design system Brief v1** : cohérence parfaite avec l'app.
- ✅ **Angles multir-user dans la copy** : « ton Brief est à toi », FAQ dédiée.
- ✅ **Structure MyFlip** : efficace, un message par section.
- ✅ **Plans avec « le plus populaire »** mis en avant (bordure encre) — pattern tarifaire qui marche.

## Historique

- **2026-08-29** — v1 générée par Hermes (preview locale + tunnel localtunnel,
  screenshots vérifiés desktop + mobile). Copiée dans le repo en l'état, avec
  cette notice de travail.