import type { PrioValue, Project, ProjectSkin } from "./types";

/**
 * Repli utilisé quand l'API Todoist est injoignable.
 *
 * ⚠️ Les identifiants de projet Todoist sont des CHAÎNES alphanumériques.
 * Ne jamais les passer par parseInt / Number : `6hF34F5QgwXp7JHf` deviendrait 6.
 */
export const FALLBACK_PROJECTS: Project[] = [
  { id: "6hF34F5QgwXp7JHf", name: "Inbox" },
  { id: "6hF453G3JVF5QcFR", name: "Frip & Trend" },
  { id: "6hF453Mcq4CGCfc6", name: "My Flip" },
  { id: "6hF453J5GgG6GQq3", name: "Web@cadémie" },
  { id: "6hF453R728GMMJPR", name: "La Table de Paupy" },
];

export const INBOX_ID = FALLBACK_PROJECTS[0].id;

/** Projet de repli : l'Inbox déclarée par l'API si elle existe, sinon la nôtre. */
export function inboxIdOf(projects: Project[]): string {
  const named = projects.find((p) => p.name.toLowerCase() === "inbox");
  if (named) return named.id;
  const known = projects.find((p) => p.id === INBOX_ID);
  if (known) return known.id;
  return projects[0]?.id ?? INBOX_ID;
}

/* ---------------------------------------------------------------------------
 * Habillage des chips projet — couleurs reprises de la maquette. Les projets
 * connus gardent leur teinte ; un projet inconnu reçoit une couleur stable
 * dérivée de son id, prise dans la même palette.
 * ------------------------------------------------------------------------ */
const SKINS: ProjectSkin[] = [
  { bg: "#EDE4EA", fg: "#58414F" },
  { bg: "#E3E7EE", fg: "#3E4A5E" },
  { bg: "#E6EAE4", fg: "#3F5145" },
  { bg: "#EFE7DC", fg: "#5C4B36" },
  { bg: "#E9E8E4", fg: "#4A4842" },
];

const BY_NAME: Record<string, ProjectSkin> = {
  "frip & trend": SKINS[0],
  "my flip": SKINS[1],
  "web@cadémie": SKINS[2],
  "la table de paupy": SKINS[3],
  inbox: SKINS[4],
};

export function skinFor(project: { id: string; name: string }): ProjectSkin {
  const known = BY_NAME[project.name.trim().toLowerCase()];
  if (known) return known;
  let h = 0;
  for (let i = 0; i < project.id.length; i++) h = (h * 31 + project.id.charCodeAt(i)) >>> 0;
  return SKINS[h % SKINS.length];
}

/* ---------------------------------------------------------------------------
 * Priorités.
 *
 * L'API Todoist numérote 4 = la plus haute … 1 = par défaut, à l'inverse des
 * libellés p1…p4 de la maquette. On garde les libellés à l'écran et on ne
 * manipule que la valeur API dans les données.
 * ------------------------------------------------------------------------ */
export const PRIO_VALUES: PrioValue[] = [4, 3, 2, 1];

export const PRIOS: Record<PrioValue, { label: string; long: string; bg: string; fg: string }> = {
  4: { label: "p1", long: "p1 · Urgent", bg: "#F6E4DB", fg: "#B2542F" },
  3: { label: "p2", long: "p2 · Important", bg: "#F4EBDD", fg: "#8A6A2E" },
  2: { label: "p3", long: "p3 · Normal", bg: "#E7EAEF", fg: "#495A72" },
  1: { label: "p4", long: "p4 · Par défaut", bg: "#FFFFFF", fg: "#1C1A18" },
};

export function isPrioValue(v: unknown): v is PrioValue {
  return v === 1 || v === 2 || v === 3 || v === 4;
}

/**
 * Indices de domaine par projet, injectés dans le prompt de structuration.
 *
 * Repris des listes de mots-clés de la maquette. Sans eux, un modèle 20B range
 * tout dans l'Inbox : il ne devine pas qu'Epitech relève de Web@cadémie ni que
 * « polos Ralph Lauren » relève de la friperie. Clés en minuscules.
 * Un projet absent de cette table est simplement décrit par son nom.
 */
export const PROJECT_HINTS: Record<string, string[]> = {
  "frip & trend": [
    "friperie", "fripe", "vêtements", "textile", "polos", "Ralph Lauren", "Tommy Hilfiger",
    "Vinted", "Vestiaire Collective", "sourcing", "dépôt-vente", "cintres", "étiquettes",
    "shooting photo", "annonces de vêtements",
  ],
  "my flip": [
    "revente", "flip", "sneakers", "consoles", "Leboncoin", "colis", "poste", "expédition",
    "stock", "rachat", "acheteur", "négociation",
  ],
  "web@cadémie": [
    "école", "Epitech", "Web@cadémie", "cours", "exercice", "React", "JavaScript", "code",
    "bug", "API", "déploiement", "git", "soutenance", "formateur", "dossier scolaire", "TP",
  ],
  "la table de paupy": [
    "restaurant", "resto", "menu", "carte", "service", "fournisseur", "réservation",
    "cuisine", "dessert", "plat", "fiche technique", "salle",
  ],
  inbox: [
    "tout le reste", "administratif", "URSSAF", "impôts", "banque", "santé", "médecin",
    "courses", "maison", "personnel",
  ],
};

/** Suggestions d'échéance proposées dans l'écran Revue, en français naturel. */
export const DUE_SUGGESTIONS = [
  "",
  "aujourd'hui",
  "ce soir",
  "demain",
  "demain 14h",
  "après-demain",
  "vendredi",
  "avant vendredi",
  "lundi",
  "semaine prochaine",
  "fin de mois",
];
