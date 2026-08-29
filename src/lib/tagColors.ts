/**
 * Palette des couleurs de tags (style Trello) — source UNIQUE.
 *
 * Avant le 29/08, cette map existait en 4 copies (KanbanCard,
 * DesktopSettings, DesktopTaskDetail, DependencyGraph) qui divergeaient
 * silencieusement ; l'« orange » valait #FFCC00 (un jaune). Les valeurs
 * sont alignées sur les teintes du design system : les couleurs de projets
 * p1–p8 (calendriers Apple d'Aramis, `globals.css` @theme) pour les teintes
 * saturées, le pastel `idea-100` pour le jaune doux.
 *
 * Les CLÉS sont persistées dans `tags.json` (prod) — ne jamais les renommer.
 * `TAG_COLORS` (types.ts) et cette map doivent rester en phase.
 */

export const TAG_COLOR_MAP: Record<string, string> = {
  yellow: "#FBE2AE", // idea-100 — pastel doux
  orange: "#FF9500", // p2/p7 — vrai orange (avant : #FFCC00, un jaune)
  red: "#FF3B30",    // p3
  purple: "#AF52DE", // p4
  blue: "#007AFF",   // p1
  green: "#34C759",  // p6
  teal: "#5AC8FA",
  brown: "#A2845E",  // p8
  pink: "#FF2D55",
  sky: "#64D2FF",
};

export const TAG_FALLBACK_COLOR = TAG_COLOR_MAP.blue;