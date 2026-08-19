# Reconstruction complète de l'UI de Brief — Design System Claude Design v1

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal :** Reconstruire toute l'UI mobile de Brief à l'identique du design system produit par Claude Design, en conservant le backend intact (API routes, store, CalDAV, reminders, Telegram, PIN, queue).

**Architecture :** On remplace toute la couche de composants React (`src/components/*`) et les tokens visuels (`globals.css`, `layout.tsx`, `tailwind.config.ts`). Le backend (`src/app/api/*`, `src/lib/store.ts`, `src/lib/guard.ts`, `src/lib/caldav.ts`, `src/lib/reminders.ts`, `src/lib/webpush.ts`, `src/lib/queue.ts`, etc.) reste inchangé. Les types (`src/lib/types.ts`) évoluent minimalement pour supporter les nouveaux concepts (sous-tâches, fil d'origine vocal, idées).

**Tech Stack :** Next.js 16 (App Router), React 19, Tailwind v4, Plus Jakarta Sans (Google Fonts), JetBrains Mono (Google Fonts pour labels). Remplacement de General Sans par Plus Jakarta Sans.

**Design system source :** `/opt/data/brief-design-claude/Brief Design System.dc.html` (1311 lignes, lu en intégralité). Fichier de référence : `ios-frame.jsx` et `support.js` dans le même dossier.

---

## Tableau de correspondance : design → code

| Écran du design | Composant actuel à remplacer | Nouveau composant |
|---|---|---|
| Home (4 tuiles + liste Aujourd'hui) | `OverviewScreen.tsx` + `TasksScreen.tsx` (partie) | `HomeScreen.tsx` |
| Détail tâche (fil d'origine + sous-tâches) | `TaskSheet.tsx` | `TaskDetailScreen.tsx` |
| Agenda (vue semaine + events) | inexistant | `AgendaScreen.tsx` |
| Idées (cartes + convertir) | inexistant | `IdeasScreen.tsx` |
| Recherche (barre + filtres + résultats) | `TasksScreen.tsx` (partie recherche) | `SearchScreen.tsx` |
| Compte & réglages (sheet) | `SettingsScreen.tsx` | `AccountSheet.tsx` |
| Capture (sheet 4 stages) | `CaptureScreen.tsx` + `ReviewScreen.tsx` | `CaptureSheet.tsx` |
| Navigation basse (Accueil/Recherche/FAB/Idées) | `TabBar.tsx` | `BottomNav.tsx` |
| Capture bar fixe (pill) | inexistant | `CaptureBar.tsx` |
| PinGate | `PinGate.tsx` | `PinGate.tsx` (à refondre visuellement) |
| PhoneFrame | `PhoneFrame.tsx` | `PhoneFrame.tsx` (à refondre) |
| Toast | `Toast.tsx` | `Toast.tsx` (à refondre) |
| Icons | `icons.tsx` | `icons.tsx` (nouveaux SVG du design) |
| BriefApp (orchestrateur) | `BriefApp.tsx` (697 lignes) | `BriefApp.tsx` (réécrit) |

---

## Nouveaux tokens (remplacement complet de globals.css)

### Couleurs

| Token | Valeur | Rôle |
|---|---|---|
| `--bg` | `#F4F4F2` | fond de page |
| `--surface` | `#FFFFFF` | cartes, surfaces |
| `--ink` | `#101010` | texte principal, blocs noirs |
| `--ink-muted` | `#8A8A84` | texte secondaire |
| `--ink-faint` | `#A9A9A2` | texte tertiaire, placeholders |
| `--task-100` | `#CFE0FF` | fond tuile tâches |
| `--task-700` | `#1F4FA8` | texte sur tuile tâches |
| `--meet-100` | `#CBE9D6` | fond tuile rendez-vous |
| `--meet-700` | `#1F6B45` | texte sur tuile rendez-vous |
| `--idea-100` | `#FBE2AE` | fond tuile idées |
| `--idea-700` | `#8A5A10` | texte sur tuile idées |
| `--danger` | `#E23A2E` | retard, suppression, recording dot |
| `--hairline` | `rgba(16,16,16,.06)` | bordures de cartes |
| `--hairline-2` | `rgba(16,16,16,.08)` | bordures de champs |
| `--hairline-3` | `rgba(16,16,16,.07)` | bordures légères |
| `--shadow-card` | `0 6px 20px rgba(16,16,16,.07)` | ombre carte |
| `--shadow-fab` | `0 8px 20px rgba(16,16,16,.28)` | ombre FAB |
| `--shadow-nav` | `0 10px 28px rgba(16,16,16,.1)` | ombre nav basse |

### Typographie

- **Plus Jakarta Sans** : 400, 500, 600, 700, 800 (Google Fonts, plus `next/font/google`)
- **JetBrains Mono** : 400, 500 (labels monospace uniquement)
- Échelle : 34/28/20/17/15/12.5/11/10 px (8 crans, pas un de plus)
- `font-variant-numeric: tabular-nums` pour les chiffres

### Radius

12 / 18 / 20 / 24 / pill (99px)

### Spacing

4 · 8 · 12 · 16 · 20 · 24 · 28 · 34 · gutter écran 20px · hit-area min 44px

### Animations (keyframes du design)

- `brf-wave` : waveform en écoute
- `brf-idle` : waveform au repos
- `brf-collapse` : waveform qui s'effondre (transcription)
- `brf-pop` : items structurés qui apparaissent
- `brf-rail` : rail noir qui se déploie
- `brf-shimmer` : skeleton loading
- `brf-ping` : dot recording qui pulse
- `brf-fade` : fondu entrée
- `brf-sheet` : sheet qui monte

---

## Étapes de reconstruction

### Phase 0 : Préparation (sans toucher le code existant)

#### Task 0.1 : Créer la branche

```bash
cd /opt/data/Projets/brief
git checkout feat/task-completion
git pull origin feat/task-completion
git checkout -b feat/ui-redesign-claude
```

#### Task 0.2 : Installer Plus Jakarta Sans + JetBrains Mono

**Files :**
- Modify: `src/app/layout.tsx` — remplacer `localFont` General Sans par `next/font/google` Plus Jakarta Sans + JetBrains Mono
- Delete: `src/app/fonts/GeneralSans-*.woff2` (4 fichiers)
- Modify: `package.json` — pas de nouvelle dépendance (`next/font/google` est built-in)

**Détail :**

```tsx
// layout.tsx — nouveau
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

// Dans le <html> : className={`${jakarta.variable} ${mono.variable}`}
```

#### Task 0.3 : Réécrire globals.css — tokens complets

**Files :**
- Modify: `src/app/globals.css` (remplacement complet)

Remplacer tout le contenu par les nouveaux tokens. Garder `@import "tailwindcss"` en tête. Définir les variables CSS dans `@layer base` pour le mode clair uniquement (mode sombre reporté). Ajouter les keyframes d'animation. Conserver `.safe-top` / `.safe-bottom` (invariants iOS).

#### Task 0.4 : Configurer tailwind.config.ts

**Files :**
- Modify: `tailwind.config.ts` (actuellement vide)

Ajouter `theme.extend` avec les couleurs, fonts, radius, shadows, animations.

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        ink: { DEFAULT: "var(--ink)", muted: "var(--ink-muted)", faint: "var(--ink-faint)" },
        task: { 100: "var(--task-100)", 700: "var(--task-700)" },
        meet: { 100: "var(--meet-100)", 700: "var(--meet-700)" },
        idea: { 100: "var(--idea-100)", 700: "var(--idea-700)" },
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "-apple-system", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        12: "12px", 18: "18px", 20: "20px", 24: "24px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        fab: "var(--shadow-fab)",
        nav: "var(--shadow-nav)",
      },
      keyframes: {
        wave: { "0%,100%": { transform: "scaleY(.28)" }, "50%": { transform: "scaleY(1)" } },
        idle: { "0%,100%": { transform: "scaleY(.4)" }, "50%": { transform: "scaleY(.9)" } },
        collapse: { "0%": { transform: "scaleY(1)", opacity: "1" }, "70%": { transform: "scaleY(.05)", opacity: ".5" }, "100%": { transform: "scaleY(.04)", opacity: ".18" } },
        pop: { from: { opacity: "0", transform: "translateY(14px) scale(.97)" }, to: { opacity: "1", transform: "none" } },
        rail: { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
        shimmer: { "0%": { backgroundPosition: "-220px 0" }, "100%": { backgroundPosition: "calc(220px + 100%) 0" } },
        ping: { "0%": { transform: "scale(1)", opacity: ".35" }, "100%": { transform: "scale(1.9)", opacity: "0" } },
        fade: { from: { opacity: "0" }, to: { opacity: "1" } },
        sheet: { from: { transform: "translateY(30px)", opacity: ".6" }, to: { transform: "none", opacity: "1" } },
      },
      animation: {
        wave: "wave .95s ease-in-out infinite",
        idle: "idle 1.6s ease-in-out infinite",
        collapse: "collapse .7s cubic-bezier(.4,0,.2,1) both",
        pop: "pop .45s cubic-bezier(.2,.9,.3,1) both",
        rail: "rail .5s cubic-bezier(.4,0,.2,1) both",
        shimmer: "shimmer 1.1s linear infinite",
        ping: "ping 1.4s ease-out infinite",
        fade: "fade .3s both",
        sheet: "sheet .3s cubic-bezier(.2,.9,.3,1) both",
      },
    },
  },
} satisfies Config;
```

#### Task 0.5 : Réécrire icons.tsx — nouveaux SVG

**Files :**
- Modify: `src/components/icons.tsx` (remplacement complet)

Reprendre exactement les SVG du design system (lignes 92, 101, 110, 119, 137-148, 159, 169, 228-235, 250-252, 343, 415-417, 496-499, 600, 609, etc.). Icônes nécessaires :
- `MicIcon` (micro, plusieurs tailles : 15, 18, 22, 34)
- `CheckIcon` (coche terminer)
- `ChevronLeftIcon` (retour)
- `ChevronRightIcon` (suivant, voir plus)
- `DotsIcon` (plus d'options, 3 points)
- `BellIcon` (notifications)
- `HelpIcon` (?)
- `SearchIcon` (loupe)
- `HomeIcon` (maison)
- `IdeaIcon` (ampoule/soleil)
- `PlusIcon` (FAB +)
- `CloseIcon` (X)
- `PlayIcon` (triangle lecture)
- `StopIcon` (carré stop)
- `ClockIcon` (horloge)
- `CalendarIcon` (calendrier)
- `CheckTaskIcon` (coche liste tâches)
- `ArrowRightIcon` (flèche droite)

---

### Phase 1 : Composants partagés

#### Task 1.1 : Skeleton (chargement)

**Files :**
- Create: `src/components/Skeleton.tsx`

Composant réutilisable : barres shimmer avec délais alternés. Reprendre le pattern du design (gradient linéaire, `bg-[length:220px_100%]`, `animate-shimmer`).

```tsx
export function SkeletonRow() { ... }
export function SkeletonCard() { ... }
export function SkeletonList({ count = 3 }: { count?: number }) { ... }
```

#### Task 1.2 : EmptyState (état vide)

**Files :**
- Create: `src/components/EmptyState.tsx`

Encart centré : cercle dashed 52px + icône + titre 17/700 + description 13/500 + bouton optionnel. Reprendre le pattern du design (lignes 186-193).

#### Task 1.3 : Card

**Files :**
- Create: `src/components/Card.tsx`

Wrapper : `bg-white border border-ink/[.06] rounded-[20px] p-4`. Props : `children`, `className?`, `onClick?`.

#### Task 1.4 : Chip

**Files :**
- Create: `src/components/Chip.tsx`

Pill : `h-8 px-3 rounded-full text-xs font-bold`. Variantes : `task` (bg-task-100 text-task-700), `meet` (bg-meet-100 text-meet-700), `idea` (bg-idea-100 text-idea-700), `neutral` (bg-white border text-ink).

#### Task 1.5 : VoiceBadge (marqueur 3 barres)

**Files :**
- Create: `src/components/VoiceBadge.tsx`

Marqueur "créé à la voix" : 3 barres verticales de hauteurs différentes (4px, 9px, 6px), couleur `#C4C4BD`. Tailles : small (10px haut, pour listes) et medium (16px, pour détails).

