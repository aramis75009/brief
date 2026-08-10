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

/**
 * Une des huit teintes de destination de DESIGN.md.
 *
 * Cinq au départ, parce que le service tiers dont Brief est issu plafonnait à
 * cinq projets. Ce plafond n'existe plus, et cinq teintes ne suffisaient plus.
 * On ne va pas au-delà de huit : au-delà, deux teintes voisines deviennent
 * indistinguables, surtout en mode sombre où elles se rapprochent. C'est la
 * FORME (`Shape`) qui prend le relais pour la capacité.
 */
export type Tint = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Seconde dimension d'identité d'un projet, à côté de la teinte.
 *
 * Elle coûte 8 px et se lit SANS couleur : c'est ce qui la rend utile aux
 * daltoniens et en mode sombre. 8 teintes × 5 formes = 40 destinations
 * distinguables avant la moindre répétition.
 */
export type Shape = "disc" | "square" | "diamond" | "ring" | "capsule";

/**
 * Projet Brief. `id` est une chaîne opaque : ne jamais la convertir en nombre,
 * ne jamais en déduire un ordre.
 */
export type Project = {
  id: string;
  name: string;
  tint: Tint;
  /** Forme du pastillage. Dérivée de l'`id` si absente — voir `shapeFor`. */
  shape?: Shape;
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
  /**
   * Horodatage de mise en file LOCALE, `null` ou absent dès que le serveur a
   * confirmé l'enregistrement.
   *
   * ⚠️ Volontairement distinct de `createdAt`. Les deux sont des dates de
   * création ; sans ce second champ, une note encore en file d'attente est
   * indiscernable d'une note enregistrée, et c'est exactement la confusion qui
   * fait croire qu'une dictée est en sécurité alors qu'elle peut encore être
   * perdue (Safari évince le stockage local sans prévenir).
   *
   * Le serveur ne l'écrit JAMAIS : il n'existe que côté client, le temps que la
   * file se vide.
   */
  pendingAt?: string | null;
};

/** Résultat d'enregistrement, item par item. */
export type SaveResult = { ok: true; id: string } | { ok: false; id: string; error: string };

export type View = "capture" | "review" | "tasks" | "overview" | "settings";

/* ---------------------------------------------------------------------------
 * Vision globale — la forme de `GET /api/overview`.
 *
 * C'est la seule chose que Brief fait et qu'aucune liste de tâches ne donne :
 * le poids RELATIF des projets. Les deux représentations de l'onglet (Charge et
 * Horizon) sortent de cette même réponse, jamais de deux appels — sinon deux
 * chiffres peuvent se contredire à l'écran parce que l'un a vieilli.
 * ------------------------------------------------------------------------ */

/** Un empilement : « ce projet pèse tant, ce jour-là ». */
export type OverviewStack = {
  projectId: string;
  name: string;
  tint?: Tint;
  shape?: Shape;
  count: number;
};

export type OverviewDay = {
  date: string;
  /** « auj. », « jeu », « ven »… */
  label: string;
  isToday: boolean;
  total: number;
  events: number;
  stacks: OverviewStack[];
};

export type OverviewProject = {
  id: string;
  name: string;
  tint: Tint;
  shape?: Shape;
  total: number;
  overdue: number;
  today: number;
  week: number;
  events: number;
};

/** Le jour le plus chargé des sept — « ton mur », avec de quoi l'alléger. */
export type OverviewPeak = {
  date: string;
  label: string;
  total: number;
  events: number;
  projects: number;
  items: {
    id: string;
    title: string;
    projectId: string;
    kind: ItemKind;
    due: string | null;
    allDay: boolean;
    priority: Priority;
  }[];
};

export type Overview = {
  generatedAt: string;
  horizon: OverviewDay[];
  overdueStacks: OverviewStack[];
  peak: OverviewPeak | null;
  totals: {
    open: number;
    overdue: number;
    today: number;
    week: number;
    doneToday: number;
    createdToday: number;
  };
  byProject: OverviewProject[];
  /** Dictées des 7 derniers jours ; l'index 6 est aujourd'hui. */
  activity: number[];
};

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
