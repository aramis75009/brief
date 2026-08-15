"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { ProjectDot } from "./icons";
import { formatRelativeDue } from "@/lib/due";
import { PRIORITIES, shapeFor } from "@/lib/projects";
import type { Overview, OverviewProject, OverviewStack } from "@/lib/types";

type Mode = "load" | "horizon";

const MODE_KEY = "brief:overview-mode";

const modeListeners = new Set<() => void>();
let modeCache: Mode | null = null;

function readMode(): Mode {
  if (modeCache !== null) return modeCache;
  try {
    modeCache = window.localStorage.getItem(MODE_KEY) === "horizon" ? "horizon" : "load";
  } catch {
    modeCache = "load";
  }
  return modeCache;
}

function subscribeMode(onChange: () => void): () => void {
  modeListeners.add(onChange);
  return () => {
    modeListeners.delete(onChange);
  };
}

function serverMode(): Mode {
  return "load";
}

function writeMode(m: Mode): void {
  modeCache = m;
  try {
    window.localStorage.setItem(MODE_KEY, m);
  } catch {
    /* ignore */
  }
  for (const l of modeListeners) l();
}

const CHART_H = 170;

function longDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tintVar(stack: { tint?: number }, ink = false): string {
  if (!stack.tint) return ink ? "var(--color-ink-3)" : "var(--line-2)";
  return ink ? `var(--color-p${stack.tint}-ink)` : `var(--color-p${stack.tint})`;
}

/* --- Barre de charge par projet ------------------------------------------ */