#### Task 1.6 : Waveform

**Files :**
- Create: `src/components/Waveform.tsx`

Trois variantes :
- `WaveformActive` : 21 barres, `animate-wave`, délais décalés, hauteur variable 14-74px
- `WaveformIdle` : 5 barres, `animate-idle`, hauteur 6-17px
- `WaveformCollapsed` : 21 barres, `animate-collapse`, délais séquentiels

Toutes : barres `width:5px border-radius:99px bg-ink`.

#### Task 1.7 : BottomNav

**Files :**
- Create: `src/components/BottomNav.tsx`
- Delete: `src/components/TabBar.tsx`

Navigation basse flottante : container pill blanc avec ombre nav, 4 entrées + FAB central saillant.
- Accueil (maison) — `goHome`
- Recherche (loupe) — `goSearch`
- FAB + (saillant, bg-ink, shadow-fab) — `openSheet`
- Idées (ampoule) — `goIdeas`

Props : `current: Screen`, `onNavigate: (s: Screen) => void`, `onCapture: () => void`.

Note : l'onglet actif a `bg-[#F4F4F2]` au lieu de `bg-transparent`.

#### Task 1.8 : CaptureBar (pill fixe)

**Files :**
- Create: `src/components/CaptureBar.tsx`

Barre de capture fixe en bas, au-dessus de la BottomNav. Pill blanche avec ombre card, waveform idle à gauche (5 barres), placeholder "Dis-moi ce que tu as en tête…", bouton micro 44px bg-ink à droite.

