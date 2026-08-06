"use client";

import { PRIOS, PROJECTS, fmtDate, iso } from "@/lib/mock";
import type { SentTask } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "Tout" },
  { key: "today", label: "Aujourd'hui" },
  { key: "overdue", label: "En retard" },
] as const;

export type FilterKey = (typeof FILTERS)[number]["key"];

export function TasksScreen({
  sent,
  filter,
  onFilter,
  onOpen,
}: {
  sent: SentTask[];
  filter: FilterKey;
  onFilter: (f: FilterKey) => void;
  onOpen: (id: string) => void;
}) {
  const today = iso(new Date());

  const visible = sent.filter((t) => {
    if (filter === "today") return t.dueISO === today;
    if (filter === "overdue") return !!t.dueISO && t.dueISO < today;
    return true;
  });

  const groups = PROJECTS.map((p) => {
    const items = visible.filter((t) => t.projectId === p.id);
    return items.length ? { project: p, items } : null;
  }).filter((g): g is { project: (typeof PROJECTS)[number]; items: SentTask[] } => g !== null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-[26px] pt-2.5 pb-3">
        <h1 className="mt-0 mb-3 text-[27px] font-semibold tracking-[-0.5px] text-ink">Tâches</h1>
        <div className="flex gap-1 rounded-[14px] bg-stone-3 p-1">
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilter(f.key)}
                aria-pressed={on}
                className="h-9 flex-1 cursor-pointer rounded-[11px] border-none text-[13px] font-semibold transition-all duration-200"
                style={{
                  background: on ? "#FFFFFF" : "transparent",
                  color: on ? "#1C1A18" : "#8A8580",
                  boxShadow: on ? "0 1px 4px -2px rgba(28,26,24,.35)" : "none",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-1 pb-[18px]">
        {groups.map(({ project, items }) => (
          <div key={project.id} className="mb-5">
            <div className="mx-1 mt-0 mb-[9px] flex items-center gap-2">
              <span
                className="inline-flex h-6 items-center rounded-lg px-[9px] text-[11.5px] font-semibold"
                style={{ background: project.bg, color: project.fg }}
              >
                {project.name}
              </span>
              <span className="text-[11.5px] font-medium text-muted-2">
                {items.length} {items.length > 1 ? "tâches" : "tâche"}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((t) => {
                const overdue = !!t.dueISO && t.dueISO < today;
                const prioFg = PRIOS[t.prio].fg === "#1C1A18" ? "#8A8580" : PRIOS[t.prio].fg;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpen(t.id)}
                    className="w-full cursor-pointer rounded-[18px] border border-[rgba(28,26,24,0.07)] bg-card px-[15px] py-[13px] text-left shadow-[0_1px_4px_-3px_rgba(28,26,24,0.3)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_6px_16px_-12px_rgba(28,26,24,0.5)]"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="flex-1 text-[15px] leading-[1.4] font-medium text-pretty text-ink">
                        {t.title}
                      </span>
                      <span
                        className="mt-px flex-none text-[11px] font-semibold"
                        style={{ color: t.sync === "synced" ? "#5A7A5E" : "#A8792F" }}
                      >
                        {t.sync === "synced" ? "✓ synced" : "⏳ pending"}
                      </span>
                    </div>
                    <div className="mt-[7px] flex items-center gap-2">
                      <span
                        className="text-[11.5px] font-medium"
                        style={{ color: overdue ? "#C0603C" : "#8A8580" }}
                      >
                        {t.dueISO ? `${t.dueText || ""} · ${fmtDate(t.dueISO)}` : "Pas d'échéance"}
                      </span>
                      <span className="h-[3px] w-[3px] rounded-full bg-dot" />
                      <span className="text-[11.5px] font-semibold" style={{ color: prioFg }}>
                        {PRIOS[t.prio].label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {!groups.length && (
          <div className="px-5 py-16 text-center">
            <p className="m-0 text-sm leading-[1.5] font-medium text-muted-2">
              Aucune tâche ici.
              <br />
              Dicte une note pour commencer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
