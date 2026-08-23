"use client";

/**
 * Écran Dashboard desktop — porte fidèlement `Brief Desktop.dc.html`
 * (Claude Design), branché sur les vraies données : `overview` (déjà servi
 * par `/api/overview`, jamais recalculé en double) pour la charge et le
 * retard ; `todayAgenda`/`items` pour tout le reste.
 *
 * Réduit à la demande d'Aramis le 23/08 (soir) : Horizon 7 jours, Ton mur,
 * la prévisualisation Idées et Chaîne & sync sont retirés du rendu — pas
 * supprimés du modèle de données, juste mis de côté en attendant une
 * décision sur leur forme finale. « En retard » rejoint la carte Avancement,
 * dans l'espace qu'elle laissait vide sous les barres de progression.
 */

import { useMemo } from "react";
import { MicIcon, StarIcon } from "../icons";
import { skinFor, shapeFor } from "@/lib/projects";
import { compareByDue } from "@/lib/due";
import { TIMEZONE } from "@/lib/zoned";
import { overdueItems, weekProgressByProject } from "@/lib/desktopDashboard";
import type { AgendaItem } from "@/lib/agenda";
import type { Item, Overview, Project } from "@/lib/types";

const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  danger: "var(--color-danger)",
  task100: "var(--color-task-100)",
  task700: "var(--color-task-700)",
  meet700: "var(--color-meet-700)",
} as const;

const dateLongFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIMEZONE,
});
const dayShortFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: TIMEZONE });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE });

/** 26 barres, animation `idle` — la version animée de Claude Design, fond noir. */
const WAVE_DELAYS = Array.from({ length: 26 }, (_, n) => (n * 0.055).toFixed(2));

function dot(project: Project | undefined) {
  if (!project) return { bg: C.inkFaint, radius: 99 };
  const skin = skinFor(project);
  const shape = shapeFor(project);
  return { bg: skin.bg, radius: shape === "square" ? 2 : 99 };
}