Props : `onClick: () => void`.

#### Task 1.9 : AccountAvatar

**Files :**
- Create: `src/components/AccountAvatar.tsx`

Cercle 46px avec initiales, anneau `border-2 border-ink/12%`. Couleur de fond paramétrable (défaut : task-100, texte task-700).

---

### Phase 2 : Écrans principaux

#### Task 2.1 : HomeScreen

**Files :**
- Create: `src/components/HomeScreen.tsx`
- Delete: `src/components/OverviewScreen.tsx` (remplacé)

**Layout (top to bottom) :**

1. **Header** : `AccountAvatar` (initiales "AM" pour Aramis) à gauche, `HelpIcon` + `BellIcon` (avec dot rouge si notifs) à droite
2. **Titre** : "Salut Aramis," (34px/800) + "Qu'est-ce qu'on organise&nbsp;?" (34px/800, couleur ink-faint)
3. **4 tuiles en grid 2×2** (gap 12px, min-height 132px, radius 24px) :
   - Tâches (bg-task-100, icône check dans cercle blanc, "5 aujourd'hui")
   - Rendez-vous (bg-meet-100, icône calendrier, "2 · Calendrier Apple")
   - Idées (bg-idea-100, icône ampoule, "7 à trier")
   - Demander à l'IA (bg-ink, icône étoile, texte blanc, "Assistant")
