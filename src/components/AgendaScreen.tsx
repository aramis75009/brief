"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { EmptyState } from "./EmptyState";
import { SkeletonCard } from "./Skeleton";
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from "./icons";
import { fetchAgendaDay } from "@/lib/api";
import { UnauthorizedError } from "@/lib/pin";
import { TIMEZONE, zonedParts, shiftDays, type CalendarDate } from "@/lib/zoned";
import type { AgendaItem } from "@/lib/agenda";

/**
 * AgendaScreen — la vue « Rendez-vous ».
 *
 * Une SEULE source de données : `GET /api/agenda?date=…`, qui fusionne côté
 * serveur les items Brief actifs et l'instantané CalDAV (`src/lib/agenda.ts`
 * — même logique que la synchronisation, pas une copie locale). Ce composant
 * ne fait que choisir QUEL jour regarder et afficher ce que le serveur rend
 * pour ce jour-là — jamais de filtrage/troncature côté client qui pourrait
 * diverger de la source de vérité.
 *
 * `selectedDate` est la SEULE source d'état de navigation : la bande de 7
 * jours en haut est dérivée d'elle (le lundi de sa semaine), jamais l'inverse.
 * Cliquer un jour, ou utiliser les flèches, change `selectedDate` — rien
 * d'autre ne décide de ce qui s'affiche.
 */

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

/* Formateurs Intl — créés UNE FOIS au niveau du module, pas par ligne. */
const agendaTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIMEZONE,
});
const agendaDayFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TIMEZONE,
});
const agendaMonthFmt = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: TIMEZONE,
});

