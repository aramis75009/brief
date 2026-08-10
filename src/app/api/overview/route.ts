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

/** « auj. » pour aujourd'hui, sinon « jeu », « ven »… — sans le point d'abréviation. */
function weekdayLabel(d: Date, isToday: boolean): string {
  if (isToday) return "auj.";
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short" })
    .format(d)
    .replace(/\.$/, "");
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
      shape: p.shape,
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

  /* --- Horizon 7 jours ------------------------------------------------------
   * La seconde vue de l'onglet Vision. Elle sort du MÊME appel que la première :
   * deux représentations d'une seule lecture disque, donc jamais deux chiffres
   * qui se contredisent à l'écran parce qu'une des deux réponses a vieilli.
   *
   * Le retard forme une colonne à part, avant le trait : il n'appartient à aucun
   * jour, il pèse sur tous. L'agréger dans « aujourd'hui » ferait disparaître la
   * seule information qui demande une décision.
   * ------------------------------------------------------------------------ */
  const stacksOf = (list: typeof open) => {
    const counts = new Map<string, number>();
    for (const i of list) counts.set(i.projectId, (counts.get(i.projectId) ?? 0) + 1);
    return [...counts.entries()]
      .map(([projectId, count]) => {
        const p = projects.find((x) => x.id === projectId);
        return { projectId, name: p?.name ?? projectId, tint: p?.tint, shape: p?.shape, count };
      })
      .sort((a, b) => b.count - a.count);
  };

  const horizon = [];
  for (let offset = 0; offset < 7; offset++) {
    const from = new Date(today);
    from.setDate(from.getDate() + offset);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    const dayItems = open.filter((i) => {
      if (!i.due) return false;
      const d = new Date(i.due);
      return !Number.isNaN(d.getTime()) && d >= from && d < to;
    });

    horizon.push({
      date: from.toISOString(),
      label: weekdayLabel(from, offset === 0),
      isToday: offset === 0,
      total: dayItems.length,
      events: dayItems.filter((i) => i.kind === "event").length,
      stacks: stacksOf(dayItems),
    });
  }

  const overdueItems = open.filter((i) => bucketOf(i.due) === "overdue");

  // Le jour le plus chargé des sept — « ton mur ». À égalité, le plus proche
  // gagne : c'est celui sur lequel on peut encore agir.
  const peakDay = horizon.reduce((best, d) => (d.total > best.total ? d : best), horizon[0]);
  const peak =
    peakDay && peakDay.total > 0
      ? {
          date: peakDay.date,
          label: peakDay.label,
          total: peakDay.total,
          events: peakDay.events,
          projects: peakDay.stacks.length,
          items: open
            .filter((i) => {
              if (!i.due) return false;
              const d = new Date(i.due);
              return !Number.isNaN(d.getTime()) && startOfDay(d).getTime() === startOfDay(new Date(peakDay.date)).getTime();
            })
            .map((i) => ({
              id: i.id,
              title: i.title,
              projectId: i.projectId,
              kind: i.kind,
              due: i.due,
              allDay: i.allDay,
              priority: i.priority,
            })),
        }
      : null;

  return Response.json({
    generatedAt: now.toISOString(),
    horizon,
    overdueStacks: stacksOf(overdueItems),
    peak,
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