function ProjectLoadBar({ project, maxTotal }: { project: OverviewProject; maxTotal: number }) {
  const pct = (n: number) => `${(n / Math.max(1, project.total)) * 100}%`;
  const rest = project.total - project.overdue - project.today - project.week;

  const label =
    project.overdue > 0
      ? { text: `${project.overdue} en retard`, color: "var(--color-error)" }
      : project.today > 0
        ? { text: `${project.today} aujourd'hui`, color: "var(--color-action)" }
        : { text: `${project.total} ouvert${project.total > 1 ? "s" : ""}`, color: "var(--color-ink-3)" };

  return (
    <div className="rounded-row border bg-tile p-3.5 shadow-[var(--e1)]" style={{ borderColor: "var(--line)" }}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex-none" style={{ color: tintVar(project, true) }}>
          <ProjectDot shape={shapeFor(project)} />
        </span>
        <span className="text-15 font-semibold text-ink tracking-[-0.2px]">{project.name}</span>
        <span className="ml-auto text-12 font-semibold" style={{ color: label.color }}>
          {label.text}
        </span>
      </div>

      {/* Jauge segmentée */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-page gap-0.5">
        <div
          className="flex h-full gap-0.5"
          style={{ width: `${(project.total / Math.max(1, maxTotal)) * 100}%` }}
        >
          {project.overdue > 0 && (
            <span
              className="block rounded-full"
              title={`${project.overdue} en retard`}
              style={{ width: pct(project.overdue), background: "var(--color-error)" }}
            />
          )}
          {project.today > 0 && (
            <span
              className="block rounded-full"
              title={`${project.today} aujourd'hui`}
              style={{ width: pct(project.today), background: "var(--color-action)" }}
            />
          )}
          {project.week > 0 && (
            <span
              className="block rounded-full"
              title={`${project.week} cette semaine`}
              style={{ width: pct(project.week), background: tintVar(project) }}
            />
          )}
          {rest > 0 && <span className="block flex-1 rounded-full opacity-40" style={{ background: tintVar(project) }} />}
        </div>
      </div>
    </div>
  );
}

/* --- Horizon 7 jours interactif ------------------------------------------- */

function HorizonStack({ stacks, unit }: { stacks: OverviewStack[]; unit: number }) {
  if (!stacks.length) {
    return <span className="block rounded-full" style={{ height: 3, background: "var(--line-2)" }} />;
  }
  return (
    <>
      {stacks.map((s) => (
        <span
          key={s.projectId}
          className="block rounded-md"
          title={`${s.name} · ${s.count}`}
          style={{ height: Math.max(12, Math.round(s.count * unit)), background: tintVar(s) }}
        />
      ))}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-1 mt-5 mb-2.5 flex items-center gap-2">
      <span className="text-11 font-semibold tracking-[1.2px] text-ink-3 uppercase">{children}</span>
      <span className="h-px flex-1" style={{ background: "var(--line)" }} />
    </div>
  );
}

export function OverviewScreen({
  overview,
  loading,
  error,
  onRetry,
}: {
  overview: Overview | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onNavigateToTasks?: () => void;
}) {
  const mode = useSyncExternalStore(subscribeMode, readMode, serverMode);
  const pick = useCallback((m: Mode) => writeMode(m), []);

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const header = (subtitle: string) => (
    <div className="flex-none px-[26px] pt-2 pb-1">
      <h1 className="m-0 text-27 font-bold tracking-tight text-ink">Vision</h1>
      <p className="mt-0.5 mb-0 text-13 font-normal text-ink-2">{subtitle}</p>
    </div>
  );

  if (loading && !overview) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header("Analyse de ta charge…")}
        <div className="flex flex-1 items-center justify-center">
          <span className="animate-br-spin block h-6 w-6 rounded-full border-2 border-[var(--line-2)] border-t-action" />
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header("Charge indisponible")}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="m-0 text-15 leading-[1.5] font-medium text-ink-2">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="h-11 cursor-pointer rounded-full bg-action px-5 text-15 font-semibold text-white"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  const { totals, byProject, horizon, overdueStacks } = overview;

  if (!totals.open) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header(longDate(overview.generatedAt))}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-10 text-center">
          <p className="m-0 text-21 font-semibold tracking-[-0.3px]">Tout est propre ! 🎯</p>
          <p className="m-0 text-15 leading-[1.5] font-normal text-ink-2">
            Aucune tâche ouverte. Tes projets sont à jour.
          </p>
        </div>
      </div>
    );
  }

  // Tri des projets par pression réelle
  const sortedProjects = [...byProject].sort(
    (a, b) => b.overdue - a.overdue || b.today - a.today || b.total - a.total,
  );
  const maxTotal = Math.max(1, ...sortedProjects.map((p) => p.total));
  const topProject = sortedProjects[0];

  // Calcul du plan d'action prioritaire
  let actionTitle = "Tout roule pour aujourd'hui";
  let actionAdvice = "Aucune urgence critique détectée sur tes projets.";

  if (totals.overdue > 0 && topProject) {
    actionTitle = `Priorité : apurer ${topProject.name}`;
    actionAdvice = `Tu as ${totals.overdue} tâche${totals.overdue > 1 ? "s" : ""} en retard (dont ${topProject.overdue} sur ${topProject.name}). Traite-les en priorité.`;
  } else if (totals.today > 0) {
    actionTitle = `Objectif : ${totals.today} tâche${totals.today > 1 ? "s" : ""} aujourd'hui`;
    actionAdvice = "Aucun retard. Concentre-toi sur tes échéances du jour pour garder le rythme.";
  }

  // Jour sélectionné dans l'horizon (par défaut le jour le plus chargé ou aujourd'hui)
  const activeHorizonDay =
    horizon.find((d) => d.date === selectedDateKey) ||
    horizon.find((d) => d.isToday) ||
    horizon[0];

  const now = new Date();
  const overdueTotal = overdueStacks.reduce((n, s) => n + s.count, 0);
  const maxHorizonTotal = Math.max(1, overdueTotal, ...horizon.map((d) => d.total));
  const horizonUnit = CHART_H / maxHorizonTotal;

  const subtitle =
    mode === "load"
      ? `${longDate(overview.generatedAt)} · ${totals.open} tâche${totals.open > 1 ? "s" : ""} en cours`
      : `Planning sur 7 jours · ${horizon.reduce((n, d) => n + d.total, 0)} tâche${horizon.reduce((n, d) => n + d.total, 0) > 1 ? "s" : ""} planifiée${horizon.reduce((n, d) => n + d.total, 0) > 1 ? "s" : ""}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header(subtitle)}

      {/* Onglets Charge / Horizon */}
      <div className="flex-none px-[22px] pb-1">
        <div
          className="flex gap-1 rounded-chip p-1"
          role="tablist"
          aria-label="Représentation de la charge"
          style={{ background: "var(--line)" }}
        >
          {([
            ["load", "Charge"],
            ["horizon", "Horizon 7j"],
          ] as const).map(([key, label]) => {
            const on = mode === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => pick(key)}
                className="h-9 flex-1 cursor-pointer rounded-chip border-none text-13 font-semibold transition-all duration-200"
                style={{
                  background: on ? "var(--color-tile)" : "transparent",
                  color: on ? "var(--color-ink)" : "var(--color-ink-3)",
                  boxShadow: on ? "var(--e1)" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-2 pb-4">
        {mode === "load" ? (
          <>
            {/* Carte Bento de pilotage immédiat */}
            <div
              className="animate-br-in mb-4 rounded-tile px-5 pt-4 pb-4.5"
              style={{ background: "var(--color-ink)", color: "var(--color-page)" }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                <div>
                  <span className="text-11 font-semibold tracking-wider uppercase opacity-70">Focus du jour</span>
                  <h3 className="m-0 mt-0.5 text-17 font-semibold text-white">{actionTitle}</h3>
                </div>
                {totals.overdue > 0 ? (
                  <span className="rounded-full px-2.5 py-1 text-11 font-bold" style={{ background: "var(--color-error)", color: "white" }}>
                    {totals.overdue} RETARD{totals.overdue > 1 ? "S" : ""}
                  </span>
                ) : (
                  <span className="rounded-full px-2.5 py-1 text-11 font-bold" style={{ background: "var(--color-ok)", color: "white" }}>
                    À JOUR
                  </span>
                )}
              </div>

              <p className="mt-3 mb-0 text-13 leading-[1.45] font-normal opacity-85">
                {actionAdvice}
              </p>

              {/* Stat bar */}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                <div>
                  <span className="block text-11 opacity-65 font-medium">Aujourd&apos;hui</span>
                  <span className="text-17 font-semibold text-white">{totals.today}</span>
                </div>
                <div>
                  <span className="block text-11 opacity-65 font-medium">Cette semaine</span>
                  <span className="text-17 font-semibold text-white">{totals.week}</span>
                </div>
                <div>
                  <span className="block text-11 opacity-65 font-medium">Total en cours</span>
                  <span className="text-17 font-semibold text-white">{totals.open}</span>
                </div>
              </div>
            </div>

            <SectionLabel>Charge par projet</SectionLabel>

            <div className="flex flex-col gap-2.5">
              {sortedProjects.map((p) => (
                <ProjectLoadBar key={p.id} project={p} maxTotal={maxTotal} />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Graphique Horizon 7 jours interactif */}
            <div className="rounded-tile border bg-tile p-4 shadow-[var(--e1)] mb-4" style={{ borderColor: "var(--line)" }}>
              <div className="flex h-[200px] items-end gap-2.5">
                {/* Colonne Retard */}
                <div className="flex flex-none flex-col items-center gap-2">
                  <div
                    className="flex w-[32px] flex-col-reverse justify-start gap-0.5 overflow-hidden"
                    style={{ height: CHART_H }}
                  >
                    {overdueStacks.length ? (
                      overdueStacks.map((s, i) => (
                        <span
                          key={s.projectId}
                          className="block rounded-md"
                          title={`${s.name} · ${s.count}`}
                          style={{
                            height: Math.max(12, Math.round(s.count * horizonUnit)),
                            background: "var(--color-error)",
                            opacity: i === 0 ? 1 : Math.max(0.35, 0.85 - i * 0.25),
                          }}
                        />
                      ))
                    ) : (
                      <span className="block rounded-full" style={{ height: 3, background: "var(--line-2)" }} />
                    )}
                  </div>
                  <span
                    className="text-11 font-semibold"
                    style={{ color: overdueTotal ? "var(--color-error)" : "var(--color-ink-3)" }}
                  >
                    retard
                  </span>
                </div>

                <span className="block h-[180px] w-px flex-none" style={{ background: "var(--line-2)" }} />

                {/* Colonnes 7 jours */}
                <div className="flex h-[200px] flex-1 items-end gap-1.5">
                  {horizon.map((day) => {
                    const isSelected = activeHorizonDay?.date === day.date;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelectedDateKey(day.date)}
                        className="flex flex-1 flex-col items-center gap-2 cursor-pointer border-none bg-transparent p-0 transition-transform active:scale-95"
                      >
                        <div
                          className={
                            "flex w-full flex-col-reverse justify-start gap-0.5 overflow-hidden rounded-md transition-all " +
                            (isSelected ? "ring-2 ring-[var(--color-action)] ring-offset-1" : "")
                          }
                          style={{ height: CHART_H }}
                        >
                          <HorizonStack stacks={day.stacks} unit={horizonUnit} />
                        </div>
                        <span
                          className="text-11 font-semibold"
                          style={{
                            color: day.isToday
                              ? "var(--color-action)"
                              : isSelected
                                ? "var(--color-ink)"
                                : day.total
                                  ? "var(--color-ink-2)"
                                  : "var(--color-ink-3)",
                          }}
                        >
                          {day.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Détail du jour sélectionné */}
            {activeHorizonDay && (
              <>
                <SectionLabel>
                  {longDate(activeHorizonDay.date)}{" "}
                  {activeHorizonDay.isToday ? "(Aujourd'hui)" : ""} · {activeHorizonDay.total} item{activeHorizonDay.total > 1 ? "s" : ""}
                </SectionLabel>

                {activeHorizonDay.items && activeHorizonDay.items.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {activeHorizonDay.items.map((it) => {
                      const p = byProject.find((x) => x.id === it.projectId);
                      const dueInfo = formatRelativeDue(it.due, it.allDay, now);
                      const prio = PRIORITIES[it.priority];

                      return (
                        <div
                          key={it.id}
                          className="flex items-center gap-2.5 rounded-row border bg-tile px-3.5 py-3 shadow-[var(--e1)]"
                          style={{ borderColor: "var(--line)" }}
                        >
                          <span className="flex-none" style={{ color: tintVar(p ?? {}, true) }}>
                            <ProjectDot shape={shapeFor({ id: it.projectId, shape: p?.shape })} />
                          </span>
                          <span className="flex-1 text-14 font-medium text-ink">{it.title}</span>

                          <span
                            className="inline-flex h-5 items-center rounded-chip px-1.5 text-11 font-semibold"
                            style={{ background: dueInfo.bg, color: dueInfo.color }}
                          >
                            {dueInfo.label}
                          </span>

                          <span
                            className="inline-flex h-5 items-center rounded-chip px-1.5 text-11 font-semibold"
                            style={{ background: prio.bg, color: prio.fg }}
                          >
                            {prio.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-row border bg-page p-6 text-center text-13 font-medium text-ink-3" style={{ borderColor: "var(--line-2)" }}>
                    Aucune tâche planifiée pour ce jour.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
