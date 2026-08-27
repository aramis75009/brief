import { buildDayAgenda } from "@/lib/agenda";
import { readAgendaSnapshot } from "@/lib/caldav";
import { requireSession } from "@/lib/guard";
import { readItems } from "@/lib/store";
import { shiftDays, zonedParts, zonedTime, type CalendarDate } from "@/lib/zoned";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rendez-vous d'UN jour — fusion items Brief + instantané CalDAV.
 *
 * GET /api/agenda?date=2026-08-20   (par défaut : aujourd'hui, Europe/Paris)
 *
 * Toute la logique de fusion (items actifs + événements posés directement
 * dans l'app Calendrier + extension des séries récurrentes) vit dans
 * `buildDayAgenda` (`src/lib/agenda.ts`), testée indépendamment — cette route
 * ne fait que calculer les bornes du jour demandé et appeler cette fonction.
 */

function parseDateParam(raw: string | null): CalendarDate | null {
  if (!raw) return zonedParts(new Date());
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

export async function GET(req: Request): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;

  const url = new URL(req.url);
  const parts = parseDateParam(url.searchParams.get("date"));
  if (!parts) {
    return Response.json({ error: "Date invalide (attendu AAAA-MM-JJ)." }, { status: 400 });
  }

  const dayStart = zonedTime(parts.y, parts.m, parts.d, 0, 0);
  const next = shiftDays(parts, 1);
  const dayEnd = zonedTime(next.y, next.m, next.d, 0, 0);

  const [items, snapshot] = await Promise.all([readItems(), readAgendaSnapshot()]);
  const events = buildDayAgenda(items, snapshot?.events ?? [], dayStart, dayEnd);

  const pad = (n: number) => String(n).padStart(2, "0");
  return Response.json({
    date: `${parts.y}-${pad(parts.m)}-${pad(parts.d)}`,
    generatedAt: snapshot?.generatedAt ?? null,
    events,
  });
}
