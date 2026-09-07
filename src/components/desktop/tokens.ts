/**
 * Les tokens du design system, en un seul endroit pour le desktop.
 *
 * Neuf composants desktop déclaraient chacun leur propre `const C = {…}` avec
 * les mêmes cinq lignes. Le code de la refonte v2 lit celui-ci ; les anciens
 * composants garderont le leur tant qu'on ne les touche pas — les convertir
 * tous serait un refactoring sans rapport avec ce qu'on livre.
 *
 * ⚠️ Ce sont des `var(--…)`, pas des littéraux. C'est ce qui fait suivre le
 * mode sombre : une couleur écrite en dur ici s'y afficherait à l'identique et
 * deviendrait illisible, sans qu'aucun test ne le voie.
 */
export const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  danger: "var(--color-danger)",
  hairline: "var(--hairline)",
  hairline2: "var(--hairline-2)",
} as const;

/** Fond + encre d'une pastille, tels que le prototype les emploie. */
export type Pastel = { bg: string; fg: string };

export const PASTEL = {
  task: { bg: "var(--color-task-100)", fg: "var(--color-task-700)" },
  meet: { bg: "var(--color-meet-100)", fg: "var(--color-meet-700)" },
  idea: { bg: "var(--color-idea-100)", fg: "var(--color-idea-700)" },
  late: { bg: "var(--color-late-100)", fg: "var(--color-late-700)" },
  neutral: { bg: "var(--color-bg)", fg: "var(--color-ink-muted)" },
} as const satisfies Record<string, Pastel>;

/**
 * Statut → pastille.
 *
 * `done` est volontairement NEUTRE et non vert : le vert dirait « tout va
 * bien » là où l'information est « il n'y a plus rien à faire ici ». Une
 * colonne de tâches terminées toute verte tire l'œil vers ce qui ne demande
 * plus rien.
 */
export const STATUS_PASTEL = {
  done: PASTEL.neutral,
  late: PASTEL.late,
  atrisk: PASTEL.idea,
  ontrack: PASTEL.meet,
} as const;

/**
 * Priorité → pastille. Quatre niveaux, **1 = la plus haute** (RFC 5545).
 *
 * Le prototype n'en montrait que trois ; en écraser quatre sur trois créerait
 * une seconde échelle, exactement ce que `types.ts` interdit.
 */
export const PRIORITY_PASTEL: Record<1 | 2 | 3 | 4, Pastel> = {
  1: PASTEL.late,
  2: PASTEL.idea,
  3: PASTEL.task,
  4: PASTEL.neutral,
};

/** Le rayon des surfaces, du plus serré au plus doux. */
export const R = {
  chip: 999,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  card: 20,
  soft: 24,
} as const;

export const SHADOW = {
  card: "var(--shadow-card)",
  fab: "var(--shadow-fab)",
  nav: "var(--shadow-nav)",
} as const;
