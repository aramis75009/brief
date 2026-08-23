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
  /**
   * Durée du créneau en minutes (événements horaires uniquement).
   * Absent = 60 min par défaut à l'écriture CalDAV. Décision 18/08 :
   * « toutes les tâches doivent avoir un temps » — les créneaux de
   * publication Frip & Trend font 30 min (17:30→18:00, 18:00→18:30).
   */
  durationMinutes?: number;
  /**
   * Occurrences supprimées d'une série récurrente, en UTC RFC 5545
   * (`YYYYMMDDTHHMMSSZ`). Adoptées depuis le calendrier quand Aramis
   * supprime une occurrence dans l'app Calendrier (EXDATE du master) —
   * sinon le PUT suivant du sync les réécrit et l'occurrence réapparaît.
   */
  exdates?: string[];
  /**
   * Occurrences DÉCALÉES d'une série récurrente, adoptées depuis le
   * calendrier quand Aramis déplace une occurrence dans l'app Calendrier
   * (VEVENT override avec `RECURRENCE-ID` dans le même ICS que le master).
   *
   * Clé = `RECURRENCE-ID` (UTC RFC 5545, `YYYYMMDDTHHMMSSZ`) — l'occurrence
   * d'origine ; valeur = le nouveau DTSTART (UTC RFC 5545). Sans ce champ,
   * Brief ne voit que le master (premier VEVENT) et considère la série
   * « identique » → l'édition n'est jamais adoptée, l'agenda affiche
   * l'ancienne heure, les rappels sonnent à l'ancienne heure, et un PUT
   * réécrirait l'ICS SANS les overrides (perte définitive). Constaté en
   * prod le 2026-08-20 (Séance push, Poster/Reposter 10).
   */
  overrides?: Record<string, string>;
  notes?: string;
  /** Sous-tâches d'un item. */
  subtasks?: SubTask[];
  /** Tags / étiquettes (IDs de Tag). */
  tags?: string[];
  /** IDs d'items prédécesseurs — cette tâche ne peut pas démarrer avant. */
  dependsOn?: string[];
  /** ID de colonne Kanban (null = non placée). */
  columnId?: string | null;
  /** Fil d'origine vocal — la dictée d'où provient cet item. */
  audioOrigin?: AudioOrigin;
  /** Identifiant de l'audio persisté (`audio_…`) — pour rejouer l'enregistrement. */
  audioId?: string;
  /** Statut : "active" par défaut. "idea" pour la boîte à idées. */
  status?: ItemStatus;
};

