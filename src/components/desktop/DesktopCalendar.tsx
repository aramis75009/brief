"use client";

/**
 * Écran Calendrier desktop — grille semaine (56px/heure, 7h→21h, DESIGN.md
 * §7) ou mois, plus le panneau de détail. Une SEULE source pour les
 * occurrences affichées : `GET /api/agenda?date=…` (`fetchAgendaDay`), jour
 * par jour, en parallèle — la même fusion items+CalDAV que l'onglet
 * Rendez-vous mobile et l'accueil. Aucune expansion RRULE ni résolution
 * d'override recalculée ici : ce serait une seconde définition d'« occurrence
 * du jour » qui peut diverger de la première (voir `src/lib/agenda.ts`).
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";
import { skinFor, shapeFor } from "@/lib/projects";
import { PRIORITIES } from "@/lib/projects";
import { fetchAgendaDay } from "@/lib/api";
import { UnauthorizedError } from "@/lib/pin";
import { TIMEZONE, zonedParts, shiftDays, shiftMonths, weekdayOf, lastDayOfMonth, type CalendarDate } from "@/lib/zoned";
import type { AgendaItem } from "@/lib/agenda";
import type { Item, Project } from "@/lib/types";

const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  danger: "var(--color-danger)",
} as const;

const HOUR_START = 7;
const HOUR_END = 21;
const HOUR_PX = 56;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

const dowShortFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: TIMEZONE });
const dowLabels = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const monthTitleFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: TIMEZONE });
const dayTitleFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: TIMEZONE });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE });
const metaDayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TIMEZONE });

function dateKey(d: CalendarDate): string {
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}
function sameDate(a: CalendarDate, b: CalendarDate): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}
function mondayOf(d: CalendarDate): CalendarDate {
  return shiftDays(d, -((weekdayOf(d) + 6) % 7));
}
function atNoonUtc(d: CalendarDate): Date {
  return new Date(Date.UTC(d.y, d.m - 1, d.d, 12));
}

function dot(project: Project | undefined) {
  if (!project) return { bg: C.inkFaint, radius: 99 };
  const skin = skinFor(project);
  return { bg: skin.bg, radius: shapeFor(project) === "square" ? 2 : 99 };
}

export function DesktopCalendar({
  items,
  projects,
  selectedId,
  onSelect,
  onToggleDone,
  onPostpone,
}: {
  items: Item[];
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onToggleDone: (id: string, completedAt?: string | null) => void;
  onPostpone: (id: string) => void;
}) {
  const today = useMemo(() => zonedParts(new Date()), []);
  const [view, setView] = useState<"semaine" | "mois">("semaine");
  const [anchor, setAnchor] = useState<CalendarDate>(today);
  const [cache, setCache] = useState<Record<string, AgendaItem[]>>({});

  const weekStart = useMemo(() => mondayOf(anchor), [anchor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDays(weekStart, i)), [weekStart]);

  const monthAnchor = useMemo(() => ({ y: anchor.y, m: anchor.m, d: 1 }), [anchor.y, anchor.m]);
  const monthGridStart = useMemo(() => mondayOf(monthAnchor), [monthAnchor]);
  const monthCellCount = useMemo(() => {
    const lastDay = lastDayOfMonth(monthAnchor);
    const monthEnd = { ...monthAnchor, d: lastDay };
    const days = Math.round((atNoonUtc(shiftDays(monthEnd, 1)).getTime() - atNoonUtc(monthGridStart).getTime()) / 86_400_000);
    return Math.ceil(days / 7) * 7;
  }, [monthAnchor, monthGridStart]);
  const monthCells = useMemo(
    () => Array.from({ length: monthCellCount }, (_, i) => shiftDays(monthGridStart, i)),
    [monthGridStart, monthCellCount],
  );

  const visibleDays = view === "semaine" ? weekDays : monthCells;

  useEffect(() => {
    const missing = visibleDays.map(dateKey).filter((k) => !(k in cache));
    if (!missing.length) return;
    let alive = true;
    void Promise.all(
      missing.map((k): Promise<[string, AgendaItem[]]> =>
        fetchAgendaDay(k)
          .then((events): [string, AgendaItem[]] => [k, events])
          .catch((e) => {
            if (e instanceof UnauthorizedError) throw e;
            return [k, []] as [string, AgendaItem[]];
          }),
      ),
    ).then((pairs) => {
      if (!alive) return;
      setCache((c) => {
        const next = { ...c };
        for (const [k, events] of pairs) next[k] = events;
        return next;
      });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleDays.map(dateKey).join(",")]);

  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const floating = useMemo(
    () => items.filter((it) => it.status === "active" && !it.doneAt && (!it.due || it.allDay)).slice(0, 4),
    [items],
  );

  const title =
    view === "mois" ? monthTitleFmt.format(atNoonUtc(monthAnchor)) : `${dayTitleFmt.format(atNoonUtc(weekStart))} → ${dayTitleFmt.format(atNoonUtc(weekDays[6]))}`;

  // Sélection : d'abord un Item réel (ouvert depuis un autre écran), sinon
  // une entrée d'agenda posée directement dans le calendrier (pas d'item lié).
  const selectedItem = selectedId ? itemById.get(selectedId) : undefined;
  const selectedAgendaEntry = useMemo(() => {
    if (!selectedId || selectedItem) return undefined;
    for (const events of Object.values(cache)) {
      const hit = events.find((e) => e.id === selectedId);
      if (hit) return hit;
    }
    return undefined;
  }, [selectedId, selectedItem, cache]);

  return (
    <div className="grid h-full gap-3" style={{ gridTemplateColumns: "1fr 320px", animation: "fade .3s both" }}>
      <div className="flex h-full min-h-0 flex-col gap-3" style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)", overflow: "hidden" }}>
        <div className="flex flex-none items-center gap-3.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAnchor((a) => (view === "mois" ? shiftMonths(a, -1) : shiftDays(a, -7)))}
              aria-label="Précédent"
              className="flex items-center justify-center"
              style={{ width: 38, height: 38, background: C.bg, border: "none", borderRadius: 99, cursor: "pointer" }}
            >
              <ChevronLeftIcon size={16} className="text-ink" />
            </button>
            <button
              onClick={() => setAnchor((a) => (view === "mois" ? shiftMonths(a, 1) : shiftDays(a, 7)))}
              aria-label="Suivant"
              className="flex items-center justify-center"
              style={{ width: 38, height: 38, background: C.bg, border: "none", borderRadius: 99, cursor: "pointer" }}
            >
              <ChevronRightIcon size={16} className="text-ink" />
            </button>
          </div>
          <span className="font-extrabold tracking-[-0.03em]" style={{ fontSize: 22, textTransform: "capitalize" }}>{title}</span>
          <button
            onClick={() => setAnchor(today)}
            style={{ padding: "8px 14px", background: C.surface, border: "1px solid rgba(16,16,16,.1)", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}
          >
            Aujourd’hui
          </button>
          <div className="ml-auto flex gap-[3px]" style={{ padding: 4, background: C.bg, borderRadius: 99 }}>
            <button onClick={() => setView("semaine")} style={{ padding: "8px 16px", border: "none", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: view === "semaine" ? C.ink : "transparent", color: view === "semaine" ? "#fff" : C.inkMuted }}>Semaine</button>
            <button onClick={() => setView("mois")} style={{ padding: "8px 16px", border: "none", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: view === "mois" ? C.ink : "transparent", color: view === "mois" ? "#fff" : C.inkMuted }}>Mois</button>
          </div>
        </div>

        {view === "semaine" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-none" style={{ paddingRight: 8 }}>
              <div style={{ width: 58, flex: "none" }} />
              {weekDays.map((d) => {
                const isToday = sameDate(d, today);
                return (
                  <div key={dateKey(d)} className="flex flex-1 flex-col items-center gap-1" style={{ padding: "4px 0 8px" }}>
                    <span className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.04em", color: isToday ? C.ink : C.inkFaint }}>{dowShortFmt.format(atNoonUtc(d)).replace(".", "")}</span>
                    <span className="tnum flex items-center justify-center font-bold" style={{ width: 36, height: 36, borderRadius: 14, fontSize: 14, background: isToday ? C.ink : C.surface, color: isToday ? "#fff" : C.ink, border: isToday ? "none" : "1px solid rgba(16,16,16,.06)" }}>{d.d}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex min-h-0 flex-1" style={{ overflowY: "auto", borderTop: "1px solid rgba(16,16,16,.08)" }}>
              <div style={{ width: 58, flex: "none" }}>
                {HOURS.map((h) => (
                  <div key={h} className="flex justify-end" style={{ height: HOUR_PX, paddingRight: 10 }}>
                    <span className="tnum text-[11px] font-semibold" style={{ color: C.inkFaint, transform: "translateY(-6px)" }}>{String(h).padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>
              {weekDays.map((d) => {
                const key = dateKey(d);
                const events = (cache[key] ?? []).filter((e) => !e.allDay);
                const isToday = sameDate(d, today);
                return (
                  <div key={key} className="relative flex-1" style={{ borderLeft: "1px solid rgba(16,16,16,.06)", background: isToday ? "rgba(251,226,174,.16)" : weekdayOf(d) === 0 || weekdayOf(d) === 6 ? "rgba(16,16,16,.015)" : "transparent", height: HOURS.length * HOUR_PX }}>
                    {HOURS.map((h) => (
                      <div key={h} className="absolute" style={{ left: 0, right: 0, height: 1, background: "rgba(16,16,16,.05)", top: (h - HOUR_START) * HOUR_PX }} />
                    ))}
                    {events.map((e) => {
                      const due = new Date(e.due);
                      const mins = zonedParts(due).hour * 60 + zonedParts(due).minute - HOUR_START * 60;
                      const durationMin = e.durationMinutes ?? 60;
                      const project = e.projectId ? projectMap.get(e.projectId) : undefined;
                      const skin = project ? skinFor(project) : { bg: C.bg, fg: C.inkMuted };
                      const done = e.briefItemId ? !!itemById.get(e.briefItemId)?.doneAt : false;
                      return (
                        <button
                          key={e.id}
                          onClick={() => onSelect(e.briefItemId ?? e.id)}
                          className="absolute flex flex-col gap-0.5 overflow-hidden text-left"
                          style={{
                            left: 4, right: 4, padding: "7px 9px", border: "none",
                            borderLeft: `3px solid ${done ? C.inkFaint : skin.fg}`,
                            borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                            top: Math.max(0, Math.round((mins / 60) * HOUR_PX)),
                            height: Math.max(38, Math.round((durationMin / 60) * HOUR_PX) - 4),
                            background: done ? C.bg : skin.bg, color: done ? C.inkFaint : skin.fg,
                            boxShadow: (e.briefItemId ?? e.id) === selectedId ? "0 6px 20px rgba(16,16,16,.18)" : "none",
                          }}
                        >
                          <span className="tnum font-mono" style={{ fontSize: 9, letterSpacing: "0.05em", opacity: 0.75 }}>{timeFmt.format(due)}</span>
                          <span className="text-[12px] font-bold tracking-[-0.01em]" style={{ lineHeight: 1.25, textDecoration: done ? "line-through" : "none" }}>{e.title}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            <div className="grid flex-none gap-2" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
              {dowLabels.map((l) => (
                <span key={l} className="font-mono text-center" style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: C.inkFaint }}>{l}</span>
              ))}
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
              {monthCells.map((d) => {
                const key = dateKey(d);
                const events = (cache[key] ?? []).slice().sort((a, b) => a.due.localeCompare(b.due));
                const inMonth = d.m === anchor.m;
                const isToday = sameDate(d, today);
                return (
                  <button
                    key={key}
                    onClick={() => { setAnchor(d); setView("semaine"); }}
                    className="flex min-w-0 flex-col gap-1.5 text-left"
                    style={{
                      minHeight: 104, padding: 10, cursor: "pointer", fontFamily: "inherit",
                      border: isToday ? "1px solid rgba(138,90,16,.35)" : "1px solid rgba(16,16,16,.06)",
                      borderRadius: 18, background: isToday ? "rgba(251,226,174,.35)" : C.surface,
                      opacity: inMonth ? 1 : 0.42,
                    }}
                  >
                    <span className="tnum text-[13px] font-bold" style={{ color: isToday ? C.ink : C.inkMuted }}>{d.d}</span>
                    {events.slice(0, 2).map((e) => {
                      const project = e.projectId ? projectMap.get(e.projectId) : undefined;
                      const skin = project ? skinFor(project) : { bg: C.bg, fg: C.inkMuted };
                      return (
                        <span key={e.id} className="block truncate" style={{ padding: "3px 7px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: skin.bg, color: skin.fg }}>
                          {e.allDay ? "" : `${timeFmt.format(new Date(e.due))} `}{e.title}
                        </span>
                      );
                    })}
                    {events.length > 2 && <span className="text-[10px] font-bold" style={{ color: C.inkMuted }}>+{events.length - 2} autres</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
        {(selectedItem || selectedAgendaEntry) && (
          <SelectionPanel
            item={selectedItem}
            entry={selectedAgendaEntry}
            project={projectMap.get((selectedItem ?? selectedAgendaEntry)?.projectId ?? "")}
            onClose={() => onSelect(null)}
            onToggleDone={onToggleDone}
            onPostpone={onPostpone}
          />
        )}

        <div className="flex flex-none flex-col gap-3" style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)" }}>
          <span className="text-[17px] font-bold tracking-[-0.02em]">Sans créneau</span>
          <span className="text-[12px] font-medium" style={{ color: C.inkMuted, lineHeight: 1.45 }}>Ces items n’ont pas d’heure. Repousse-les d’un jour, ou ouvre-les pour leur en donner une.</span>
          {floating.length === 0 && <span className="text-[12px] font-medium" style={{ color: C.inkFaint }}>Rien ici.</span>}
          {floating.map((it) => {
            const d = dot(projectMap.get(it.projectId));
            return (
              <div key={it.id} className="flex items-center gap-2.5" style={{ padding: "11px 12px", background: C.bg, borderRadius: 18 }}>
                <span style={{ width: 7, height: 7, flex: "none", borderRadius: d.radius, background: d.bg }} />
                <button onClick={() => onSelect(it.id)} className="min-w-0 flex-1 text-left text-[12px] font-semibold tracking-[-0.01em]" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>{it.title}</button>
                <button
                  onClick={() => onPostpone(it.id)}
                  aria-label="Repousser"
                  className="flex flex-none items-center justify-center"
                  style={{ width: 26, height: 26, background: C.surface, border: "1px solid rgba(16,16,16,.08)", borderRadius: 99, cursor: "pointer" }}
                >
                  <ChevronRightIcon size={12} className="text-ink" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SelectionPanel({
  item,
  entry,
  project,
  onClose,
  onToggleDone,
  onPostpone,
}: {
  item: Item | undefined;
  entry: AgendaItem | undefined;
  project: Project | undefined;
  onClose: () => void;
  onToggleDone: (id: string, completedAt?: string | null) => void;
  onPostpone: (id: string) => void;
}) {
  const title = item?.title ?? entry?.title ?? "";
  const kind = item?.kind ?? entry?.kind;
  const kindLabel = item?.status === "idea" ? "Idée" : kind === "event" ? "RDV" : "Tâche";
  const skin = project ? skinFor(project) : { bg: C.bg, fg: C.inkMuted };
  const due = item?.due ?? entry?.due ?? null;
  const allDay = item?.allDay ?? entry?.allDay ?? false;
  const durationMinutes = item?.durationMinutes ?? entry?.durationMinutes ?? null;
  const done = !!item?.doneAt;

  return (
    <div className="flex flex-col gap-3.5" style={{ padding: 22, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)", animation: "pop .45s cubic-bezier(.2,.9,.3,1) both" }}>
      <div className="flex items-start justify-between gap-2.5">
        <span style={{ padding: "5px 11px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: skin.bg, color: skin.fg }}>{kindLabel}</span>
        <button onClick={onClose} aria-label="Fermer" className="flex items-center justify-center" style={{ width: 30, height: 30, background: C.bg, border: "none", borderRadius: 99, cursor: "pointer" }}>×</button>
      </div>
      <span className="font-bold tracking-[-0.02em]" style={{ fontSize: 20, lineHeight: 1.25 }}>{title}</span>
      <div className="flex flex-col" style={{ gap: 1 }}>
        <MetaRow k="Destination" v={project?.name ?? "—"} />
        <MetaRow k="Date" v={due ? metaDayFmt.format(new Date(due)) : "sans échéance"} />
        <MetaRow k="Créneau" v={due && !allDay ? `${timeFmt.format(new Date(due))} · ${durationMinutes ?? 60} min` : "journée"} />
        {item && <MetaRow k="Priorité" v={PRIORITIES[item.priority].short} />}
      </div>
      {item?.audioOrigin && (
        <div style={{ padding: "13px 14px", background: C.bg, borderRadius: 18 }}>
          <div className="font-mono" style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkMuted, marginBottom: 6 }}>Fil d’origine vocal</div>
          <div className="text-[12px] font-medium" style={{ lineHeight: 1.5 }}>« {item.audioOrigin.highlight} »</div>
        </div>
      )}
      {item && (
        <div className="flex gap-2">
          <button
            onClick={() => onToggleDone(item.id, due ?? undefined)}
            className="flex-1"
            style={{ padding: 12, background: C.ink, color: "#fff", border: "none", borderRadius: 18, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}
          >
            {done ? "Remettre à faire" : "Marquer fait"}
          </button>
          <button
            onClick={() => onPostpone(item.id)}
            className="flex-1"
            style={{ padding: 12, background: C.bg, color: C.ink, border: "none", borderRadius: 18, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}
          >
            Repousser +1j
          </button>
        </div>
      )}
    </div>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3" style={{ padding: "10px 0", borderBottom: "1px solid rgba(16,16,16,.06)" }}>
      <span className="text-[12px] font-semibold" style={{ color: C.inkMuted }}>{k}</span>
      <span className="text-right text-[12px] font-bold">{v}</span>
    </div>
  );
}
