# DESIGN.md — Brief Design System v1

**Source de vérité opérationnelle pour tout code visuel de Brief.**
Ce fichier décrit **ce qui est réellement en place dans le code** (pas une
proposition), pour que tout agent qui écrit du JSX/Tailwind sache quels tokens
et quels composants existent.

- **Prototype iOS (mobile)** : `docs/design-system-ref.dc.html` — la maquette
  navigable d'origine, à ouvrir pour la *direction* visuelle (espacements,
  hiérarchie, ton).
- **Implémentation CSS** : `src/app/globals.css` (Tailwind v4, `@theme
  static`). **C'est le seul endroit où les tokens sont définis.**
- **Composants** : `src/components/` (mobile) et `src/components/desktop/`
  (desktop ≥ 1024 px via `useIsDesktop()`).

> Ce fichier a été **recréé le 2026-08-29** après que l'ancien `DESIGN.md`
> (version du 20/08) a été perdu dans une branche non mergée. Toute
> divergence entre ce fichier et le code doit être signalée et corrigée.

---

## 1. Principes

- **Bento sombre épuré** — hiérarchie claire, beaucoup de respiration (`gap
  12–28`), surface blanche sur fond papier, encre `#101010`.
- **Trois destinations** : chaque item Brief vit dans une seule destination
  (`task`, `meet`, `idea`), avec une couleur pastel `*-100` de fond et une
  couleur encrée `*-700` pour l'icône.
- **Pills** pour les CTA interactifs (capture vocale, segmented, tags). Les
  **cards** portent le contenu, radius `24`.
- **Plus Jakarta Sans** (400–800) pour tout le texte ; JetBrains Mono pour
  les badges/codes. **Aucune autre police.**
- **Hiérarchie typographique serrée** : huit crans seulement (10–34 px), pas
  un de plus.
- **Safe areas iOS** : `.safe-top` / `.safe-bottom` (Tailwind v4 ne compile
  pas `env()` arbitraire — passer par ces classes).

## 2. Tokens

Les tokens sont définis dans `src/app/globals.css` sous `@theme static` —
Tailwind génère des utilitaires automatiquement (`bg-task-100`,
`text-task-700`, `rounded-24`, etc.). **Ne pas introduire de nouvelle
couleur** sans entrée correspondante dans `globals.css`.

### Fonds

| Token | Valeur | Usage |
|---|---|---|
| `bg` | `#F4F4F2` | fond global (papier) |
| `surface` | `#FFFFFF` | cards, sheets, chips |
| `--hairline` | `rgba(16,16,16,.06)` | bordures très fines |
| `--hairline-2` | `rgba(16,16,16,.08)` | bordures fines |
| `--hairline-3` | `rgba(16,16,16,.07)` | bordures moyennes |

### Encre

| Token | Valeur | Usage |
|---|---|---|
| `ink` | `#101010` | texte principal, card IA |
| `ink-muted` | `#8A8A84` | texte secondaire |
| `ink-faint` | `#A9A9A2` | texte tertiaire, « Qu'est-ce qu'on organise ? » |

### Destinations

| Clé | `*-100` (fond) | `*-700` (icône / texte) |
|---|---|---|
| `task` | `#CFE0FF` (bleu pastel) | `#1F4FA8` (bleu encre) |
| `meet` | `#CBE9D6` (vert pastel) | `#1F6B45` (vert encre) |
| `idea` | `#FBE2AE` (ambre pastel) | `#8A5A10` (ambre encre) |
| IA      | `ink` `#101010` (card sombre) | `surface` `#FFFFFF` |

### Sémantique

| Token | Valeur | Usage |
|---|---|---|
| `danger` | `#E23A2E` | suppression, alerte critique |
| succès (hardcodé) | `#34C759` | « prête » dans le graphe, checkmark |
| warning (hardcodé) | `#FF9500` | badge attention |

### Couleurs projet (p1–p8)

Huit teintes alignées **sur les calendriers Apple réels d'Aramis** (relevé du
22/08/2026 dans l'app Calendrier). Chaque projet a sa paire `*-ink` pour le
texte blanc sur fond teinté.

| Token | Hex | Projet d'Aramis |
|---|---|---|
| `p1` / `p1-ink` | `#007AFF` / `#003E80` | Frip & Trend |
| `p2` / `p2-ink` | `#FF9500` / `#7A4400` | My Flip |
| `p3` / `p3-ink` | `#FF3B30` / `#7A1A14` | Web@cadémie |
| `p4` / `p4-ink` | `#AF52DE` / `#4A1A6B` | Perso |
| `p5` / `p5-ink` | `#FFCC00` / `#6B5A00` | Sport |
| `p6` / `p6-ink` | `#34C759` / `#0A6B2E` | IA |
| `p7` / `p7-ink` | `#FF9500` / `#7A4400` | Permis |
| `p8` / `p8-ink` | `#A2845E` / `#5C4A2E` | Fake |

