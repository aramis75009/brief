"use client";

import { PRIOS, skinFor } from "@/lib/todoist";
import type { Project, SentTask } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "Tout" },
  { key: "sent", label: "Envoyées" },
  { key: "failed", label: "Échouées" },
] as const;

export type FilterKey = (typeof FILTERS)[number]["key"];

export function TasksScreen({
  sent,
  projects,
  filter,
  onFilter,
  onOpen,
  onRetryAll,
  retrying,
}: {
  sent: SentTask[];
  projects: Project[];
  filter: FilterKey;
  onFilter: (f: FilterKey) => void;
  onOpen: (id: string) => void;
  onRetryAll: () => void;
  retrying: boolean;
}) {
  const visible = sent.filter((t) => (filter === "all" ? true : t.status === filter));
  const failedCount = sent.filter((t) => t.status === "failed").length;

  const groups = projects
    .map((p) => {
      const items = visible.filter((t) => t.project_id === p.id);
      return items.length ? { project: p, items } : null;
    })
    .filter((g): g is { project: Project; items: SentTask[] } => g !== null);

  // Tâches dont le projet n'est plus dans la liste — jamais masquées.
  const known = new Set(projects.map((p) => p.id));
  const orphans = visible.filter((t) => !known.has(t.project_id));

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
                {f.key === "failed" && failedCount > 0 ? ` (${failedCount})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {failedCount > 0 && (
        <div className="flex-none px-[22px] pb-2">
          <button
            type="button"
            onClick={onRetryAll}
            disabled={retrying}
            className="flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-[rgba(192,96,60,0.35)] bg-accent-soft text-[13.5px] font-semibold text-accent-deep transition-all duration-200 disabled:opacity-60"
          >
            {retrying && (
              <span className="animate-br-spin block h-[15px] w-[15px] rounded-full border-2 border-[rgba(178,84,47,0.3)] border-t-accent-deep" />
            )}
            {retrying
              ? "Nouvel envoi…"
              : `Réessayer ${failedCount} tâche${failedCount > 1 ? "s" : ""} échouée${failedCount > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-1 pb-[18px]">
        {[...groups, ...(orphans.length ? [{ project: { id: "?", name: "Autre" }, items: orphans }] : [])].map(
          ({ project, items }) => {
            const skin = skinFor(project);
            return (
              <div key={project.id} className="mb-5">
                <div className="mx-1 mt-0 mb-[9px] flex items-center gap-2">
                  <span
                    className="inline-flex h-6 items-center rounded-lg px-[9px] text-[11.5px] font-semibold"
                    style={{ background: skin.bg, color: skin.fg }}
                  >
                    {project.name}
                  </span>
                  <span className="text-[11.5px] font-medium text-muted-2">
                    {items.length} {items.length > 1 ? "tâches" : "tâche"}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((t) => {
                    const failed = t.status === "failed";
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onOpen(t.id)}
                        className="w-full cursor-pointer rounded-[18px] border bg-card px-[15px] py-[13px] text-left shadow-[0_1px_4px_-3px_rgba(28,26,24,0.3)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_6px_16px_-12px_rgba(28,26,24,0.5)]"
                        style={{
                          borderColor: failed ? "rgba(192,96,60,0.35)" : "rgba(28,26,24,0.07)",
                        }}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="flex-1 text-[15px] leading-[1.4] font-medium text-pretty text-ink">
                            {t.content}
                          </span>
                          <span
                            className="mt-px flex-none text-[11px] font-semibold"
                            style={{ color: failed ? "#B2542F" : "#5A7A5E" }}
                          >
                            {failed ? "⚠ échec" : "✓ envoyée"}
                          </span>
                        </div>
                        <div className="mt-[7px] flex items-center gap-2">
                          <span className="text-[11.5px] font-medium text-muted">
                            {t.due_string || "Pas d'échéance"}
                          </span>
                          <span className="h-[3px] w-[3px] rounded-full bg-dot" />
                          <span
                            className="text-[11.5px] font-semibold"
                            style={{
                              color: PRIOS[t.priority].fg === "#1C1A18" ? "#8A8580" : PRIOS[t.priority].fg,
                            }}
                          >
                            {PRIOS[t.priority].label}
                          </span>
                        </div>
                        {failed && t.error && (
                          <p className="mt-2 mb-0 line-clamp-2 text-[11.5px] leading-[1.4] text-accent-deep">
                            {t.error}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          },
        )}

        {!visible.length && (
          <div className="px-5 py-16 text-center">
            <p className="m-0 text-sm leading-[1.5] font-medium text-muted-2">
              {sent.length ? "Rien dans ce filtre." : "Aucune tâche envoyée pour l'instant."}
              <br />
              {!sent.length && "Dicte une note pour commencer."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