4. **Section "Aujourd'hui"** : label 20/700 + date 13/600 à droite
5. **Liste des items du jour** : carte blanche radius-20, padding 6px 4px
   - Chaque ligne : checkbox 26px (cercle, border 2px) + titre 15/600 + métadonnée (dot projet + libellé + VoiceBadge si vocal) + heure 13/700
   - Séparateur 1px entre lignes
6. **États** : Rempli (liste), Vide (EmptyState "Journée libre" + bouton "Capturer une idée"), Chargement (SkeletonRow ×3)

**Props :** `overview: Overview | null`, `items: Item[]`, `projects: Project[]`, `onToggleDone: (id: string) => void`, `onOpenTask: (id: string) => void`, `onOpenAgenda: () => void`, `onOpenIdeas: () => void`, `onOpenAccount: () => void`, `onCapture: () => void`, `loading: boolean`.

Les tuiles sont cliquables : Tâches → scroll vers la liste, RDV → Agenda, Idées → IdeasScreen, IA → ouvre le sheet capture en mode "Demander à l'IA".

#### Task 2.2 : TaskDetailScreen

**Files :**
- Create: `src/components/TaskDetailScreen.tsx`
- Delete: `src/components/TaskSheet.tsx` (remplacé)

**Layout :**

1. **Header** : bouton retour (cercle 44px, border) + bouton options (3 points)
2. **Chips** : chip projet (task/meet/idea selon kind) + chip horaire (border, icône horloge + "Aujourd'hui 14:30")
3. **Titre** : 28px/800
4. **Fil d'origine** (carte) : 
   - Label mono "FIL D'ORIGINE · 19 AOÛT · 12 S" + bouton play 32px bg-ink
   - Waveform statique (barres gris sauf le segment actif en ink)
   - Segment "0:03 → 0:07" en mono
   - Citation avec extrait surligné (bg-idea-100, border-radius 5px, padding 1px 4px)
   - Lien "2 autres items de cette dictée" → navigue vers les autres items
5. **Sous-tâches** (carte) :
   - Label "Sous-tâches" + compteur "2/3"
   - Barre de progression 5px (bg track + bg-ink fill)
   - Liste de checkboxes 24px + texte 14.5/600 (rayé si coché)
6. **Boutons d'action** :
   - "Terminer" (bg-ink, pill 52px, icône check)
   - "Reporter" (border, bg-white) + "Supprimer" (border danger, texte danger)

**Props :** `item: Item`, `projects: Project[]`, `onBack: () => void`, `onDone: (id: string) => void`, `onPostpone: (id: string) => void`, `onDelete: (id: string) => void`, `onToggleSub: (itemId: string, subId: string) => void`.

**Note :** Le type `Item` doit être étendu pour supporter `subtasks` et `audioOrigin` (voir Task 3.1).

#### Task 2.3 : AgendaScreen

**Files :**
- Create: `src/components/AgendaScreen.tsx`

**Layout :**

