export type PrioKey = "p1" | "p2" | "p3" | "p4";

export type Project = {
  id: string;
  name: string;
  /** Libellé utilisé dans la syntaxe Quick Add (#Projet). */
  tag: string;
  bg: string;
  fg: string;
  kw: string[];
};

export type Prio = {
  label: string;
  long: string;
  bg: string;
  fg: string;
};

export type DueOption = {
  key: string;
  label: string;
  /** Français naturel — c'est Todoist qui résout la date côté serveur. */
  text: string;
  days?: number;
  weekday?: number;
  eom?: boolean;
};

/** Résultat du découpage d'une note en tâches. Contrat stable : voir parse.ts. */
export type ParsedTask = {
  title: string;
  projectId: string;
  dueKey: string;
  dueText: string;
  prio: PrioKey;
};

/** Tâche en cours d'édition dans l'écran Revue. */
export type Draft = ParsedTask & {
  id: string;
  dueISO: string | null;
};

export type SyncState = "synced" | "pending";

/** Tâche envoyée, affichée dans l'écran Tâches. */
export type SentTask = Draft & {
  sync: SyncState;
};

export type View = "capture" | "review" | "tasks" | "settings";

export type ToastKind = "ok" | "err";
