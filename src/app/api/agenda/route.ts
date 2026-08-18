import { requirePin } from "@/lib/guard";
import { readItems } from "@/lib/store";
import { zonedParts, zonedTime, shiftDays } from "@/lib/zoned";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agenda — events et tâches datés pour une semaine donnée.
 *
 * GET /api/agenda?week=2026-08-19
 *
 * Retourne les items groupés par jour et par matin/après-midi.
 * Les items sans échéance ou avec le statut "idea" sont exclus.
 */

interface AgendaEntry {
  id: string;
  title: string;
  kind: string;
  due: string;
  allDay: boolean;
  durationMinutes?: number;
  subtasks?: { id: string; title: string; done: boolean }[];
  projectId: string;
}

interface DayGroup {
  date: string;
  label: string;
  morning: AgendaEntry[];
  afternoon: AgendaEntry[];
}

export async function GET(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const weekParam = url.searchParams.get("week");

  // Determine week start (Monday)
  let weekStart: Date;
  if (weekParam) {
    const d = new Date(weekParam);
    if (Number.isNaN(d.getTime())) {
      return Response.json({ error: "Date invalide." }, { status: 400 });
    }
    const parts = zonedParts(d);
    const dow = (new Date(d).getDay() + 6) % 7; // 0 = Monday
    weekStart = zonedTime(parts.y, parts.m, parts.d - dow, 0, 0);
  } else {
    const now = new Date();
    const parts = zonedParts(now);
    const dow = (now.getDay() + 6) % 7;
    weekStart = zonedTime(parts.y, parts.m, parts.d - dow, 0, 0);
  }

  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  const items = await readItems();
  const dated = items.filter((item) => {
    if (!item.due || item.status === "idea" || item.status === "archived") return false;
    const d = new Date(item.due);
    return d >= weekStart && d < weekEnd;
  });

  // Group by day
  const days: DayGroup[] = [];
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(weekStart.getTime() + i * 86400000);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const dayItems = dated.filter((item) => {
      const d = new Date(item.due!);
      return d >= dayStart && d < dayEnd;
    });

    const morning = dayItems
      .filter((item) => new Date(item.due!).getHours() < 12)
      .map(toEntry);
    const afternoon = dayItems
      .filter((item) => new Date(item.due!).getHours() >= 12)
      .map(toEntry);

    days.push({
      date: dayStart.toISOString().slice(0, 10),
      label: dayStart.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" }),
      morning,
      afternoon,
    });
  }

  return Response.json({ week: weekStart.toISOString().slice(0, 10), days });
}

function toEntry(item: import("@/lib/types").Item): AgendaEntry {
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    due: item.due!,
    allDay: item.allDay,
    durationMinutes: item.durationMinutes,
    subtasks: item.subtasks,
    projectId: item.projectId,
  };
}