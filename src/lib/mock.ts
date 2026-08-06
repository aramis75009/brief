import type { DueOption, Prio, PrioKey, Project, SentTask } from "./types";

/* Projets mockés — `tag` = libellé utilisé dans la syntaxe Quick Add (#Projet). */
export const PROJECTS: Project[] = [
  {
    id: "frip",
    name: "Frip & Trend",
    tag: "FripAndTrend",
    bg: "#EDE4EA",
    fg: "#58414F",
    kw: ["polo", "ralph", "lauren", "fripe", "friperie", "vinted", "vetement", "textile", "sourcing", "depot", "cintre", "etiquette", "shooting", "photographier", "photo", "lot de polos"],
  },
  {
    id: "flip",
    name: "My Flip",
    tag: "MyFlip",
    bg: "#E3E7EE",
    fg: "#3E4A5E",
    kw: ["flip", "sneakers", "console", "leboncoin", "colis", "poste", "expedi", "stock", "annonce", "rachat", "acheteur", "revente"],
  },
  {
    id: "weba",
    name: "Web@cadémie",
    tag: "Webacademie",
    bg: "#E6EAE4",
    fg: "#3F5145",
    kw: ["exercice", "react", "code", "bug", "api", "deploi", "git", "soutenance", "formateur", "cours", "projet ecole", "dev", "javascript", "tp"],
  },
  {
    id: "paupy",
    name: "La Table de Paupy",
    tag: "TableDePaupy",
    bg: "#EFE7DC",
    fg: "#5C4B36",
    kw: ["menu", "carte", "resto", "restaurant", "service", "fournisseur", "reservation", "cuisine", "dessert", "plat", "fiche technique", "salle"],
  },
  {
    id: "perso",
    name: "Perso",
    tag: "Perso",
    bg: "#E9E8E4",
    fg: "#4A4842",
    kw: ["medecin", "sport", "banque", "anniversaire", "courses", "maison", "dentiste", "mutuelle"],
  },
];

/* Priorités Todoist : p1 = la plus haute, p4 = par défaut. */
export const PRIOS: Record<PrioKey, Prio> = {
  p1: { label: "p1", long: "p1 · Urgent", bg: "#F6E4DB", fg: "#B2542F" },
  p2: { label: "p2", long: "p2 · Important", bg: "#F4EBDD", fg: "#8A6A2E" },
  p3: { label: "p3", long: "p3 · Normal", bg: "#E7EAEF", fg: "#495A72" },
  p4: { label: "p4", long: "p4 · Par défaut", bg: "#FFFFFF", fg: "#1C1A18" },
};

export const PRIO_ORDER: PrioKey[] = ["p1", "p2", "p3", "p4"];

/* Échéances : `text` reste en français naturel — Todoist le parse côté serveur.
   `days`/`weekday` ne servent qu'à l'affichage local (filtres Aujourd'hui / En retard). */
export const DUE_OPTIONS: DueOption[] = [
  { key: "none", label: "Pas d'échéance", text: "" },
  { key: "today", label: "aujourd'hui", text: "aujourd'hui", days: 0 },
  { key: "tonight", label: "ce soir", text: "ce soir", days: 0 },
  { key: "tomorrow", label: "demain", text: "demain", days: 1 },
  { key: "tomorrow14", label: "demain 14h", text: "demain 14h", days: 1 },
  { key: "day2", label: "après-demain", text: "après-demain", days: 2 },
  { key: "friday", label: "vendredi", text: "vendredi", weekday: 5 },
  { key: "beforefriday", label: "avant vendredi", text: "avant vendredi", weekday: 5 },
  { key: "monday", label: "lundi", text: "lundi", weekday: 1 },
  { key: "nextweek", label: "semaine prochaine", text: "semaine prochaine", days: 7 },
  { key: "eom", label: "fin de mois", text: "fin de mois", eom: true },
];

export const LANGS = [
  { code: "fr-FR", name: "Français (FR)", short: "FR" },
  { code: "fr-CA", name: "Français (CA)", short: "FR-CA" },
  { code: "en-US", name: "English (US)", short: "EN" },
];

export const DEMO_NOTES = [
  "Photographier le lot de polos Ralph Lauren demain 14h, puis republier les annonces Vinted, et aussi relancer l'acheteur du lot de sneakers c'est urgent",
  "Il faut finir l'exercice React avant vendredi, ensuite corriger le bug de l'API, également préparer la soutenance lundi c'est important",
  "Passer chercher les colis à la poste ce soir, puis mettre à jour le stock, et aussi appeler le fournisseur pour la nouvelle carte du restaurant",
  "Faire les fiches techniques des desserts, ensuite envoyer la facture au comptable dès que possible, également prendre rdv médecin la semaine prochaine",
];

/* ---- Helpers date ------------------------------------------------------- */

export const dueOpt = (key: string): DueOption =>
  DUE_OPTIONS.find((o) => o.key === key) ?? DUE_OPTIONS[0];

const pad2 = (n: number) => (n < 10 ? "0" + n : "" + n);

export const iso = (d: Date) =>
  d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

const nextWeekday = (target: number) => {
  const d = new Date();
  const diff = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
};

export function dueISOFor(key: string): string | null {
  const o = dueOpt(key);
  if (o.key === "none") return null;
  if (o.eom) {
    const d = new Date();
    return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }
  if (typeof o.weekday === "number") return iso(nextWeekday(o.weekday));
  return iso(addDays(o.days ?? 0));
}

export const fmtDate = (isoStr: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(isoStr + "T12:00:00"));

export const projectById = (id: string): Project =>
  PROJECTS.find((p) => p.id === id) ?? PROJECTS[0];

/* ---- Jeu de démo -------------------------------------------------------- */

let UID = 100;
export const uid = () => "task-" + ++UID;

export function demoSent(): SentTask[] {
  const mk = (
    title: string,
    projectId: string,
    dueKey: string,
    dueText: string,
    prio: PrioKey,
    sync: SentTask["sync"],
    dueISO?: string,
  ): SentTask => ({
    id: uid(),
    title,
    projectId,
    dueKey,
    dueText,
    dueISO: dueISO !== undefined ? dueISO : dueISOFor(dueKey),
    prio,
    sync,
  });

  return [
    mk("Photographier le lot de polos RL", "frip", "tomorrow14", "demain 14h", "p2", "synced"),
    mk("Trier le dépôt-vente de la semaine", "frip", "custom", "lundi dernier", "p3", "synced", iso(addDays(-2))),
    mk("Expédier les colis sneakers", "flip", "today", "aujourd'hui", "p1", "pending"),
    mk("Republier les annonces Leboncoin", "flip", "friday", "vendredi", "p3", "synced"),
    mk("Finir l'exercice React", "weba", "beforefriday", "avant vendredi", "p2", "synced"),
    mk("Corriger le bug API du projet", "weba", "custom", "hier", "p1", "synced", iso(addDays(-1))),
    mk("Appeler le fournisseur pour la carte", "paupy", "today", "aujourd'hui", "p2", "synced"),
    mk("Prendre rdv médecin", "perso", "nextweek", "semaine prochaine", "p4", "synced"),
  ];
}