/** Un item enregistré. */
export type Item = DraftItem & {
  createdAt: string;
  /** Horodatage du dernier rappel envoyé — empêche le double envoi. */
  remindedAt: string | null;
  doneAt: string | null;
  /**
   * Instant (ISO) de l'occurrence qu'une COCHE UTILISATEUR vient de terminer
   * sur une récurrence — posé UNIQUEMENT par `completionPatch` (jamais par le
   * cron des rappels, qui avance aussi `due` mais pour une tout autre raison :
   * planifier le prochain envoi, pas marquer quoi que ce soit comme fait).
   *
   * Distinguer les deux est le seul rôle de ce champ. `due` avance dans les
   * deux cas et ne permet donc pas de savoir si l'occurrence du jour reste à
   * faire. Sans lui, `buildDayAgenda` a dû choisir entre deux bugs
   * symétriques : cacher toute occurrence antérieure à `due` (coche « Séance
   * push » enfin respectée, MAIS « Reposter 10 articles »/« Poster 10
   * articles » — qui recouraient à `due` uniquement parce que leur rappel
   * avait déjà sonné, jamais cochés — disparaissaient du jour sans que rien
   * ne soit fait) ; ou tout montrer (l'inverse). Constaté en prod le
   * 2026-08-20. `buildDayAgenda` n'exclut plus qu'une occurrence dont
   * l'instant correspond EXACTEMENT à ce champ.
   */
  lastCompletedOccurrenceAt?: string | null;
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
  /**
   * Le DTSTART (format iCal, ex. `20260819T160000Z`) que la synchro CalDAV a
   * réellement écrit dans iCloud au dernier passage réussi. Distinct de
   * `due` : pour une série, `due` avance tout seul (cron des rappels,
   * complétion) sans que le calendrier ne le sache encore. Comparer le
   * calendrier à CE champ — plutôt qu'à `due` — permet de distinguer « Brief
   * a avancé en interne » de « Aramis a édité dans l'app Calendrier », y
   * compris pour les séries. Sans lui, la synchro ne peut QUE deviner, et le
   * 18/08 elle a dû choisir de ne plus jamais adopter l'horaire d'une série
   * pour éviter de la faire reculer — ce champ lève l'ambiguïté au lieu de
   * la contourner. Écrit uniquement par `src/lib/caldav.ts`.
   */
  caldavSyncedDue?: string | null;
  /**
   * DTSTART stable d'une série récurrente CRÉÉE PAR BRIEF (`rrule` posé),
   * figé au premier PUT réussi et jamais avancé — contrairement à `due`, que
   * le cron des rappels déplace à chaque envoi. `buildEventIcs` écrit CE
   * champ comme DTSTART pour une série, jamais `due` : en RFC 5545 aucune
   * occurrence n'existe avant DTSTART, donc réécrire le DTSTART à chaque
   * avance de `due` efface du calendrier l'occurrence du jour dès l'envoi de
   * son rappel — bug du 2026-08-19 (« Aller courir » en double, Reposter/
   * Poster disparus du jour sur le vrai calendrier alors que Brief les
   * montrait encore). `null`/absent pour un item non récurrent, ou une série
   * pas encore synchronisée. Écrit uniquement par `src/lib/caldav.ts`.
   */
  seriesAnchor?: string | null;
  /**
   * UID de l'événement Apple Calendar dont cet item a été ADOPTÉ — posé
   * directement dans l'app Calendrier, pas par Brief (décision Aramis du
   * 2026-08-19 : « adopte tout, on verra à l'usage » — aucun tri fiable
   * n'existe entre bruit et vraie tâche dans un même calendrier).
   *
   * Change tout le sens de la synchro pour CET item : Brief ne le PUT
   * jamais sous `brief-<id>` (`buildEventIcs` retourne `null`) — l'événement
   * garde son UID d'origine, que Brief suit et édite à sa place. Cocher
   * l'item dans Brief SUPPRIME l'événement original (pas de statut
   * « terminé » côté iCalendar) ; l'événement disparu du calendrier adopte
   * l'item comme terminé. Écrit uniquement par `src/lib/caldav.ts`.
   */
  externalUid?: string | null;
  /** Le calendrier iCloud où vit l'événement de `externalUid`. */
  externalCalendar?: string | null;
};

/** Résultat d'enregistrement, item par item. */
export type SaveResult = { ok: true; id: string } | { ok: false; id: string; error: string };

export type View = "capture" | "review" | "tasks" | "overview" | "settings";

/**
 * Une sous-tâche d'un item.
 */
export type SubTask = {
  id: string;
  title: string;
  done: boolean;
};

/**
 * Fil d'origine vocal d'un item — la note dictée d'où il provient.
 */
export type AudioOrigin = {
  /** Texte complet de la transcription. */
  text: string;
  /** Extrait surligné dans la transcription (la partie qui a donné cet item). */
  highlight: string;
  /** Segment temporel dans l'enregistrement (secondes). */
  startSec: number;
  endSec: number;
  /** Durée totale de l'enregistrement en secondes. */
  durationSec: number;
  /** Date de la dictée (ISO). */
  date: string;
  /** IDs des autres items issus de la même dictée. */
  siblingIds: string[];
};

/**
 * Statut d'un item.
 * - "active" : tâche/RDV normal
 * - "idea" : idée non rangée (boîte à idées)
 * - "archived" : archivée
 */
export type ItemStatus = "active" | "idea" | "archived";

/**
 * Une colonne du board Kanban — nom libre, position définie par l'utilisateur.
 * Comme Trello : l'utilisateur crée, nomme et réordonne ses colonnes.
 */
export type KanbanColumn = {
  id: string;
  name: string;
  /** Position dans le board (0 = gauche). */
  order: number;
};

/**
 * Le board Kanban complet — persisté dans `boards.json`.
 */
export type KanbanBoard = {
  columns: KanbanColumn[];
  updatedAt: string;
};

/**
 * Palette de couleurs des tags (style Trello).
 */
export const TAG_COLORS = [
  "yellow",
  "orange",
  "red",
  "purple",
  "blue",
  "green",
  "teal",
  "brown",
  "pink",
  "sky",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

/**
 * Un tag / étiquette — comme Trello. Couleur dans une palette fixe.
 */
export type Tag = {
  id: string;
  name: string;
  color: TagColor;
};

/**
 * Écran de l'app (design system Claude Design v1).
 */
export type Screen = "home" | "task" | "agenda" | "ideas" | "search";

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
