import type { Priority, Project, ProjectSkin, Shape, Tint } from "./types";

/**
 * Projets de Brief.
 *
 * Remplace l'ancien `todoist.ts`. Brief ne lit plus les projets d'un service
 * tiers : il possède les siens, sans plafond de nombre — c'était la première
 * raison du pivot.
 *
 * Les projets sont pour l'instant définis ici et surchargés par le stockage.
 * Quand Postgres arrivera, cette liste ne servira plus que d'amorçage au
 * premier démarrage.
 */

export const SEED_PROJECTS: Project[] = [
  {
    id: "inbox",
    name: "Inbox",
    tint: 5,
    shape: "disc",
    hints: [
      "tout le reste", "administratif", "URSSAF", "impôts", "banque", "santé", "médecin",
      "courses", "maison", "personnel",
    ],
  },
  {
    id: "frip-trend",
    name: "Frip & Trend",
    tint: 1,
    shape: "square",
    hints: [
      "friperie", "fripe", "vêtements", "textile", "polos", "Ralph Lauren", "Tommy Hilfiger",
      "Vinted", "Vestiaire Collective", "sourcing", "dépôt-vente", "cintres", "étiquettes",
      "shooting photo", "annonces de vêtements",
    ],
  },
  {
    id: "my-flip",
    name: "My Flip",
    tint: 2,
    shape: "diamond",
    hints: [
      "revente", "flip", "sneakers", "consoles", "Leboncoin", "colis", "poste", "expédition",
      "stock", "rachat", "acheteur", "négociation",
    ],
  },
  {
    id: "webacademie",
    name: "Web@cadémie",
    tint: 3,
    shape: "ring",
    hints: [
      "école", "Epitech", "Web@cadémie", "cours", "exercice", "React", "JavaScript", "code",
      "bug", "API", "déploiement", "git", "soutenance", "formateur", "dossier scolaire", "TP",
    ],
  },
  {
    id: "table-de-paupy",
    name: "La Table de Paupy",
    tint: 4,
    shape: "capsule",
    hints: [
      "restaurant", "resto", "menu", "carte", "service", "fournisseur", "réservation",
      "cuisine", "dessert", "plat", "fiche technique", "salle",
    ],
  },
];

export const INBOX_ID = "inbox";

/** Projet de repli : l'Inbox si elle existe, sinon le premier de la liste. */
export function inboxIdOf(projects: Project[]): string {
  return projects.find((p) => p.id === INBOX_ID)?.id ?? projects[0]?.id ?? INBOX_ID;
}

/**
 * Couleurs d'un projet, en variables CSS et non en hexadécimal : c'est ce qui
 * leur permet de basculer en mode sombre. Une couleur écrite en dur resterait
 * claire sur fond noir.
 *
 * Règle de DESIGN.md : une teinte DÉSIGNE un projet, elle ne décore jamais.
 */
export function skinFor(project: { id: string; tint?: Tint }): ProjectSkin {
  const tint = project.tint ?? tintFromId(project.id);
  return { bg: `var(--color-p${tint})`, fg: `var(--color-p${tint}-ink)` };
}

/**
 * Forme d'un projet — la seconde moitié de son identité visuelle.
 *
 * Elle existe parce que la teinte seule ne suffisait plus une fois le plafond de
 * cinq projets disparu : inventer une neuvième ou dixième teinte aurait produit
 * des couleurs qu'on ne distingue pas. La forme, elle, se lit sans couleur —
 * donc aussi en mode sombre, où les teintes se rapprochent, et pour un œil
 * daltonien.
 */
export function shapeFor(project: { id: string; shape?: Shape }): Shape {
  return project.shape ?? shapeFromId(project.id);
}

const SHAPES: Shape[] = ["disc", "square", "diamond", "ring", "capsule"];

/** Hachage stable de l'id. Une seule source pour la teinte ET la forme. */
function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Teinte stable dérivée de l'id, pour un projet créé sans teinte explicite.
 * Le même projet garde sa couleur d'une session à l'autre — c'est ce qui rend
 * l'écran Tâches lisible sans lire les libellés.
 */
export function tintFromId(id: string): Tint {
  return ((hashOf(id) % 8) + 1) as Tint;
}

/**
 * Forme stable dérivée du MÊME hachage que la teinte, mais d'un rang plus haut.
 *
 * Conséquence voulue : quand on parcourt des ids, c'est la teinte qui cycle
 * vite et la forme qui ne bouge qu'une fois les huit teintes épuisées. Les deux
 * ne changent jamais ensemble, donc deux projets voisins ne peuvent pas se
 * retrouver avec le même couple avant 40 destinations.
 */
export function shapeFromId(id: string): Shape {
  return SHAPES[Math.floor(hashOf(id) / 8) % SHAPES.length];
}

/* ---------------------------------------------------------------------------
 * Priorités — 1 est la plus haute (convention iCalendar). Une seule échelle
 * dans tout le code : plus aucune conversion, donc plus d'inversion possible.
 * ------------------------------------------------------------------------ */

export const PRIORITY_VALUES: Priority[] = [1, 2, 3, 4];

export const PRIORITIES: Record<Priority, { label: string; long: string; bg: string; fg: string }> = {
  1: { label: "p1", long: "p1 · Urgent", bg: "var(--color-action-lo)", fg: "var(--color-error)" },
  2: { label: "p2", long: "p2 · Important", bg: "var(--color-p4)", fg: "var(--color-warn)" },
  3: { label: "p3", long: "p3 · Normal", bg: "var(--color-p2)", fg: "var(--color-p2-ink)" },
  4: { label: "p4", long: "p4 · Par défaut", bg: "var(--color-tile)", fg: "var(--color-ink-3)" },
};

export function isPriority(v: unknown): v is Priority {
  return v === 1 || v === 2 || v === 3 || v === 4;
}

/**
 * Suggestions d'échéance de l'écran Revue.
 *
 * Ce sont des libellés d'interface : c'est `resolveDue()` qui les convertit en
 * date absolue. Brief ne stocke jamais « vendredi » — la résolution du français
 * lui incombe désormais, elle n'est plus déléguée à un service tiers.
 */
export const DUE_SUGGESTIONS = [
  "",
  "aujourd'hui",
  "ce soir",
  "demain",
  "demain 14h",
  "après-demain",
  "vendredi",
  "lundi",
  "semaine prochaine",
  "fin de mois",
];
