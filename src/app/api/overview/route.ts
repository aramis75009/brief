import { requirePin } from "@/lib/guard";
import { readItems, readProjects } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vision globale — la charge par projet.
 *
 * C'est la seule chose que Brief fait et que ni l'app Rappels ni un gestionnaire
 * de tâches classique ne donnent : le poids RELATIF des projets. Pas une liste
 * de plus, une réponse à « qu'est-ce qui déborde ».
 *
 * Calculé à la volée et non mis en cache. À un utilisateur et quelques milliers
 * d'items, l'agrégation coûte moins qu'un aller-retour disque supplémentaire —
 * et un cache introduirait une deuxième copie des données qui peut mentir sans
 * le dire, ce qui est exactement la défaillance qu'on cherche à éviter ici.
 */

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export async function GET(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  const [items, projects] = await Promise.all([readItems(), readProjects()]);
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const inSevenDays = new Date(today);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  const open = items.filter((i) => !i.doneAt);

  const bucketOf = (due: string | null): "overdue" | "today" | "week" | "later" | "none" => {
    if (!due) return "none";
    const d = new Date(due);
    if (Number.isNaN(d.getTime())) return "none";
    if (d < today) return "overdue";
    if (d < tomorrow) return "today";
    if (d < inSevenDays) return "week";
    return "later";
  };

  const byProject = projects.map((p) => {
    const mine = open.filter((i) => i.projectId === p.id);
    return {
      id: p.id,
      name: p.name,
      tint: p.tint,
      total: mine.length,
      overdue: mine.filter((i) => bucketOf(i.due) === "overdue").length,
      today: mine.filter((i) => bucketOf(i.due) === "today").length,
      week: mine.filter((i) => bucketOf(i.due) === "week").length,
      events: mine.filter((i) => i.kind === "event").length,
    };
  });

  // Sept derniers jours d'activité, pour la barre du haut. L'index 6 est
  // aujourd'hui : c'est la barre mise en avant.
  const activity: number[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const from = new Date(today);
    from.setDate(from.getDate() - offset);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    activity.push(
      items.filter((i) => {
        const created = new Date(i.createdAt);
        return created >= from && created < to;
      }).length,
    );
  }

  return Response.json({
    generatedAt: now.toISOString(),
    totals: {
      open: open.length,
      overdue: open.filter((i) => bucketOf(i.due) === "overdue").length,
      today: open.filter((i) => bucketOf(i.due) === "today").length,
      week: open.filter((i) => bucketOf(i.due) === "week").length,
      doneToday: items.filter((i) => i.doneAt && new Date(i.doneAt) >= today).length,
      createdToday: activity[6],
    },
    byProject: byProject.filter((p) => p.total > 0),
    activity,
  });
}
