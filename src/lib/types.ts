/**
 * Modèle de domaine de Brief.
 *
 * Brief ne pousse plus dans le système de quelqu'un d'autre : il possède ses
 * données. Aucun type ici ne décrit une API externe.
 */

/**
 * Priorité — **1 est la plus haute**, convention iCalendar (RFC 5545).
 *
 * ⚠️ C'est l'inverse de la numérotation de Todoist (4 = urgente), d'où venait
 * ce projet. Une seule échelle existe désormais dans le code ; il n'y a plus de
 * conversion, donc plus de bug d'inversion possible. Ne pas réintroduire de
 * seconde échelle sans une fonction de correspondance testée.
 */
export type Priority = 1 | 2 | 3 | 4;

/**
 * Nature de l'item, et ce qu'elle décide.
 *
 * `task`  → une chose à faire, avec une échéance. Équivaut à un VTODO.
 * `event` → un rendez-vous, qui occupe un créneau. Équivaut à un VEVENT.
 *
 * La distinction est prise par le LLM à la structuration et **doit rester
 * visible et modifiable à la revue** : une erreur de classement ne se signale
 * autrement d'aucune façon.
 */
export type ItemKind = "task" | "event";

/** Une des cinq teintes de destination de DESIGN.md. */
export type Tint = 1 | 2 | 3 | 4 | 5;

/**
 * Projet Brief. `id` est une chaîne opaque : ne jamais la convertir en nombre,
 * ne jamais en déduire un ordre.
 */
export type Project = {
  id: string;
  name: string;
  tint: Tint;
  /** Mots-clés injectés dans le prompt pour aider au routage. */
  hints?: string[];
  archived?: boolean;
};

/** Couleurs résolues d'un projet, en variables CSS pour suivre le mode sombre. */
export type ProjectSkin = { bg: string; fg: string };

/**
 * Ce que la structuration produit et ce que la revue édite : un item pas encore
 * enregistré. Les dates sont **absolues et fusonnées** — la résolution du
 * français (« avant vendredi ») se fait à la structuration, pas plus tard.
 */
export type DraftItem = {
  id: string;
  kind: ItemKind;
  title: string;
  projectId: string;
  /** ISO 8601 avec décalage, ex. `2026-08-12T14:00:00+02:00`. `null` = sans échéance. */
  due: string | null;
  /** Journée entière : l'heure de `due` est alors sans signification. */
  allDay: boolean;
  priority: Priority;
  /** Règle de récurrence RFC 5545, ex. `FREQ=WEEKLY;BYDAY=TU`. */
  rrule: string | null;
  notes?: string;
};

/** Un item enregistré. */
export type Item = DraftItem & {
  createdAt: string;
  /** Horodatage du dernier rappel envoyé — empêche le double envoi. */
  remindedAt: string | null;
  doneAt: string | null;
};

/** Résultat d'enregistrement, item par item. */
export type SaveResult = { ok: true; id: string } | { ok: false; id: string; error: string };

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
  | "saving"
  | "success"
  | "error";
