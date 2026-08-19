import { makeBucketOf } from "./buckets";
import type { Item, ItemKind, Priority, Project } from "./types";

/**
 * Le récap du matin — ce que `GET /api/digest` renvoie.
 *
 * Il sert un appelant machine (n8n, un raccourci, un futur agent) qui met en
 * forme et envoie sur un canal que Brief n'a pas : WhatsApp, Telegram, un mail.
 *
 * **Le tri et le découpage se font ICI, pas chez l'appelant.** Un nœud Code n8n
 * s'exécute dans le fuseau de son conteneur, réglé par `GENERIC_TIMEZONE` —
 * `Europe/Berlin` sur le VPS au 2026-08-14, donc le bon décalage par accident,
 * jusqu'au jour où quelqu'un touche à cette variable en configurant un tout
 * autre workflow. Ce réglage vit hors du dépôt et hors de portée de
 * `npx vitest run` : une régression n'y produirait aucun test rouge.
 *
 * Le serveur possède l'horloge — c'est déjà la règle des rappels — et
 * l'appelant ne fait que de la mise en forme.
 */

export type DigestEntry = {
  id: string;
  title: string;
  /** Nom lisible du projet : l'appelant n'a pas à connaître les `projectId`. */
  project: string;
  projectId: string;
  kind: ItemKind;
  due: string | null;
  allDay: boolean;
  priority: Priority;
};

export type Digest = {
  generatedAt: string;
  counts: { overdue: number; today: number };
  overdue: DigestEntry[];
  today: DigestEntry[];
};

/** Le plus urgent d'abord : priorité 1 en tête (iCalendar), puis l'échéance la plus ancienne. */
function byUrgency(a: DigestEntry, b: DigestEntry): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  const da = a.due ? new Date(a.due).getTime() : Number.POSITIVE_INFINITY;
  const db = b.due ? new Date(b.due).getTime() : Number.POSITIVE_INFINITY;
  return da - db;
}

/**
 * Ce qui pèse sur la journée : le retard, puis les échéances du jour.
 *
 * Rien d'autre. Les tâches sans échéance et celles de demain sont écartées —
 * un récap qui déverse l'Inbox entière chaque matin finit ignoré, et un récap
 * ignoré ne vaut pas mieux qu'une notification absente.
 */
export function buildDigest(items: Item[], projects: Project[], now: Date): Digest {
  const bucketOf = makeBucketOf(now);
  const names = new Map(projects.map((p) => [p.id, p.name]));

  const entry = (i: Item): DigestEntry => ({
    id: i.id,
    title: i.title,
    // Un item peut porter le `projectId` d'un projet supprimé depuis : on le
    // nomme plutôt que de le taire, sinon il disparaît du récap sans raison.
    // « Autre » et pas « Sans projet » : c'est le mot qu'affiche déjà l'écran
    // Tâches (`TasksScreen.tsx`) pour les orphelins.
    project: names.get(i.projectId) ?? "Autre",
    projectId: i.projectId,
    kind: i.kind,
    due: i.due,
    allDay: i.allDay,
    priority: i.priority,
  });

  const open = items.filter((i) => !i.doneAt);
  const pick = (want: "overdue" | "today") =>
    open
      .filter((i) => bucketOf(i.due) === want)
      .map(entry)
      .sort(byUrgency);

  const overdue = pick("overdue");
  const today = pick("today");

  return {
    generatedAt: now.toISOString(),
    counts: { overdue: overdue.length, today: today.length },
    overdue,
    today,
  };
}