export function DesktopDashboard({
  items,
  ideaItems,
  todayAgenda,
  projects,
  overview,
  transcript,
  onToggleDone,
  onOpenTask,
  onOpenCapture,
  onOpenChat,
  onGoTasks,
}: {
  items: Item[];
  ideaItems: Item[];
  todayAgenda: AgendaItem[];
  projects: Project[];
  overview: Overview | null;
  transcript: string;
  onToggleDone: (id: string, completedAt?: string | null) => void;
  onOpenTask: (id: string) => void;
  onOpenCapture: () => void;
  onOpenChat: () => void;
  onGoTasks: () => void;
}) {
  const now = useMemo(() => new Date(), []);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  const todaySorted = useMemo(() => [...todayAgenda].sort(compareByDue), [todayAgenda]);
  const todayDoneCount = useMemo(
    () => todaySorted.filter((e) => (e.briefItemId ? itemById.get(e.briefItemId)?.doneAt : false)).length,
    [todaySorted, itemById],
  );
  const donutPct = todaySorted.length ? Math.round((todayDoneCount / todaySorted.length) * 100) : 0;

  const overdue = useMemo(() => overdueItems(items, now).slice(0, 3), [items, now]);
  const progressRows = useMemo(() => weekProgressByProject(items, projects, now), [items, projects, now]);

  const weekTasks = overview?.horizon.reduce((n, d) => n + (d.total - d.events), 0) ?? 0;
  const weekEvents = overview?.horizon.reduce((n, d) => n + d.events, 0) ?? 0;
  const chargeDefs = [
    { label: "Tâches", count: weekTasks, bg: C.task100, fg: C.task700 },
    { label: "RDV", count: weekEvents, bg: "var(--color-meet-100)", fg: C.meet700 },
    { label: "Idées", count: ideaItems.length, bg: "var(--color-idea-100)", fg: "var(--color-idea-700)" },
  ];

  const activity7d = overview?.activity.reduce((a, b) => a + b, 0) ?? 0;

  return (
    <div className="flex h-full flex-col gap-4" style={{ animation: "fade .3s both" }}>
      {/* Hero */}
      <section
        className="grid flex-none items-end"
        style={{
          gridTemplateColumns: "minmax(280px,1fr) minmax(260px,1fr) auto",
          gap: 24,
          padding: "20px 26px",
          background: "rgba(255,255,255,.72)",
          border: "1px solid rgba(16,16,16,.06)",
          borderRadius: 24,
          boxShadow: "0 6px 20px rgba(16,16,16,.07)",
        }}
      >
        <div className="flex flex-col gap-3">
          <div>
            <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 8 }}>
              {dateLongFmt.format(now)}
            </div>
            <h1 className="font-extrabold tracking-[-0.03em]" style={{ fontSize: 30, lineHeight: 1.08, margin: 0 }}>Salut Aramis,</h1>
            <h2 className="font-extrabold tracking-[-0.03em]" style={{ fontSize: 30, lineHeight: 1.08, margin: 0, color: C.inkFaint }}>voilà ta journée.</h2>
          </div>
          <button
            onClick={onOpenChat}
            className="flex items-center gap-3 text-left"
            style={{ maxWidth: 420, padding: "14px 18px", background: C.ink, border: "none", borderRadius: 18, cursor: "pointer", fontFamily: "inherit" }}
          >
            <StarIcon size={18} className="text-white" />
            <span className="text-[14px] font-bold" style={{ color: "#fff" }}>Demander à l'IA</span>
            <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,.6)" }}>— « qu’est-ce qui traîne ? »</span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: C.inkFaint }}>Charge de la semaine</div>
          <div className="flex gap-1" style={{ height: 38 }}>
            {chargeDefs.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-center gap-1.75"
                style={{ flex: Math.max(1, s.count), borderRadius: 99, background: s.bg, color: s.fg, transformOrigin: "left", animation: "rail .5s cubic-bezier(.4,0,.2,1) both" }}
              >
                <span className="text-[12px] font-bold tracking-[-0.01em]">{s.label}</span>
                <span className="tnum text-[12px] font-extrabold">{s.count}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4.5">
            <div className="flex items-baseline gap-1.5">
              <span className="tnum text-[15px] font-extrabold" style={{ color: C.danger }}>{overview?.totals.overdue ?? 0}</span>
              <span className="text-[12px] font-semibold" style={{ color: C.inkMuted }}>en retard</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="tnum text-[15px] font-extrabold">{weekTasks + weekEvents}</span>
              <span className="text-[12px] font-semibold" style={{ color: C.inkMuted }}>cette semaine</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="tnum text-[15px] font-extrabold">{ideaItems.length}</span>
              <span className="text-[12px] font-semibold" style={{ color: C.inkMuted }}>idées à trier</span>
            </div>
          </div>
        </div>

        <div className="flex gap-6.5">
          {[
            { value: overview?.totals.open ?? 0, label: "items ouverts" },
            { value: overview?.totals.today ?? 0, label: "aujourd’hui" },
            { value: activity7d, label: "dictées / 7j" },
          ].map((h) => (
            <div key={h.label} className="flex flex-col gap-0.5">
              <span className="tnum font-extrabold tracking-[-0.03em]" style={{ fontSize: 30, lineHeight: 1 }}>{h.value}</span>
              <span className="text-[12px] font-semibold" style={{ color: C.inkMuted }}>{h.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid flex-1 gap-4" style={{ gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "1fr", minHeight: 0 }}>
        {/* Capture — version animée de Claude Design, taille de base */}
        <div className="flex flex-col justify-between gap-5" style={{ gridColumn: "span 3", padding: 22, background: C.ink, color: "#FFFFFF", borderRadius: 24, boxShadow: "0 8px 20px rgba(16,16,16,.28)", minHeight: 0, overflow: "hidden" }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,.45)" }}>Capture</div>
              <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Parle.<br />Je m'occupe du reste.</div>
            </div>
          </div>

          <div className="flex items-center gap-[3px]" style={{ height: 54 }}>
            {WAVE_DELAYS.map((delay, n) => (
              <span
                key={n}
                style={{
                  flex: 1,
                  height: "100%",
                  borderRadius: 99,
                  background: "rgba(255,255,255,.3)",
                  transform: "scaleY(.4)",
                  animation: "idle 1.6s ease-in-out infinite",
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <div style={{ padding: "12px 14px", background: "rgba(255,255,255,.07)", borderRadius: 18 }}>
              <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>Dernière dictée</div>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.45, color: "rgba(255,255,255,.78)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {transcript.trim() ? `« ${transcript.trim().slice(0, 140)}${transcript.trim().length > 140 ? "…" : ""} »` : "Rien de récent."}
              </div>
            </div>
            <button
              onClick={onOpenCapture}
              className="flex items-center justify-center gap-2.25"
              style={{ padding: 14, background: "#FFFFFF", color: C.ink, border: "none", borderRadius: 18, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}
            >
              <MicIcon size={16} className="text-ink" />
              <span>Dicter maintenant</span>
            </button>
          </div>
        </div>

        {/* Aujourd'hui */}
        <div className="flex flex-col" style={{ gridColumn: "span 5", padding: 22, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)", minHeight: 0, overflow: "hidden" }}>
          <div className="flex flex-none items-baseline justify-between" style={{ marginBottom: 14 }}>
            <span className="font-bold tracking-[-0.02em]" style={{ fontSize: 20 }}>Aujourd’hui</span>
            <button
              onClick={onGoTasks}
              className="flex items-center gap-1.5"
              style={{ padding: "7px 12px", background: C.bg, border: "none", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}
            >
              Tout voir
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ gap: 2 }}>
            {todaySorted.length === 0 && (
              <span className="text-[13px] font-medium" style={{ color: C.inkMuted, padding: "12px 10px" }}>Rien de prévu aujourd’hui.</span>
            )}
            {todaySorted.map((entry) => {
              const it = entry.briefItemId ? itemById.get(entry.briefItemId) : undefined;
              const project = it ? projectMap.get(it.projectId) : entry.projectId ? projectMap.get(entry.projectId) : undefined;
              const d = dot(project);
              const done = !!it?.doneAt;
              const time = entry.allDay ? "journée" : timeFmt.format(new Date(entry.due));
              return (
                <div key={entry.id} className="flex items-center gap-3" style={{ padding: "10px 10px", borderRadius: 18 }}>
                  <button
                    onClick={() => it && onToggleDone(it.id, entry.due)}
                    aria-label="Marquer fait"
                    disabled={!it}
                    className="flex flex-none items-center justify-center"
                    style={{ width: 26, height: 26, borderRadius: 99, padding: 0, cursor: it ? "pointer" : "default", background: done ? C.ink : C.surface, border: done ? `2px solid ${C.ink}` : "2px solid rgba(16,16,16,.18)" }}
                  >
                    {done && <span style={{ width: 8, height: 8, borderRadius: 99, background: "#fff" }} />}
                  </button>
                  <button
                    onClick={() => it && onOpenTask(it.id)}
                    className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                    style={{ background: "none", border: "none", padding: 0, cursor: it ? "pointer" : "default", fontFamily: "inherit" }}
                  >
                    <span className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: done ? C.inkFaint : C.ink, textDecoration: done ? "line-through" : "none" }}>{entry.title}</span>
                    <span className="flex items-center gap-1.75">
                      <span style={{ width: 7, height: 7, borderRadius: d.radius, background: d.bg, flexShrink: 0 }} />
                      <span className="text-[12px] font-semibold" style={{ color: C.inkMuted }}>{project?.name ?? "—"}</span>
                    </span>
                  </button>
                  <span className="tnum flex-none text-[13px] font-bold" style={{ color: done ? C.inkFaint : C.ink }}>{time}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Avancement + En retard (fusionnés dans l'espace laissé libre sous les barres) */}
        <div className="flex flex-col gap-4" style={{ gridColumn: "span 4", padding: 22, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)", minHeight: 0, overflow: "hidden" }}>
          <div className="flex flex-none items-baseline justify-between">
            <span className="font-bold tracking-[-0.02em]" style={{ fontSize: 20 }}>Avancement</span>
            <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: C.inkFaint }}>Journée</span>
          </div>
          <div className="flex flex-none items-center gap-6">
            <div className="relative flex-none" style={{ width: 116, height: 116, borderRadius: 99, background: `conic-gradient(${C.ink} 0 ${donutPct}%, #EDEDEA ${donutPct}% 100%)` }}>
              <div className="absolute flex flex-col items-center justify-center" style={{ inset: 12, borderRadius: 99, background: C.surface }}>
                <span className="tnum font-extrabold tracking-[-0.03em]" style={{ fontSize: 24, lineHeight: 1 }}>{donutPct}%</span>
                <span className="text-[11px] font-semibold" style={{ color: C.inkMuted }}>fait</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2.5">
              {progressRows.length === 0 && <span className="text-[12px] font-medium" style={{ color: C.inkMuted }}>Rien cette semaine.</span>}
              {progressRows.map(({ project, done, total }) => (
                <div key={project.id} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] font-bold tracking-[-0.01em]">{project.name}</span>
                    <span className="tnum text-[12px] font-bold" style={{ color: C.inkMuted }}>{done}/{total}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: C.bg, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${total ? Math.round((done / total) * 100) : 0}%`, background: skinFor(project).bg, transformOrigin: "left", animation: "rail .5s cubic-bezier(.4,0,.2,1) both" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px flex-none" style={{ background: "rgba(16,16,16,.06)" }} />

          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
            <div className="flex flex-none items-center gap-2.25">
              <span style={{ width: 8, height: 8, borderRadius: 99, background: C.danger }} />
              <span className="font-bold tracking-[-0.02em]" style={{ fontSize: 15 }}>En retard</span>
              <span className="tnum font-extrabold" style={{ marginLeft: "auto", fontSize: 15, color: C.danger }}>{overview?.totals.overdue ?? 0}</span>
            </div>
            {overdue.length === 0 && <span className="text-[12px] font-medium" style={{ color: C.inkMuted }}>Rien en retard.</span>}
            {overdue.map((it) => (
              <div key={it.id} className="flex items-center gap-2.75" style={{ padding: "9px 10px", background: C.bg, borderRadius: 16 }}>
                <button
                  onClick={() => onToggleDone(it.id)}
                  aria-label="Marquer fait"
                  style={{ width: 22, height: 22, flex: "none", padding: 0, borderRadius: 99, border: "2px solid rgba(226,58,46,.45)", background: C.surface, cursor: "pointer" }}
                />
                <button onClick={() => onOpenTask(it.id)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                  <span className="text-[12px] font-semibold tracking-[-0.01em]">{it.title}</span>
                  <span className="text-[11px] font-semibold" style={{ color: C.danger }}>{it.due ? `prévu ${dayShortFmt.format(new Date(it.due)).replace(".", "")}` : ""}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