1. **Header** : bouton retour + titre centré "Août 2026" + badge "Calendrier Apple" (dot vert) + bouton semaine suivante
2. **Grille semaine** : 7 colonnes (L M M J V S D), jour actuel en bg-ink/text-white, autres en bg-white/border
3. **Timeline events** : groupés par matin/après-midi (labels mono), chaque event = heure à gauche (46px) + carte à droite avec border-left coloré (4px) selon le type (task = task-700, event = meet-700)
4. **États** : Rempli, Vide ("Aucun rendez-vous"), Chargement (skeleton)

**Props :** `items: Item[]`, `projects: Project[]`, `onBack: () => void`, `loading: boolean`.

Les events viennent des items `kind === "event"` + items `kind === "task"` avec une date + sync CalDAV.

#### Task 2.4 : IdeasScreen

**Files :**
- Create: `src/components/IdeasScreen.tsx`

**Layout :**

1. **Header** : bouton retour + badge "7 à trier" (bg-idea-100, text-idea-700, pill)
2. **Titre** : "Idées" (30px/800) + description "Tout ce que tu as capturé sans le ranger. Convertis en tâche d'un geste." (13.5/500)
3. **Cartes idée** (gap 12px) :
   - En-tête : dot couleur + métadonnée "Vocal 8 s · il y a 2 h" (11.5/700, ink-faint)
   - Texte de l'idée (15/600)
   - Bouton "Convertir en tâche" (bg-ink, pill 44px, icône check) + bouton archiver (cercle border, icône X)
   - Les idées anciennes/grises ont `opacity:.55`
4. **États** : Rempli, Vide ("Boîte à idées vide" + bouton "Dicter une idée"), Chargement

**Props :** `ideas: Item[]`, `projects: Project[]`, `onConvert: (id: string) => void`, `onArchive: (id: string) => void`, `onBack: () => void`, `onCapture: () => void`, `loading: boolean`.

**Note :** Les "idées" sont un nouveau type d'item ou un flag sur `Item` (voir Task 3.1).

#### Task 2.5 : SearchScreen

**Files :**
- Create: `src/components/SearchScreen.tsx`

**Layout :**

1. **Header** : "Rechercher" (22/800) + AccountAvatar à droite
2. **Barre de recherche** : pill 52px, icône loupe + input + bouton micro 40px bg-ink
3. **Filtres** (scroll horizontal) : Tout (bg-ink) / Tâches / Idées / Dicté (avec VoiceBadge)
4. **Résultats** : label mono "3 RÉSULTATS · « DUVAL »", cartes avec icône type (cercle coloré) + titre avec highlight (bg-idea-100 sur le terme) + métadonnée
5. **États** : Rempli, Vide ("Rien trouvé" + "Essaie un mot de la dictée d'origine"), Chargement

**Props :** `items: Item[]`, `projects: Project[]`, `onOpenItem: (id: string) => void`, `onVoiceSearch: () => void`.

La recherche cherche dans : `title`, `notes`, et le texte de la transcription d'origine (`audioOrigin.text`).

---

### Phase 3 : Sheets modaux

#### Task 3.1 : Étendre les types pour le design system

**Files :**
- Modify: `src/lib/types.ts`

Ajouter :

```ts
/** Une sous-tâche d'un item. */
export type SubTask = {
  id: string;
  title: string;
  done: boolean;
};

/** Fil d'origine vocal d'un item. */
export type AudioOrigin = {
  /** Texte complet de la transcription. */
  text: string;
  /** Extrait surligné dans la transcription. */
  highlight: string;
  /** Segment temporel dans l'enregistrement. */
  startSec: number;
  endSec: number;
  /** Durée totale de l'enregistrement. */
  durationSec: number;
  /** Date de la dictée. */
  date: string;
  /** IDs des autres items issus de la même dictée. */
  siblingIds: string[];
};

/** Type d'item étendu : idée non rangée. */
export type ItemStatus = "active" | "idea" | "archived";
```

Étendre `DraftItem` :
```ts
export type DraftItem = {
  // ... champs existants ...
  subtasks?: SubTask[];
  audioOrigin?: AudioOrigin;
  status?: ItemStatus; // "active" par défaut
};
```

Étendre `Item` :
```ts
export type Item = DraftItem & {
  // ... champs existants ...
};
```

Étendre `View` :
```ts
export type Screen = "home" | "task" | "agenda" | "ideas" | "search";
```

#### Task 3.2 : CaptureSheet (sheet de capture, 4 stages)

**Files :**
- Create: `src/components/CaptureSheet.tsx`
- Delete: `src/components/CaptureScreen.tsx` (remplacé)
- Delete: `src/components/ReviewScreen.tsx` (remplacé — le review est intégré au stage "done")