> Note : `p7` et `p2` partagent la même teinte (orange) — c'est voulu
> (calendriers distincts mais couleur proche).

### Rayons

| Token | Valeur | Exemple |
|---|---|---|
| `radius-8` | 8px | tag, chip inline |
| `radius-12` | 12px | petite card, avatar |
| `radius-18` | 18px | card secondaire |
| `radius-20` | 20px | sheet, modale |
| `radius-24` | 24px | card principale, panneau desktop |
| `pill`   | `rounded-full` | bouton, nav pill, segmented |

### Typographie

Famille : **`Plus Jakarta Sans`** chargée via Google Fonts. Font mono :
**JetBrains Mono** (badges numérotés, code).

| Token | Taille | Usage |
|---|---|---|
| `text-10` | 10px | badge, compteur |
| `text-11` | 11px | méta, timestamp |
| `text-12` | 12px | hint, label secondaire |
| `text-13` | 13px | texte courant réduit, body de card |
| `text-15` | 15px | texte courant, body standard |
| `text-17` | 17px | titre de card |
| `text-20` | 20px | sous-titre de vue |
| `text-22` | 22px | titre de vue secondaire |
| `text-28` | 28px | « Salut Léa, » |
| `text-34` | 34px | hero H1 (mobile) |

### Ombres

| Token | Valeur | Usage |
|---|---|---|
| `shadow-card` | `0 6px 20px rgba(16,16,16,.07)` | card au repos |
| `shadow-fab` | `0 8px 20px rgba(16,16,16,.28)` | Floating Action Button |
| `shadow-nav` | `0 10px 28px rgba(16,16,16,.1)` | nav flottante |
| `shadow-mic` | `0 12px 30px rgba(16,16,16,.26)` | bouton micro en capture |

### Animations

| Token | Durée / easing | Usage |
|---|---|---|
| `animate-wave` | .95s ease-in-out | barres du rail vocal en dictée |
| `animate-idle` | 1.6s ease-in-out | rail vocal au repos |
| `animate-collapse` | .7s cubic-bezier(.4,0,.2,1) | rail qui se referme après dictée |
| `animate-pop` | .45s cubic-bezier(.2,.9,.3,1) | apparition tuile / snackbar |
| `animate-rail` | .5s cubic-bezier(.4,0,.2,1) | progression latérale |
| `animate-shimmer` | 1.1s linear | skeleton de chargement |
| `animate-ping` | 1.4s ease-out | point de notification |
| `animate-fade` | .3s both | fondu simple |
| `animate-sheet` | .3s cubic-bezier(.2,.9,.3,1) | entrée d'une sheet iOS |

## 3. Composants (réels, dans `src/components/`)

### Mobile

