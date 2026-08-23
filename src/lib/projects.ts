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
    id: "perso",
    name: "Perso",
    tint: 4,
    shape: "disc",
  },
  {
    id: "sport",
    name: "Sport",
    tint: 5,
    shape: "capsule",
  },
  {
    id: "ia",
    name: "IA",
    tint: 6,
    shape: "disc",
  },
  {
    id: "fake",
    name: "Fake",
    tint: 7,
    shape: "square",
  },
  {
    id: "permis",
    name: "Permis",
    tint: 8,
    shape: "diamond",
  },
];

/**
 * Projet de repli, quand la destination est inconnue ou illisible.
 *
 * ⚠️ Remplace l'ancien `inboxIdOf`. Il existait une Inbox neutre qui servait de
 * fond de panier ; elle a été supprimée. Sans elle, le repli est le PREMIER
 * projet de la liste, ce qui veut dire qu'un item non routable atterrit dans un
 * vrai projet plutôt que dans une case à trier.
 *
 * Ce que ça reste acceptable : la destination est toujours visible et
 * modifiable sur l'écran de revue avant enregistrement, donc un mauvais routage
 * se voit. La seule voie sans revue est `/api/capture`, qui enregistre
 * directement — c'est là que le repli est réellement silencieux.
 *
 * Renvoie une chaîne vide si aucun projet n'existe : l'item devient orphelin et
 * s'affiche sous « Autre » dans l'écran Tâches. Inventer un identifiant serait
 * pire, il pointerait vers un projet fantôme.
 */
export function fallbackProjectId(projects: Project[]): string {
  return projects[0]?.id ?? "";
}

/* ---------------------------------------------------------------------------
 * Création d'un projet depuis l'écran Réglages.
 * ------------------------------------------------------------------------ */

/** Identifiant lisible dérivé du nom. Jamais réutilisé tel quel s'il existe. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  // Un nom entièrement non latin (ex. « 日本 ») produirait une chaîne vide :
  // on retombe sur un identifiant horodaté plutôt que sur "".
  return base || `projet-${Date.now().toString(36)}`;
}

export function uniqueProjectId(name: string, taken: Set<string>): string {
  const base = slugify(name);
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const ALL_TINTS: Tint[] = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Teinte et forme d'un nouveau projet : on prend le couple le MOINS utilisé.
 *
 * Dériver du hachage de l'identifiant, comme pour les projets sans teinte
 * explicite, donnerait des collisions dès le troisième ou quatrième projet. Ici
 * on regarde ce qui existe déjà, donc deux projets créés à la suite ne peuvent
 * pas se ressembler.
 */
export function nextSkin(existing: { tint?: Tint; shape?: Shape }[]): {
  tint: Tint;
  shape: Shape;
} {
  const count = <T,>(all: T[], used: (T | undefined)[]) => {
    const tally = new Map<T, number>(all.map((v) => [v, 0]));
    for (const u of used) if (u !== undefined && tally.has(u)) tally.set(u, tally.get(u)! + 1);
    return all.reduce((best, v) => (tally.get(v)! < tally.get(best)! ? v : best), all[0]);
  };
  return {
    tint: count(ALL_TINTS, existing.map((p) => p.tint)),
    shape: count(SHAPES, existing.map((p) => p.shape)),
  };
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

export const PRIORITIES: Record<Priority, { label: string; short: string; long: string; bg: string; fg: string }> = {
  1: { label: "p1", short: "Urgent", long: "p1 · Urgent", bg: "var(--color-action-lo)", fg: "var(--color-error)" },
  2: { label: "p2", short: "Élevé", long: "p2 · Élevé", bg: "var(--color-p4)", fg: "var(--color-warn)" },
  3: { label: "p3", short: "Normal", long: "p3 · Normal", bg: "var(--color-p2)", fg: "var(--color-p2-ink)" },
  4: { label: "p4", short: "Basse", long: "p4 · Basse", bg: "var(--color-page)", fg: "var(--color-ink-3)" },
};

export function isPriority(v: unknown): v is Priority {
  return v === 1 || v === 2 || v === 3 || v === 4;
}

/**
 * Valeur de l'option « Pas d'échéance » des sélecteurs d'échéance.
 *
 * ⚠️ Surtout pas la chaîne vide. Ces `<select>` sont verrouillés sur `value=""`
 * — c'est ce qui permet de rejouer deux fois de suite le même choix, puisque
 * React les y ramène après chaque changement. Une option portant elle aussi
 * `""` n'aurait donc jamais déclenché `change` : c'est exactement ce qui
 * rendait « Pas d'échéance » inopérant, dans la fiche comme à la revue. Une
 * échéance posée par erreur était définitive. Corrigé le 2026-08-14.
 */
export const DUE_CLEAR = "__clear";

/**
 * Suggestions d'échéance de l'écran Revue et de la fiche.
 *
 * Ce sont des libellés d'interface : c'est `resolveDue()` qui les convertit en
 * date absolue. Brief ne stocke jamais « vendredi » — la résolution du français
 * lui incombe désormais, elle n'est plus déléguée à un service tiers.
 *
 * L'option « Pas d'échéance » ne figure PAS dans cette liste : elle porte
 * `DUE_CLEAR` et se rend à part, pour la raison ci-dessus.
 */
export const DUE_SUGGESTIONS = [
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
