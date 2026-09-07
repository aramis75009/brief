"use client";

/**
 * Le calendrier de semaine — des BANDES qui suivent la plage de dates.
 *
 * Différence avec `DesktopCalendar` (le mois, conservé) : ici une tâche
 * occupe autant de colonnes que sa plage en couvre. C'est la vue qui rend
 * `startDate` visible, et la seule où deux tâches qui se chevauchent se
 * voient comme telles.
 */

import { useMemo } from "react";
import { skinFor } from "@/lib/projects";
import { statusOf } from "@/lib/status";
import { timelineRows, weekGrid } from "@/lib/views";
import { shiftDays, zonedParts } from "@/lib/zoned";
import { EmptyView } from "../ui";
import { C, R } from "../tokens";
import type { Item, Project } from "@/lib/types";

export function WeekCalendarView({
  items,
  projects,
  now,
  weekOffset,
  onOpenTask,
}: {
  items: Item[];
  projects: Project[];
  now: Date;
  /** 0 = cette semaine, -1 = la précédente, +1 = la suivante. */
  weekOffset: number;
  onOpenTask: (id: string) => void;
}) {
  // Le décalage se fait en JOURS calendaires (7 par semaine), pas en
  // millisecondes : `+ 7 * 86_400_000` saute ou répète une heure aux
  // changements d'heure et fait glisser la semaine d'un jour.
  const anchor = useMemo(() => {
    if (weekOffset === 0) return now;
    const p = zonedParts(now);
    const moved = shiftDays({ y: p.y, m: p.m, d: p.d }, weekOffset * 7);
    return new Date(Date.UTC(moved.y, moved.m - 1, moved.d, 12, 0));
  }, [now, weekOffset]);

  const days = useMemo(() => weekGrid(anchor), [anchor]);
  const rows = useMemo(() => timelineRows(items, days, now), [items, days, now]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.hairline2}`, borderRadius: R.card, overflow: "hidden" }}>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))", borderBottom: `1px solid ${C.hairline2}`, background: C.bg }}
      >
        {days.map((d) => (
          <div
            key={d.key}
            className="flex flex-col items-center gap-0.5"
            style={{ padding: "11px 0", background: d.weekend ? "var(--color-bg)" : "transparent" }}
          >
            <span className="font-bold" style={{ fontSize: 10, letterSpacing: "0.08em", color: C.inkFaint }}>
              {d.dow}
            </span>
            <span
              className="text-[15px] font-extrabold"
              style={
                d.isToday
                  ? {
                      width: 26,
                      height: 26,
                      borderRadius: 99,
                      background: C.ink,
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }
                  : undefined
              }
            >
              {d.num}
            </span>
          </div>
        ))}
      </div>

      <div className="relative" style={{ padding: "14px 0 18px", minHeight: 220 }}>
        <div
          className="pointer-events-none absolute inset-0 grid"
          style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))" }}
          aria-hidden="true"
        >
          {days.map((d) => (
            <div
              key={d.key}
              style={{ borderRight: `1px solid ${C.hairline}`, background: d.weekend ? "var(--color-bg)" : "transparent" }}
            />
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="relative">
            <EmptyView title="Aucune tâche datée cette semaine" />
          </div>
        ) : (
          <div className="relative flex flex-col gap-2">
            {rows.map((row) => {
              const project = projectById.get(row.item.projectId);
              const skin = skinFor(project ?? { id: row.item.projectId });
              const status = statusOf(row.item, now, byId);
              return (
                <div
                  key={row.item.id}
                  className="grid"
                  style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))", padding: "0 8px" }}
                >
                  <button
                    type="button"
                    onClick={() => onOpenTask(row.item.id)}
                    className="flex items-center gap-2 text-left font-bold"
                    style={{
                      gridColumn: `${row.startIndex + 1} / ${row.startIndex + row.span + 1}`,
                      height: 32,
                      padding: "0 12px",
                      borderRadius: 9,
                      border: "none",
                      background: skin.bg,
                      color: "#FFFFFF",
                      fontFamily: "inherit",
                      fontSize: 12.5,
                      cursor: "pointer",
                      opacity: row.item.doneAt ? 0.42 : 1,
                    }}
                  >
                    <span
                      className="flex-none"
                      style={{ width: 7, height: 7, borderRadius: 99, background: "#FFFFFF", opacity: 0.85 }}
                    />
                    <span className="truncate">{row.item.title}</span>
                    {row.item.externalUid && (
                      <span
                        className="ml-auto flex-none font-mono"
                        title="Événement adopté depuis Apple Calendar"
                        style={{ fontSize: 9, letterSpacing: "0.06em", opacity: 0.7 }}
                      >
                        CALDAV
                      </span>
                    )}
                    {!row.item.externalUid && status === "late" && (
                      <span className="ml-auto flex-none font-mono" style={{ fontSize: 9, opacity: 0.8 }}>
                        RETARD
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-[12px]" style={{ padding: "12px 18px", borderTop: `1px solid ${C.hairline}`, color: C.inkMuted }}>
        Les bandes suivent la plage de dates. Le calendrier Apple reste la source de vérité : une occurrence déplacée
        là-bas s&apos;affiche ici à son heure réelle.
      </div>
    </div>
  );
}
