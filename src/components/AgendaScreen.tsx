"use client";

import { useState, useMemo } from "react";
import { EmptyState } from "./EmptyState";
import { SkeletonCard } from "./Skeleton";
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from "./icons";
import { TIMEZONE, zonedParts, zonedTime, shiftDays } from "@/lib/zoned";
import type { Item, Project } from "@/lib/types";

/**
 * AgendaScreen — vue semaine calendaire.
 * Badge "Calendrier Apple", events groupés par jour puis Matin/Après-midi.
 */

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function AgendaScreen({
  items,
  projects,
  onBack,
  loading,
}: {
  items: Item[];
  projects: Project[];
  onBack: () => void;
  loading: boolean;
}) {
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  const todayParts = zonedParts(today);

  // Lundi de la semaine courante dans le fuseau Paris (comme Date)
  const weekStart = useMemo(() => {
    const dow = (new Date(todayParts.y, todayParts.m - 1, todayParts.d).getDay() + 6) % 7;
    const shifted = shiftDays(todayParts, -dow + weekOffset * 7);
    return zonedTime(shifted.y, shifted.m, shifted.d, 0, 0);
  }, [todayParts, weekOffset]);

  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const parts = shiftDays(zonedParts(weekStart), i);
      return zonedTime(parts.y, parts.m, parts.d, 12, 0); // midi pour éviter les décalages DST
    });
  }, [weekStart]);

  // Items de la semaine avec due date
  const weekItems = useMemo(() => {
    return items.filter((item) => {
      if (!item.due || item.status === "idea" || item.status === "archived") return false;
      const d = new Date(item.due);
      return d >= weekStart && d < weekEnd;
    });
  }, [items, weekStart, weekEnd]);

  // Grouper par jour, puis matin/après-midi
  const dayGroups = useMemo(() => {
    return weekDays.map((dayStart, i) => {
      const dayParts = zonedParts(dayStart);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayItems = weekItems.filter((item) => {
        const d = new Date(item.due!);
        return d >= dayStart && d < dayEnd;
      });
      const morning = dayItems.filter((item) => zonedParts(new Date(item.due!)).hour < 12);
      const afternoon = dayItems.filter((item) => zonedParts(new Date(item.due!)).hour >= 12);
      return {
        dayStart,
        label: new Intl.DateTimeFormat("fr-FR", {
          weekday: "long",
          day: "numeric",
          timeZone: TIMEZONE,
        }).format(dayStart),
        isToday: dayParts.y === todayParts.y && dayParts.m === todayParts.m && dayParts.d === todayParts.d,
        morning,
        afternoon,
      };
    });
  }, [weekDays, weekItems, todayParts]);

  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(weekStart);

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
          aria-label="Semaine suivante"
          onClick={() => setWeekOffset((w) => w + 1)}
          className="flex size-11 items-center justify-center rounded-full border border-ink/[.08] bg-surface"
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>

      {/* Week grid */}
      <div className="mb-5.5 grid grid-cols-7 gap-1.5">
        {weekDays.map((d, i) => {
          const dParts = zonedParts(d);
          const isToday = dParts.y === todayParts.y && dParts.m === todayParts.m && dParts.d === todayParts.d;
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
                {dParts.d}
              </span>
            </div>
          );
        })}
      </div>

      {/* Events par jour */}
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
        <div className="flex flex-col gap-4">
          {dayGroups.map((group, i) => {
            if (group.morning.length === 0 && group.afternoon.length === 0) return null;
            return (
              <div key={i} className="flex flex-col gap-1">
                {/* Label du jour */}
                <div className="mb-1 flex items-baseline justify-between">
                  <span className={`text-[13px] font-bold capitalize ${group.isToday ? "text-ink" : "text-ink-faint"}`}>
                    {group.label}
                  </span>
                  {group.isToday && (
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">Aujourd&apos;hui</span>
                  )}
                </div>

                {/* Matin */}
                {group.morning.length > 0 && (
                  <>
                    <span className="mb-1.5 font-mono text-[10px] tracking-[0.1em] text-ink-faint">MATIN</span>
                    {group.morning.map((item) => (
                      <EventRow key={item.id} item={item} />
                    ))}
                  </>
                )}

                {/* Après-midi */}
                {group.afternoon.length > 0 && (
                  <>
                    <span className={`font-mono text-[10px] tracking-[0.1em] text-ink-faint ${group.morning.length > 0 ? "mt-2" : ""}`}>APRÈS-MIDI</span>
                    {group.afternoon.map((item) => (
                      <EventRow key={item.id} item={item} />
                    ))}
                  </>
                )}
              </div>
            );
          })}
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
        <div className="mt-[3px] text-[12px] font-semibold text-ink-faint">
          {isTask ? `Tâche${item.subtasks ? ` · ${item.subtasks.length} sous-tâches` : ""}` : "RDV"}
          {item.durationMinutes ? ` · ${item.durationMinutes} min` : ""}
        </div>
      </div>
    </div>
  );
}