| Composant | Rôle |
|---|---|
| `BriefApp` | Racine de l'app mobile : bascule entre Home / Agenda / Idées / Recherche. |
| `HomeScreen` | Grille 2×2 des destinations (Tâches / RDV / Idées / Demander à l'IA) + liste « Due today ». |
| `AgendaScreen` | Vue journée, items triés par heure (RDV + tâches). |
| `IdeasScreen` | Inbox d'idées à trier. |
| `SearchScreen` | Recherche plein-texte. |
| `TaskDetailScreen` | Fiche d'un item (édition, tags, notes, suppression). |
| `CaptureBar` | Pill fixe en bas : champ texte + bouton micro (dictée). |
| `CaptureSheet` | Sheet iOS qui recueille la dictée et affiche le rail vocal animé. |
| `Waveform` | Les barres animées du rail vocal (`animate-wave` + `animate-idle`). |
| `ChatSheet` | Sheet assistant IA (tuile « Demander à l'IA »). |
| `AccountSheet`, `AccountAvatar` | Sheet et avatar rond (LM) du compte utilisateur. |
| `VoiceSettingsSheet` | Réglages voix / transcription (provider, modèle). |
| `NotificationsSheet`, `HelpSheet`, `PrivacySheet`, `InfoSheet`, `SubscriptionSheet` | Sheets iOS secondaires (réelles, pas des toasts). |
| `BottomNav` | Barre de navigation flottante (pill + shadow-nav). |
| `ProjectSelector` | Pill sélecteur de projet (teintes p1–p8). |
| `TypeSegmented` | Segmented control task / meet / idea. |
| `Chip` | Tag / pastille réutilisable. |
| `EmptyState`, `Skeleton`, `Toast`, `VoiceBadge`, `icons` | Utilitaires (état vide, chargement, toast léger, badge provider, iconographie). |
| `AuthGate` | Garde d'accès Supabase — email + mot de passe, puis session. |
| `PhoneFrame` | Cadre iOS pour preview (dev uniquement). |

### Desktop (≥ 1024 px)

Bascule : `useIsDesktop()` dans `src/app/page.tsx`. Mobile et desktop
coexistent — les features desktop ne **remplacent** pas la vue mobile, elles
l'étendent.

| Composant | Rôle |
|---|---|
| `DesktopShell` | Layout global desktop : header + sidebar + zone principale. |
| `DesktopHeader` | Top bar : logo, nav, recherche, compte. **Boutons à câbler** (jamais de bouton mort). |
| `DesktopDashboard` | Vue d'accueil desktop (agrégats, raccourcis). |
| `DesktopTasks` | Liste des tâches, filtres par statut/projet, tri par date. |
| `DesktopCalendar` | Vue calendrier (events sur voies non-chevauchantes). |
| `DesktopKanban` | Board Kanban drag & drop (DnD-kit). |
| `KanbanCard` | Carte Kanban (titre, tags, indicateur de blocage). |
| `DesktopTaskDetail` | Fiche tâche desktop (édition + dépendances + sous-tâches). |
| `DesktopIdeas` | Idées en grille desktop. |
| `DesktopSettings` | Préférences (compte, voix, projets). |
| `CommandPalette` | ⌘K — recherche d'actions et d'items. |
| `DependencyGraph` | Graphe de dépendances entre tâches (statuts prête / bloquée / terminée). |

### Icônes

Toutes les icônes vivent dans `src/components/icons.tsx` (SVG inline, stroke
1.9–2.1, `stroke-linecap="round"`). L'**icône PWA** (« Trois destinations » :
trois barres arrondies décroissantes, bleu/vert/ambre sur fond `#101010`)
est servie depuis `public/icon-{192,512}.png` + variantes maskable et
apple-touch-icon. **La marque vectorielle existe depuis le 29/08** :
`logo.svg` à la racine du repo (source de vérité, mêmes proportions que
l'icône PWA et le composant `Mark()` de `AuthGate.tsx`), copie servie dans
`public/logo.svg`. La landing (`public/landing.html`, route `/landing`)
l'utilise en inline SVG (header tuile encre, CTA final tuile blanche).

## 4. Pièges d'implémentation

- **Reset CSS dans `@layer base`** : tout style global hors layer l'emporte
  sur les utilitaires Tailwind.
- **`env()` interdit dans les utilitaires Tailwind arbitraires** — passer par
  `.safe-top` / `.safe-bottom` définies dans `globals.css`.
- **`useIsDesktop` est le seul moyen** de brancher desktop — pas de `md:` /
  `lg:` Tailwind qui changent la disposition (les breakpoints Tailwind ne
  reflètent pas la bascule fonctionnelle).
- **Toujours brancher un bouton sur une vraie feature** — un bouton mort est
  une promesse non tenue (décision Aramis, voir `TODOS.md` « Dette connue »).
- **`Intl.DateTimeFormat.formatToParts()` ne doit jamais voir une date
  invalide** — tout parsing passe par `zoned.ts` (Europe/Paris).

## 5. Écarts connus et assumés

Les points suivants sont connus, assumés et listés dans `TODOS.md` —
**à ne pas corriger sans décision** :

- Le mockup du hero landing (`docs/landing/multi-user-v1.html`) utilise une
  maquette stylisée, pas une copie pixel d'un vrai écran.
- `DesktopHeader` affiche `<img src="/icon-192.png">` (icône PWA) en lieu et
  place d'un vrai logo vectoriel — pas encore de `BrandMark` composant.
- La couleur succès `#34C759` est hardcodée dans `DependencyGraph` (pas de
  token `@theme` dédié).
- `DesktopCalendar` ne gère pas encore les événements en chevauchement
  complet — il répartit en voies.

## 6. Pour aller plus loin

- **Spec visuelle d'origine** : `docs/design-system-ref.dc.html` (iOS) —
  à ouvrir dans Claude Design pour itérer la maquette.
- **Audit incohérences doc↔code** : `docs/audit-incoherences-2026-08-28.md`
  (audit complet précédent, à jour au 28/08).
- **Décisions graphiques majeures** : `DECISIONS.md`, entrées du 2026-08-20
  (ancien système corail abandonné, troisième icône PWA) et du 2026-08-26
  (refonte calendar + task detail par Claude Design — à venir).
