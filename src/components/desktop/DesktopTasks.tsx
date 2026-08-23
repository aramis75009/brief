"use client";

/**
 * Écran Tâches desktop — n'existe pas sur mobile. Liste groupée par projet,
 * filtrable, plus un ajout rapide sans passer par la voix (DESIGN.md : le
 * clavier reste la porte de secours).
 */

import { useMemo, useState } from "react";
import { skinFor, shapeFor } from "@/lib/projects";
import { formatDue } from "@/lib/due";
import { TASK_FILTERS, filterTasks, groupByProject, type TaskFilterKey } from "@/lib/desktopDashboard";
import type { Item, Project } from "@/lib/types";

const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
} as const;

function dot(project: Project) {
  const skin = skinFor(project);
  const shape = shapeFor(project);
  return { bg: skin.bg, radius: shape === "square" ? 2 : 99 };
}

export function DesktopTasks({
  items,
  projects,
  onToggleDone,
  onOpenTask,
  onPostpone,
  onQuickAdd,
}: {
  items: Item[];
  projects: Project[];
  onToggleDone: (id: string, completedAt?: string | null) => void;
  onOpenTask: (id: string) => void;
  onPostpone: (id: string) => void;
  onQuickAdd: (title: string, projectId: string) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const [filter, setFilter] = useState<TaskFilterKey>("all");
  const [quickText, setQuickText] = useState("");
  const [quickProjectId, setQuickProjectId] = useState(projects[0]?.id ?? "");

  const filtered = useMemo(() => filterTasks(items, filter, now), [items, filter, now]);
  const groups = useMemo(() => groupByProject(filtered, projects), [filtered, projects]);
  const filterCounts = useMemo(
    () => Object.fromEntries(TASK_FILTERS.map((f) => [f.key, filterTasks(items, f.key, now).length])),
    [items, now],
  );

  const quickProject = projects.find((p) => p.id === quickProjectId) ?? projects[0];

  return (
    <div className="grid h-full gap-3" style={{ gridTemplateColumns: "1fr 320px", animation: "fade .3s both" }}>
      <div className="flex h-full min-h-0 flex-col gap-3" style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)", overflow: "hidden" }}>
        <div className="flex flex-none items-center gap-3">
          <span className="font-extrabold tracking-[-0.03em]" style={{ fontSize: 20 }}>Tâches</span>
          <div className="ml-auto flex gap-[3px]" style={{ padding: 4, background: C.bg, borderRadius: 99 }}>
            {TASK_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="flex items-center gap-1.5"
                style={{ padding: "8px 15px", border: "none", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: filter === f.key ? C.ink : "transparent", color: filter === f.key ? "#fff" : C.inkMuted }}
              >
                <span>{f.label}</span>
                <span className="tnum" style={{ opacity: 0.6 }}>{filterCounts[f.key] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {groups.length === 0 && (
          <span className="text-[13px] font-medium" style={{ color: C.inkMuted, padding: "8px 0" }}>Rien ici.</span>
        )}

        {groups.map(({ project, rows }) => {
          const d = dot(project);
          return (
            <div key={project.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2.25">
                <span style={{ width: 9, height: 9, borderRadius: d.radius, background: d.bg }} />
                <span className="text-[15px] font-bold tracking-[-0.02em]">{project.name}</span>
                <span className="tnum text-[12px] font-bold" style={{ color: C.inkFaint }}>{rows.length}</span>
                <span className="h-px flex-1" style={{ background: "rgba(16,16,16,.06)" }} />
              </div>
              {rows.map((it) => {
                const late = filter === "overdue";
                return (
                  <div key={it.id} className="flex items-center gap-3" style={{ padding: "12px 14px", background: C.bg, borderRadius: 18 }}>
                    <button
                      onClick={() => onToggleDone(it.id)}
                      aria-label="Marquer fait"
                      className="flex flex-none items-center justify-center"
                      style={{ width: 26, height: 26, borderRadius: 99, padding: 0, cursor: "pointer", background: it.doneAt ? C.ink : C.surface, border: it.doneAt ? `2px solid ${C.ink}` : "2px solid rgba(16,16,16,.18)" }}
                    >
                      {it.doneAt && <span style={{ width: 8, height: 8, borderRadius: 99, background: "#fff" }} />}
                    </button>
                    <button onClick={() => onOpenTask(it.id)} className="flex min-w-0 flex-1 flex-col gap-1 text-left" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                      <span className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: it.doneAt ? C.inkFaint : C.ink, textDecoration: it.doneAt ? "line-through" : "none" }}>{it.title}</span>
                      <span className="text-[11px] font-semibold" style={{ color: late ? "var(--color-danger)" : C.inkMuted }}>{formatDue(it.due, it.allDay)}</span>
                    </button>
                    <button
                      onClick={() => onPostpone(it.id)}
                      style={{ flex: "none", padding: "7px 12px", background: C.surface, border: "1px solid rgba(16,16,16,.08)", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}
                    >
                      +1j
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
        </div>
      </div>

      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
        <div className="flex flex-none flex-col gap-3" style={{ padding: 18, background: C.ink, color: "#fff", borderRadius: 24, boxShadow: "0 8px 20px rgba(16,16,16,.28)" }}>
          <span className="text-[17px] font-bold tracking-[-0.02em]">Ajouter sans parler</span>
          <span className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,.6)", lineHeight: 1.45 }}>Le clavier reste la porte de secours. Programmée demain 09:00.</span>
          <input
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && quickProject) {
                onQuickAdd(quickText, quickProject.id);
                setQuickText("");
              }
            }}
            placeholder="ex. relancer le fournisseur vendredi"
            style={{ padding: "13px 14px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 18, color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}
          />
          <div className="flex flex-wrap gap-1.5">
            {projects.map((p) => {
              const on = p.id === quickProjectId;
              const skin = skinFor(p);
              return (
                <button
                  key={p.id}
                  onClick={() => setQuickProjectId(p.id)}
                  style={{ padding: "8px 13px", border: `1px solid ${on ? skin.bg : "rgba(255,255,255,.18)"}`, borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: on ? skin.bg : "transparent", color: on ? skin.fg : "rgba(255,255,255,.7)" }}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => { if (quickProject) { onQuickAdd(quickText, quickProject.id); setQuickText(""); } }}
            style={{ padding: 13, background: "#fff", color: C.ink, border: "none", borderRadius: 18, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}
          >
            Ranger dans {quickProject?.name ?? "…"}
          </button>
        </div>
      </div>
    </div>
  );
}
