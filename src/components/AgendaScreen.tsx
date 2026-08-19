"use client";

import { EmptyState } from "./EmptyState";
import { SkeletonCard } from "./Skeleton";
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from "./icons";
import { TIMEZONE, zonedParts } from "@/lib/zoned";
import type { Item, Project } from "@/lib/types";

/**
 * AgendaScreen — vue semaine calendaire.
 * Badge "Calendrier Apple", events groupés Matin/Après-midi.
 */

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function AgendaScreen({
  items,
  projects,
  onBack,
  loading,
  weekOffset = 0,
}: {
  items: Item[];
  projects: Project[];
  onBack: () => void;
  loading: boolean;
  weekOffset?: number;
}) {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // Filter items with due dates for this week
  const weekItems = items.filter((item) => {
    if (!item.due || item.status === "idea") return false;
    const d = new Date(item.due);
    return d >= weekStart && d < new Date(weekStart.getTime() + 7 * 86400000);
  });

  // Split by morning/afternoon (in Europe/Paris timezone)
  const morning = weekItems.filter((item) => {
    const parts = zonedParts(new Date(item.due!));
    return parts.hour < 12;
  });
  const afternoon = weekItems.filter((item) => {
    const parts = zonedParts(new Date(item.due!));
    return parts.hour >= 12;
  });

  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(weekStart);
  const currentDay = today.getDate();

  return (
    <div className="flex-1 min-h-0 overflow-auto px-5 pb-2" style={{ animation: "fade .25s both" }}>
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
          aria-label="Semaine suivante"
          className="flex size-11 items-center justify-center rounded-full border border-ink/[.08] bg-surface"
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>

      {/* Week grid */}
      <div className="mb-5.5 grid grid-cols-7 gap-1.5">
        {weekDays.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString();
          const isWeekend = i >= 5;
          return (
            <div key={i} className="flex flex-col items-center gap-[7px]">
              <span className={`text-[11px] font-bold ${isWeekend ? "text-ink-faint" : "text-ink"}`}>
                {WEEKDAYS[i]}
              </span>
              <span
                className="flex h-[44px] w-[38px] items-center justify-center rounded-[16px] text-[14px] font-bold"
                style={{
                  background: isToday ? "#101010" : "#fff",
                  color: isToday ? "#fff" : isWeekend ? "#C4C4BD" : "#101010",
                  border: isToday ? "none" : "1px solid rgba(16,16,16,.06)",
                }}
              >
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Events */}
      {loading ? (
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : weekItems.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon size={20} className="text-ink-faint" />}
          title="Aucun rendez-vous"
          description="Cette semaine est entièrement libre."
        />
      ) : (
        <div className="flex flex-col gap-1">
          {morning.length > 0 && (
            <>
              <span className="mb-1.5 font-mono text-[10px] tracking-[0.1em] text-ink-faint">MATIN</span>
              {morning.map((item) => (
                <EventRow key={item.id} item={item} />
              ))}
            </>
          )}
          {afternoon.length > 0 && (
            <>
              <span className="my-4 font-mono text-[10px] tracking-[0.1em] text-ink-faint">APRÈS-MIDI</span>
              {afternoon.map((item) => (
                <EventRow key={item.id} item={item} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EventRow({ item }: { item: Item }) {
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  }).format(new Date(item.due!));
  const isTask = item.kind === "task";
  const borderColor = isTask ? "var(--color-task-700)" : "var(--color-meet-700)";

  return (
    <div className="mb-1 flex gap-3">
      <div className="w-[46px] flex-none pt-3.5 text-[13px] font-bold text-ink-faint">{time}</div>
      <div
        className="flex-1 rounded-20 border border-ink/[.06] bg-surface px-4 py-3.5"
        style={{ borderLeft: `4px solid ${borderColor}` }}
      >
        <div className="text-[15px] font-bold tracking-[-0.01em]">{item.title}</div>
        <div className="mt-[3px] text-[12.5px] font-semibold text-ink-faint">
          {isTask ? `Tâche${item.subtasks ? ` · ${item.subtasks.length} sous-tâches` : ""}` : "RDV"}
          {item.durationMinutes ? ` · ${item.durationMinutes} min` : ""}
        </div>
      </div>
    </div>
  );
}