function dateKey(d: CalendarDate): string {
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

function sameDay(a: CalendarDate, b: CalendarDate): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

/** Lundi de la semaine calendaire contenant `d` (lundi = 0 … dimanche = 6). */
function mondayOf(d: CalendarDate): CalendarDate {
  const dow = (new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay() + 6) % 7;
  return shiftDays(d, -dow);
}

export function AgendaScreen({
  onBack,
  onOpenTask,
  onUnauthorized,
}: {
  onBack: () => void;
  onOpenTask: (id: string) => void;
  onUnauthorized: () => void;
}) {
  const todayParts = useMemo(() => zonedParts(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(todayParts);

  // Le résultat porte la date qu'il couvre : `loading`/`failed` se DÉDUISENT
  // en comparant cette date à `selectedDate`, plutôt que d'être réinitialisés
  // par un `setState` synchrone au début de l'effet (rendus en cascade).
  const [result, setResult] = useState<
    { date: string; status: "ready"; events: AgendaItem[] } | { date: string; status: "error" }
  >({ date: dateKey(todayParts), status: "ready", events: [] });

  const weekStart = useMemo(() => mondayOf(selectedDate), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftDays(weekStart, i)),
    [weekStart],
  );

  useEffect(() => {
    let alive = true;
    const key = dateKey(selectedDate);
    fetchAgendaDay(key)
      .then((data) => {
        if (alive) setResult({ date: key, status: "ready", events: data });
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }
        setResult({ date: key, status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [selectedDate, onUnauthorized]);

  const selectedKey = dateKey(selectedDate);
  const loading = result.date !== selectedKey;
  const failed = !loading && result.status === "error";
  const events = !loading && result.status === "ready" ? result.events : [];

  const allDayEvents = events.filter((e) => e.allDay);
  const timedEvents = events.filter((e) => !e.allDay);
  const morning = timedEvents.filter((e) => zonedParts(new Date(e.due)).hour < 12);
  const afternoon = timedEvents.filter((e) => zonedParts(new Date(e.due)).hour >= 12);

  const dayLabel = agendaDayFmt.format(new Date(Date.UTC(selectedDate.y, selectedDate.m - 1, selectedDate.d, 12)));

  const monthLabel = agendaMonthFmt.format(new Date(Date.UTC(selectedDate.y, selectedDate.m - 1, selectedDate.d, 12)));

  const isToday = sameDay(selectedDate, todayParts);
  const empty = !loading && !failed && events.length === 0;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-y-auto px-5 pb-2" style={{ animation: "fade .25s both" }}>
      {/* Header */}
      <div className="mb-4.5 flex items-center justify-between">
        <button
          aria-label="Retour"
          onClick={onBack}
          className="flex size-11 items-center justify-center rounded-full border border-ink/[.08] bg-surface"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <span className="flex flex-col items-center gap-0.5">
          <span className="text-[15px] font-bold capitalize">{monthLabel}</span>
          <span className="flex items-center gap-[5px] text-[10.5px] font-bold text-meet-700">
            <span className="size-[5px] rounded-full bg-meet-700" />
            Calendrier Apple
          </span>
        </span>
        <button
          aria-label="Jour suivant"
          onClick={() => setSelectedDate((d) => shiftDays(d, 1))}
          className="flex size-11 items-center justify-center rounded-full border border-ink/[.08] bg-surface"
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>

      {/* Week grid — dérivée de selectedDate, jamais l'inverse */}
      <div className="mb-3 flex items-center justify-between">
        <button
          aria-label="Jour précédent"
          onClick={() => setSelectedDate((d) => shiftDays(d, -1))}
          className="flex size-8 flex-none items-center justify-center text-ink-faint"
        >
          <ChevronLeftIcon size={14} />
        </button>
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {weekDays.map((d, i) => {
            const isSelected = sameDay(d, selectedDate);
            const isTodayPill = sameDay(d, todayParts);
            const isWeekend = i >= 5;
            return (
              <button
                key={dateKey(d)}
                onClick={() => setSelectedDate(d)}
                aria-label={`${WEEKDAYS[i]} ${d.d}`}
                aria-current={isSelected ? "date" : undefined}
                className="flex flex-col items-center gap-[7px]"
              >
                <span className={`text-[11px] font-bold ${isWeekend ? "text-ink-faint" : "text-ink"}`}>
                  {WEEKDAYS[i]}
                </span>
                <span
                  className="flex h-[44px] w-[38px] items-center justify-center rounded-[16px] text-[14px] font-bold"
                  style={{
                    background: isSelected ? "#101010" : "#fff",
                    color: isSelected ? "#fff" : isWeekend ? "#C4C4BD" : "#101010",
                    border: isSelected
                      ? "none"
                      : isTodayPill
                        ? "1.5px solid #101010"
                        : "1px solid rgba(16,16,16,.06)",
                  }}
                >
                  {d.d}
                </span>
              </button>
            );
          })}
        </div>
        <button
          aria-label="Jour suivant"
          onClick={() => setSelectedDate((d) => shiftDays(d, 1))}
          className="flex size-8 flex-none items-center justify-center text-ink-faint"
        >
          <ChevronRightIcon size={14} />
        </button>
      </div>

      {/* Jour sélectionné */}
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[15px] font-bold capitalize text-ink">{dayLabel}</span>
        {isToday && (
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">Aujourd&apos;hui</span>
        )}
      </div>

      {/* Contenu du jour */}
      {loading ? (
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : failed ? (
        <EmptyState
          icon={<CalendarIcon size={20} className="text-ink-faint" />}
          title="Rendez-vous indisponibles"
          description="La synchro avec le calendrier n'a pas répondu. Réessaie."
        />
      ) : empty ? (
        <EmptyState
          icon={<CalendarIcon size={20} className="text-ink-faint" />}
          title="Aucun rendez-vous"
          description="Ce jour est entièrement libre."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {allDayEvents.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="mb-1.5 font-mono text-[10px] tracking-[0.1em] text-ink-faint">TOUTE LA JOURNÉE</span>
              {allDayEvents.map((e) => (
                <EventRow key={e.id} item={e} onOpen={onOpenTask} />
              ))}
            </div>
          )}
          {morning.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="mb-1.5 font-mono text-[10px] tracking-[0.1em] text-ink-faint">MATIN</span>
              {morning.map((e) => (
                <EventRow key={e.id} item={e} onOpen={onOpenTask} />
              ))}
            </div>
          )}
          {afternoon.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="mb-1.5 font-mono text-[10px] tracking-[0.1em] text-ink-faint">APRÈS-MIDI</span>
              {afternoon.map((e) => (
                <EventRow key={e.id} item={e} onOpen={onOpenTask} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const EventRow = memo(function EventRow({ item, onOpen }: { item: AgendaItem; onOpen: (id: string) => void }) {
  const time = item.allDay
    ? "Toute la journée"
    : agendaTimeFmt.format(new Date(item.due));
  const borderColor = item.kind === "task" ? "var(--color-task-700)" : "var(--color-meet-700)";
  const subtitle =
    item.kind === "task"
      ? `Tâche${item.subtasksCount ? ` · ${item.subtasksCount} sous-tâches` : ""}`
      : item.kind === "event"
        ? "RDV"
        : "Calendrier Apple";
  const clickable = item.briefItemId !== null;

  const Tag = clickable ? "button" : "div";

  return (
    <div className="mb-1 flex gap-3">
      <div className="w-[46px] flex-none pt-3.5 text-[13px] font-bold text-ink-faint">{item.allDay ? "" : time}</div>
      <Tag
        onClick={clickable ? () => onOpen(item.briefItemId!) : undefined}
        className="flex-1 rounded-20 border border-ink/[.06] bg-surface px-4 py-3.5 text-left"
        style={{ borderLeft: `4px solid ${borderColor}`, cursor: clickable ? "pointer" : "default" }}
      >
        <div className="text-[15px] font-bold tracking-[-0.01em]">{item.title}</div>
        <div className="mt-[3px] text-[12px] font-semibold text-ink-faint">
          {item.allDay && `${time} · `}
          {subtitle}
          {item.durationMinutes ? ` · ${item.durationMinutes} min` : ""}
        </div>
      </Tag>
    </div>
  );
});