**Layout du sheet (rounded-t-[30px] bg-white) :**

**Stage 1 — Idle :**
- Titre "Capturer" + bouton fermer
- Gros bouton micro 104px bg-ink (shadow 0 12px 30px)
- "Appuie pour parler" (16/700)
- Description "Brief écoute, transcrit, puis découpe en tâches, RDV ou idées." (13/500)
- Séparateur "OU"
- Input texte "Écrire à la place…" + bouton flèche (bg-ink 40px)

**Stage 2 — Listening :**
- Dot rouge pulsant (animate-ping) + "J'écoute…" + timer mono `0:14`
- Waveform active 21 barres (animate-wave, hauteurs 14-74px)
- Bouton "Terminer" (bg-ink, pill 52px)

**Stage 3 — Transcribing :**
- "Transcription…" (14/700, ink-muted)
- Waveform qui s'effondre (animate-collapse, 21 barres, délais séquentiels 0.03s)
- 3 barres shimmer (skeleton texte)

**Stage 4 — Done :**
- Citation d'origine dans encart (bg-bg, radius 18px) avec VoiceBadge grise
- Rail noir qui se déploie (animate-rail) + label "3 ÉLÉMENTS STRUCTURÉS"
- Items structurés qui pop un par un (animate-pop, délais 0.1/0.25/0.4s) :
  - Checkbox vide 24px + titre + métadonnée type (dot coloré + "Tâche · demain 14:30" ou "Idée · à trier")
- Boutons : "Rejouer" (border) + "Ajouter les 3" (bg-ink, pill 52px)

**Props :** `open: boolean`, `stage: "idle" | "listening" | "transcribing" | "done"`, `seconds: number`, `transcript: string`, `drafts: DraftItem[]`, `projects: Project[]`, `onStartListen: () => void`, `onStopListen: () => void`, `onSubmitText: (text: string) => void`, `onConfirm: () => void`, `onReplay: () => void`, `onClose: () => void`, `micError: RecorderError | null`.

**Gestion des erreurs micro :** si `micError` est non-null, afficher l'état "micro refusé" dans le stage idle (encart explicatif + bouton "Autoriser dans les réglages" + input texte reste disponible).

#### Task 3.3 : AccountSheet (compte & réglages)

**Files :**
- Create: `src/components/AccountSheet.tsx`
- Delete: `src/components/SettingsScreen.tsx` (remplacé)

**Layout du sheet :**

1. Poignée + bouton fermer
2. Profil : avatar 56px + nom + email + plan ("Brief Plus")
3. **Section réglages** (bg-bg, radius 20px, padding 4px) :
   - Calendrier Apple (icôle verte + "Synchronisé il y a 4 min" + toggle ON)
   - Structuration auto (icône micro noire + "Découper la dictée sans confirmation" + toggle OFF)
   - Rappels du matin (icône idée jaune + "Tous les jours à 8:00" + toggle ON)
4. **Navigation** (list rows) :
   - "Voix, langue & transcription" →
   - "Confidentialité des notes vocales" →
   - "Abonnement" → "Plus" →
5. Bouton "Fermer" (border, pill 52px)

**Props :** `open: boolean`, `onClose: () => void`, `settings: AppSettings`, `onToggleSetting: (key: string) => void`.

---

### Phase 4 : Orchestrateur

#### Task 4.1 : BriefApp.tsx (réécriture complète)

**Files :**
- Modify: `src/components/BriefApp.tsx` (remplacement complet, 697 → ~400 lignes)

**Responsabilités :**

1. **State global** : `screen: Screen`, `captureOpen: boolean`, `accountOpen: boolean`, `selectedTaskId: string | null`, `items`, `projects`, `overview`, `loading`
2. **Phases de capture** : `idle → listening → transcribing → done` (réutilise `useRecorder` existant + `transcribeAudio` + `parseNote` + `saveItems`)
3. **Navigation** :
   - `goHome` → screen = "home"
   - `goTask(id)` → screen = "task", selectedTaskId = id
   - `goAgenda` → screen = "agenda"
   - `goIdeas` → screen = "ideas"
   - `goSearch` → screen = "search"
   - `openSheet` → captureOpen = true
   - `openAccount` → accountOpen = true
4. **Rendu conditionnel** : un seul écran visible à la fois, avec `animate-fade` sur le changement
5. **Overlay** : CaptureSheet et AccountSheet en absolute au-dessus
6. **PinGate** : toujours en premier, inchangé logiquement, refondu visuellement
7. **Queue** : conserver la logique de file locale existante (`src/lib/queue.ts`)
8. **Toast** : conservé, refondu visuellement

