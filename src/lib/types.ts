/** Priorité Todoist : 4 = urgent … 1 = par défaut. */
export type PrioValue = 4 | 3 | 2 | 1;

/**
 * Projet Todoist. `id` est une CHAÎNE alphanumérique (ex. `6hF34F5QgwXp7JHf`) —
 * ne jamais la convertir en nombre.
 */
export type Project = {
  id: string;
  name: string;
};

export type ProjectSkin = { bg: string; fg: string };

/** Charge utile envoyée telle quelle à l'API Todoist. */
export type TodoistTask = {
  content: string;
  /** Date en français naturel ("demain 14h"). Champ omis s'il n'y en a pas. */
  due_string?: string;
  /** Obligatoire : sans lui Todoist lit les dates en anglais et les ignore. */
  due_lang: "fr";
  priority: PrioValue;
  project_id: string;
};

/** Tâche éditable dans l'écran Revue (charge utile + identifiant local). */
export type Draft = TodoistTask & { id: string };

/** Résultat de création, tâche par tâche. */
export type PushResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type SentTask = Draft & {
  /** `sent` = créée dans Todoist, `failed` = à réessayer. */
  status: "sent" | "failed";
  todoistId?: string;
  error?: string;
};

export type View = "capture" | "review" | "tasks" | "settings";

export type ToastKind = "ok" | "err";

/**
 * État de la chaîne, de bout en bout. Un seul état à la fois : c'est lui qui
 * pilote les libellés, les spinners et ce qui est cliquable.
 */
export type Phase =
  | "idle"
  | "recording"
  | "uploading"
  | "transcribing"
  | "parsing"
  | "pushing"
  | "success"
  | "error";