**Structure :**

```tsx
if (!hydrated) return null;
if (needPin) return <PinGate onSuccess={...} />;

return (
  <PhoneFrame>
    {screen === "home" && <HomeScreen ... />}
    {screen === "task" && <TaskDetailScreen item={selectedItem} ... />}
    {screen === "agenda" && <AgendaScreen ... />}
    {screen === "ideas" && <IdeasScreen ... />}
    {screen === "search" && <SearchScreen ... />}
    <CaptureBar onClick={openSheet} />
    <BottomNav current={screen} onNavigate={...} onCapture={openSheet} />
    {captureOpen && <CaptureSheet ... />}
    {accountOpen && <AccountSheet ... />}
    <Toast ... />
  </PhoneFrame>
);
```

#### Task 4.2 : PinGate.tsx (refonte visuelle)

**Files :**
- Modify: `src/components/PinGate.tsx`

Garder la logique (6 chiffres, clavier numérique, verifyPin/setPin). Refondre visuellement : fond bg, carte blanche radius-24, chiffres en Plus Jakarta Sans 800, touches 44px minimum, bouton supprimer.

#### Task 4.3 : PhoneFrame.tsx (refonte visuelle)

**Files :**
- Modify: `src/components/PhoneFrame.tsx`

Le design system montre un cadre iOS à 390×844. Conserver le comportement responsive (plein écran sur mobile, cadre sur desktop). Fond `#EFEEEA` (couleur canvas du design system) au lieu de `#DCD8D2`. StatusBar simulée à 58px.

#### Task 4.4 : Toast.tsx (refonte visuelle)

**Files :**
- Modify: `src/components/Toast.tsx`

Refondre : pill blanche avec ombre, icône + texte, position bottom-24, `animate-fade`.

---

### Phase 5 : Backend — ajustements minimes

#### Task 5.1 : Route API — support des idées

**Files :**
- Modify: `src/app/api/items/route.ts`

Le champ `status` est optionnel sur les items existants (`"active"` par défaut). La route `GET /api/items` doit accepter un query param `?status=idea` pour filtrer les idées. Aucun changement au schéma de stockage — c'est un champ supplémentaire optionnel dans le JSON.

#### Task 5.2 : Route API — support des sous-tâches

**Files :**
- Modify: `src/app/api/items/route.ts`
- Modify: `src/lib/completion.ts`

`completionPatch` doit cocher/décocher une sous-tâche individuelle si `subtaskId` est fourni dans le patch, en plus du comportement existant de l'item complet.

#### Task 5.3 : Route API — recherche dans les transcriptions

**Files :**
- Create: `src/app/api/search/route.ts`

Nouvelle route : `GET /api/search?q=duval`. Cherche dans `title`, `notes`, `audioOrigin.text`, `audioOrigin.highlight`. Retourne les items correspondants avec le type de match. Protégée par `requirePin`.

#### Task 5.4 : Route API — agenda

**Files :**
- Create: `src/app/api/agenda/route.ts`

Nouvelle route : `GET /api/agenda?week=2026-08-19`. Retourne les events et tasks datés pour la semaine donnée, groupés par jour et par matin/après-midi. Protégée par `requirePin`.

---

### Phase 6 : Nettoyage

#### Task 6.1 : Supprimer les composants obsolètes

```bash
rm src/components/OverviewScreen.tsx    # remplacé par HomeScreen
rm src/components/TasksScreen.tsx       # remplacé par HomeScreen + SearchScreen
rm src/components/TaskSheet.tsx         # remplacé par TaskDetailScreen
rm src/components/CaptureScreen.tsx     # remplacé par CaptureSheet
rm src/components/ReviewScreen.tsx       # remplacé par CaptureSheet stage done
rm src/components/SettingsScreen.tsx     # remplacé par AccountSheet
rm src/components/TabBar.tsx            # remplacé par BottomNav
rm src/components/DoneBox.tsx            # remplacé par checkbox inline
rm src/app/fonts/GeneralSans-*.woff2    # remplacé par Google Fonts
```

#### Task 6.2 : Supprimer les anciens design docs obsolètes

```bash
rm -rf docs/designs/preview-v2 docs/designs/preview-v3 docs/designs/preview-v4
rm -rf docs/designs/preview-v5 docs/designs/preview-v6 docs/designs/preview-v7
rm docs/designs/2026-08-16-brief-design-v4.md
rm docs/designs/preview-systeme.html
rm docs/designs/prompt-direction-artistique-v*.md
rm docs/designs/organiseur-autonome.md
```

#### Task 6.3 : Mettre à jour DESIGN.md

**Files :**
- Modify: `DESIGN.md` (remplacement complet)

Remplacer par le nouveau design system : Plus Jakarta Sans, palette task/meet/idea, tokens, recettes Tailwind, principes du design Claude. Conserver les invariants non-visuels (safe areas, reset CSS, NEXT_PUBLIC au build, etc.).

#### Task 6.4 : Mettre à jour AGENTS.md

**Files :**
- Modify: `AGENTS.md`

Mettre à jour les références à DESIGN.md (tokens changés). Conserver tous les invariants backend (PIN, CalDAV, dates, store, etc.).

#### Task 6.5 : Tests

**Vérification complète :**

```bash
npx vitest run          # suite existante doit rester verte
npx tsc --noEmit         # types
npx eslint .             # lint
```

Les tests existants (`*.test.ts`) ne touchent pas à l'UI — ils testent le backend (`due`, `buckets`, `completion`, `caldav`, `reminders`, `pin`, `projects`, `tasks`, `rrule`, `digest`). Ils doivent rester verts sans modification.

Ajouter des tests pour les nouveaux types :
- `src/lib/types.test.ts` — validation des sous-tâches et audioOrigin
- `src/app/api/search/route.test.ts` — recherche dans transcriptions

#### Task 6.6 : Commit final

```bash
git add -A
git commit -m "feat: rebuild UI with Claude Design system v1

- Replace General Sans with Plus Jakarta Sans + JetBrains Mono
- New design tokens (task/meet/idea palette, radius 12-24, new shadows)
- New screens: HomeScreen, TaskDetailScreen, AgendaScreen, IdeasScreen, SearchScreen
- New sheets: CaptureSheet (4 stages), AccountSheet
- New components: BottomNav, CaptureBar, Waveform, VoiceBadge, Skeleton, EmptyState
- Extended types: subtasks, audioOrigin, ItemStatus
- New API routes: /api/search, /api/agenda
- Remove old components: OverviewScreen, TasksScreen, TaskSheet, CaptureScreen,
  ReviewScreen, SettingsScreen, TabBar, DoneBox
- Update DESIGN.md with new design system"
```

---

## Risques et points d'attention

1. **`useRecorder` inchangé** — la logique d'enregistrement (stream partagé, MIME types, levels) reste identique. Seul le rendu visuel change (waveform au lieu de l'ancien affichage).

2. **Queue locale inchangée** — `src/lib/queue.ts` reste tel quel. Les nouveaux items passent par la même file.

3. **CalDAV inchangé** — `src/lib/caldav.ts` et la route cron restent identiques. L'Agenda lit les items existants + le sync CalDAV.

4. **PIN inchangé** — `src/lib/pin.ts` et `src/lib/guard.ts` restent identiques. Seul le rendu visuel du PinGate change.

5. **Mode sombre reporté** — le design system dit explicitement "Mode sombre non traité". On ne code que le mode clair. Les variables CSS sont structurées pour pouvoir ajouter le sombre plus tard (`@media (prefers-color-scheme: dark)`).

6. **Widgets iOS abandonnés** — pas de widget, pas de Live Activity. PWA uniquement.

7. **Ce qui manque vs le brief v4** (reporté, à traiter plus tard) :
   - Hiérarchie temporelle NOW/Ensuite/RDV/En retard/Plus tard (le design a une liste plate "Aujourd'hui")
   - Écran "C'est noté" dédié (le stage Done du CaptureSheet fait office)
   - Triage à une question
   - Plan du jour
   - Registre (Tout)
   - États micro refusé / hors-ligne / échec IA (micro refusé géré dans CaptureSheet)
   - Desktop
   - Thème sombre

8. **Performance** — le design system utilise beaucoup d'animations CSS. S'assurer que `prefers-reduced-motion` est respecté (`motion-safe:` dans les classes Tailwind).

9. **Migration des données** — les items existants n'ont pas `subtasks`, `audioOrigin` ou `status`. Tous optionnels → pas de migration nécessaire, pas de breaking change.

---

## Ordre d'exécution recommandé

1. Phase 0 complète (tokens, fonts, config, icons) — fondations
2. Phase 1 complète (composants partagés) — briques
3. Phase 3.1 (types) — avant les écrans qui les utilisent
4. Phase 2 complète (écrans) — peut être parallélisée
5. Phase 3.2 + 3.3 (sheets) — après les écrans
6. Phase 4 (orchestrateur) — assemble tout
7. Phase 5 (backend) — peut être fait en parallèle avec la Phase 2
8. Phase 6 (nettoyage) — en dernier