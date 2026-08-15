"use client";

import { useEffect, useRef, useState } from "react";
import { DoneBox } from "./DoneBox";
import { PlusIcon, ProjectDot, SearchIcon } from "./icons";
import { formatRelativeDue, resolveDue } from "@/lib/due";
import { PRIORITIES, shapeFor, skinFor } from "@/lib/projects";
import { groupItemsByTimeSections, sortItems, type TaskSort } from "@/lib/tasks";
import { zonedParts, zonedTime } from "@/lib/zoned";
import type { Project, Item, Priority } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "Tout" },
  { key: "task", label: "Tâches" },
  { key: "event", label: "Rendez-vous" },
] as const;

const SORT_OPTIONS: { key: TaskSort; label: string }[] = [
  { key: "project", label: "Projets" },
  { key: "urgency", label: "Urgence" },
  { key: "due", label: "Échéance" },
  { key: "priority", label: "Priorité" },
];

export type FilterKey = (typeof FILTERS)[number]["key"];

interface SwipeableTaskCardProps {
  item: Item;
  waiting: boolean;
  done: boolean;
  busy: boolean;
  showProjectBadge: boolean;
  project: Project;
  now: Date;
  onOpen: (id: string) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onPostponeTomorrow?: (id: string) => void;
}

function SwipeableTaskCard({
  item: t,
  waiting,
  done,
  busy,
  showProjectBadge,
  project: proj,
  now,
  onOpen,
  onToggleDone,
  onPostponeTomorrow,
}: SwipeableTaskCardProps) {
  const skin = skinFor(proj);
  const dueInfo = formatRelativeDue(t.due, t.allDay, now);
  const prio = PRIORITIES[t.priority];
  const isEvent = t.kind === "event";

  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (waiting) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;

    // Si le geste est plutôt vertical, on laisse le défilement naturel
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(offsetX) === 0) {
      return;
    }

    // Bounded drag resistance
    const clamped = Math.max(-100, Math.min(100, diffX));
    setOffsetX(clamped);
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (offsetX > 60) {
      // Swipe vers la droite : Toggle Done
      onToggleDone(t.id, !done);
    } else if (offsetX < -60 && onPostponeTomorrow) {
      // Swipe vers la gauche : Reporter à demain
      onPostponeTomorrow(t.id);
    }
    setOffsetX(0);
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-row">
      {/* Background action reveal indicators */}
      <div
        className="absolute inset-0 flex items-center justify-between px-4 rounded-row text-12 font-semibold transition-opacity"
        style={{
          background:
            offsetX > 0
              ? "var(--color-ok)"
              : offsetX < 0
                ? "var(--color-warn)"
                : "transparent",
          color: "white",
        }}
      >
        <span className="flex items-center gap-1.5 opacity-90">
          ✓ {done ? "Rouvrir" : "Fait"}
        </span>
        <span className="flex items-center gap-1.5 opacity-90">
          Demain ➔
        </span>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={
          "relative flex w-full items-start gap-3 rounded-row px-[15px] py-[13px] " +
          (swiping ? "" : "transition-transform duration-200 ") +
          (waiting ? "" : "border bg-tile shadow-[var(--e1)] hover:-translate-y-px")
        }
        style={{
          transform: `translateX(${offsetX}px)`,
          ...(waiting
            ? { border: "1.5px dashed var(--color-ink-3)", background: "transparent" }
            : { borderColor: "var(--line)" }),
        }}
      >
        {!waiting && (
          <span className="mt-[1px] ml-[9px] flex-none">
            <DoneBox
              done={done}
              busy={busy}
              label={done ? `Rouvrir « ${t.title} »` : `Marquer « ${t.title} » comme fait`}
              onToggle={() => onToggleDone(t.id, !done)}
            />
          </span>
        )}
        <button
          type="button"
          onClick={() => !waiting && Math.abs(offsetX) < 5 && onOpen(t.id)}
          disabled={waiting}
          className={
            "min-w-0 flex-1 border-none bg-transparent p-0 text-left " +
            (waiting ? "cursor-default" : "cursor-pointer")
          }
        >
          <div className="flex items-start gap-2.5">
            <span
              className={
                "flex-1 text-15 leading-[1.4] font-medium text-pretty " +
                (done ? "text-ink-3 line-through" : "text-ink")
              }
            >
              {t.title}
            </span>
            <span
              className="mt-px flex-none text-11 font-semibold"
              style={{
                color: waiting
                  ? "var(--color-ink-2)"
                  : done
                    ? "var(--color-ok)"
                    : "var(--color-ink-3)",
              }}
            >
              {waiting ? "en attente" : done ? "✓ fait" : isEvent ? "rendez-vous" : "tâche"}
            </span>
          </div>

          <div className="mt-[9px] flex flex-wrap items-center gap-2">
            {showProjectBadge && (
              <>
                <span
                  className="inline-flex h-5 items-center gap-1 rounded-chip px-1.5 text-11 font-semibold"
                  style={{ background: skin.bg, color: skin.fg }}
                >
                  <ProjectDot shape={shapeFor(proj)} />
                  {proj.name}
                </span>
                <span className="h-[3px] w-[3px] rounded-full bg-ink-3" />
              </>
            )}

            {/* Échéance naturelle stylisée */}
            {t.due ? (
              <span
                className="inline-flex h-5 items-center rounded-chip px-1.5 text-11 font-semibold"
                style={{
                  background: dueInfo.bg,
                  color: dueInfo.color,
                }}
              >
                {dueInfo.label}
              </span>
            ) : (
              <span className="text-11 font-medium text-ink-3">
                Pas d&apos;échéance
              </span>
            )}

            <span className="h-[3px] w-[3px] rounded-full bg-ink-3" />

            {/* Badge de priorité bento sobre */}
            <span
              className="inline-flex h-5 items-center rounded-chip px-1.5 text-11 font-semibold"
              style={{
                background: prio.bg,
                color: prio.fg,
              }}
            >
              {prio.label} · {prio.short}
            </span>
          </div>

          {t.rrule && (
            <p className="mt-2 mb-0 text-11 leading-[1.4] text-ink-3">
              se répète
            </p>
          )}
        </button>
      </div>
    </div>
  );
}

export function TasksScreen({
  sent,
  pending,
  projects,
  filter,
  onFilter,
  onOpen,
  onToggleDone,
  onQuickAdd,
  onPostponeTomorrow,
  busyId,
}: {
  sent: Item[];
  /** Dictées encore en file locale — visibles, mais jamais dites enregistrées. */
  pending: Item[];
  projects: Project[];
  filter: FilterKey;
  onFilter: (f: FilterKey) => void;
  onOpen: (id: string) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onQuickAdd?: (task: { title: string; projectId: string; due: string | null; allDay: boolean; priority: Priority }) => void;
  onPostponeTomorrow?: (id: string) => void;
  /** Item dont la coche attend le serveur — empêche le double appui. */
  busyId: string | null;
}) {
  const [sort, setSort] = useState<TaskSort>("project");
  const [showDone, setShowDone] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickProject, setQuickProject] = useState(projects[0]?.id || "frip-trend");
  const [quickDue, setQuickDue] = useState("aujourd'hui");
  const [quickPrio, setQuickPrio] = useState<Priority>(3);

  const quickInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickAddOpen) {
      quickInputRef.current?.focus();
    }
  }, [quickAddOpen]);

  // Les items en attente passent devant
  const all = [...pending, ...sent];

  const now = new Date();
  const nowParts = zonedParts(now);
  const startOfToday = zonedTime(nowParts.y, nowParts.m, nowParts.d, 0, 0);
  const startOfTomorrow = zonedTime(nowParts.y, nowParts.m, nowParts.d + 1, 0, 0);

  const activeItems = all.filter((t) => !t.doneAt);

  const overdueCount = activeItems.filter((t) => {
    if (!t.due) return false;
    const d = new Date(t.due);
    return !Number.isNaN(d.getTime()) && d < startOfToday;
  }).length;

  const todayCount = activeItems.filter((t) => {
    if (!t.due) return false;
    const d = new Date(t.due);
    return !Number.isNaN(d.getTime()) && d >= startOfToday && d < startOfTomorrow;
  }).length;

  // Filtrage par type, recherche et statut terminé
  const q = searchQuery.trim().toLowerCase();
  const projectsMap = new Map(projects.map((p) => [p.id, p]));

  const filtered = all.filter((t) => {
    if (filter !== "all" && t.kind !== filter) return false;
    if (!showDone && t.doneAt) return false;
    if (q) {
      const proj = projectsMap.get(t.projectId);
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchProject = proj ? proj.name.toLowerCase().includes(q) : false;
      if (!matchTitle && !matchProject) return false;
    }
    return true;
  });

  const sortedItems = sortItems(filtered, sort);

  const groups = projects
    .map((p) => {
      const items = sortedItems.filter((t) => t.projectId === p.id);
      return items.length ? { project: p, items } : null;
    })
    .filter((g): g is { project: Project; items: Item[] } => g !== null);

  const known = new Set(projects.map((p) => p.id));
  const orphans = sortedItems.filter((t) => !known.has(t.projectId));

  const totalDoneCount = all.filter((t) => !!t.doneAt).length;

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !onQuickAdd) return;
    const res = resolveDue(quickDue, now);
    onQuickAdd({
      title: quickTitle.trim(),
      projectId: quickProject,
      due: res ? res.due : null,
      allDay: res ? res.allDay : true,
      priority: quickPrio,
    });
    setQuickTitle("");
    setQuickAddOpen(false);
  };

  const renderCard = (t: Item, showProjectBadge: boolean) => {
    const proj: Project = projectsMap.get(t.projectId) || {
      id: t.projectId,
      name: "Autre",
      tint: 7 as const,
      shape: "disc" as const,
    };
    return (
      <SwipeableTaskCard
        key={t.id}
        item={t}
        waiting={!!t.pendingAt}
        done={!!t.doneAt}
        busy={busyId === t.id}
        showProjectBadge={showProjectBadge}
        project={proj}
        now={now}
        onOpen={onOpen}
        onToggleDone={onToggleDone}
        onPostponeTomorrow={onPostponeTomorrow}
      />
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-[26px] pt-2.5 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="my-0 text-27 font-bold tracking-tight text-ink">Tâches</h1>
          <div className="flex items-center gap-2">
            {totalDoneCount > 0 && (
              <button
                type="button"
                onClick={() => setShowDone(!showDone)}
                className="cursor-pointer border-none bg-transparent p-1 text-13 font-medium transition-colors"
                style={{ color: showDone ? "var(--color-action)" : "var(--color-ink-3)" }}
              >
                {showDone ? "Masquer faites" : `Faites (${totalDoneCount})`}
              </button>
            )}
            {onQuickAdd && (
              <button
                type="button"
                onClick={() => setQuickAddOpen(!quickAddOpen)}
                aria-label="Ajouter une tâche"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none text-white transition-transform active:scale-95"
                style={{ background: "var(--color-action)" }}
              >
                <PlusIcon size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Formulaire d'ajout rapide direct */}
        {quickAddOpen && (
          <form
            onSubmit={handleQuickSubmit}
            className="mb-3.5 rounded-row border bg-tile p-3 shadow-[var(--e1)]"
            style={{ borderColor: "var(--line)" }}
          >
            <input
              ref={quickInputRef}
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Nouvelle tâche ou note rapide..."
              className="w-full rounded-field border bg-page px-3 py-2 text-15 font-medium text-ink placeholder:text-ink-3 focus:outline-none"
              style={{ borderColor: "var(--line-2)" }}
            />
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Choix du projet */}
                <select
                  value={quickProject}
                  onChange={(e) => setQuickProject(e.target.value)}
                  className="h-7 cursor-pointer rounded-chip border bg-page px-2 text-11 font-semibold text-ink focus:outline-none"
                  style={{ borderColor: "var(--line-2)" }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {/* Échéance rapide */}
                <select
                  value={quickDue}
                  onChange={(e) => setQuickDue(e.target.value)}
                  className="h-7 cursor-pointer rounded-chip border bg-page px-2 text-11 font-semibold text-ink focus:outline-none"
                  style={{ borderColor: "var(--line-2)" }}
                >
                  <option value="aujourd'hui">Aujourd&apos;hui</option>
                  <option value="demain">Demain</option>
                  <option value="après-demain">Après-demain</option>
                  <option value="lundi">Lundi</option>
                  <option value="vendredi">Vendredi</option>
                  <option value="">Sans date</option>
                </select>

                {/* Priorité */}
                <select
                  value={quickPrio}
                  onChange={(e) => setQuickPrio(Number(e.target.value) as Priority)}
                  className="h-7 cursor-pointer rounded-chip border bg-page px-2 text-11 font-semibold text-ink focus:outline-none"
                  style={{ borderColor: "var(--line-2)" }}
                >
                  <option value={1}>p1 · Urgent</option>
                  <option value={2}>p2 · Élevé</option>
                  <option value={3}>p3 · Normal</option>
                  <option value={4}>p4 · Basse</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(false)}
                  className="h-7 cursor-pointer rounded-chip border-none bg-transparent px-2 text-12 font-medium text-ink-3"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!quickTitle.trim()}
                  className="h-7 cursor-pointer rounded-chip border-none px-3 text-12 font-semibold text-white transition-opacity disabled:opacity-40"
                  style={{ background: "var(--color-action)" }}
                >
                  Ajouter
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Barre de recherche instantanée */}
        <div className="mb-3 relative flex items-center">
          <span className="absolute left-3 text-ink-3 pointer-events-none">
            <SearchIcon size={14} />
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une tâche, un projet..."
            className="w-full rounded-field border bg-page py-1.5 pr-3 pl-8 text-13 font-medium text-ink placeholder:text-ink-3 focus:outline-none"
            style={{ borderColor: "var(--line-2)" }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 cursor-pointer border-none bg-transparent text-11 font-medium text-ink-3 hover:text-ink"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Synthèse compacte : badges Retard / Aujourd'hui */}
        {(overdueCount > 0 || todayCount > 0) && (
          <div className="mb-3 flex items-center gap-2">
            {overdueCount > 0 && (
              <div
                className="flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-11 font-semibold"
                style={{ background: "var(--color-action-lo)", color: "var(--color-error)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-error" />
                <span>{overdueCount} en retard</span>
              </div>
            )}
            {todayCount > 0 && (
              <div
                className="flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-11 font-semibold"
                style={{ background: "var(--color-p4)", color: "var(--color-warn)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                <span>{todayCount} aujourd&apos;hui</span>
              </div>
            )}
          </div>
        )}

        {pending.length > 0 && (
          <div
            className="mb-3 rounded-row px-3.5 py-2.5"
            style={{ border: "1.5px dashed var(--color-ink-3)" }}
            role="status"
          >
            <p className="m-0 text-13 leading-[1.45] font-semibold text-ink">
              {pending.length} note{pending.length > 1 ? "s" : ""} en attente d&apos;envoi
            </p>
            <p className="mt-1 mb-0 text-11 leading-[1.45] font-normal text-ink-2">
              Pas encore enregistrée{pending.length > 1 ? "s" : ""} sur le serveur. Ça repart à la
              prochaine ouverture avec du réseau.
            </p>
          </div>
        )}

        {/* Filtres de types */}
        <div className="flex gap-1 rounded-field bg-page p-1">
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilter(f.key)}
                aria-pressed={on}
                className="h-9 flex-1 cursor-pointer rounded-chip border-none text-13 font-semibold transition-all duration-200"
                style={{
                  background: on ? "var(--color-tile)" : "transparent",
                  color: on ? "var(--color-ink)" : "var(--color-ink-3)",
                  boxShadow: on ? "var(--e1)" : "none",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Options de tri */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto py-0.5 text-11 font-medium text-ink-3">
          <span className="flex-none pr-1">Tri :</span>
          {SORT_OPTIONS.map((opt) => {
            const active = sort === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSort(opt.key)}
                aria-pressed={active}
                className="h-7 flex-none cursor-pointer rounded-chip border-none px-2.5 text-11 font-semibold transition-all duration-150"
                style={{
                  background: active ? "var(--color-ink)" : "var(--color-page)",
                  color: active ? "var(--color-tile)" : "var(--color-ink-2)",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-1 pb-[18px]">
        {sort === "project" ? (
          <>
            {[
              ...groups,
              ...(orphans.length
                ? [{ project: { id: "?", name: "Autre", tint: 7 as const, shape: "disc" as const }, items: orphans }]
                : []),
            ].map(({ project, items }) => {
              const skin = skinFor(project);
              return (
                <div key={project.id} className="mb-5">
                  <div className="mx-1 mt-0 mb-[9px] flex items-center gap-2">
                    <span
                      className="inline-flex h-6 items-center gap-2 rounded-chip px-[9px] text-11 font-semibold"
                      style={{ background: skin.bg, color: skin.fg }}
                    >
                      <ProjectDot shape={shapeFor(project)} />
                      {project.name}
                    </span>
                    <span className="text-11 font-medium text-ink-3">
                      {items.length} {items.length > 1 ? "items" : "item"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((t) => renderCard(t, false))}
                  </div>
                </div>
              );
            })}
          </>
        ) : sort === "urgency" ? (
          /* Regroupement par sections temporelles en vue Urgence */
          <div className="flex flex-col gap-5">
            {groupItemsByTimeSections(sortedItems, now).map((section) => {
              const count = section.items.length;
              return (
                <div key={section.key}>
                  <div className="mx-1 mt-0 mb-[9px] flex items-center gap-2">
                    <span
                      className="text-12 font-semibold tracking-wide uppercase"
                      style={{
                        color:
                          section.tone === "overdue"
                            ? "var(--color-error)"
                            : section.tone === "today"
                              ? "var(--color-action)"
                              : section.tone === "tomorrow"
                                ? "var(--color-warn)"
                                : "var(--color-ink-2)",
                      }}
                    >
                      {section.label}
                    </span>
                    <span className="text-11 font-medium text-ink-3">
                      {count} {count > 1 ? "items" : "item"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {section.items.map((t) => renderCard(t, true))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedItems.map((t) => renderCard(t, true))}
          </div>
        )}

        {!sortedItems.length && (
          <div className="px-5 py-16 text-center">
            <p className="m-0 text-13 leading-[1.5] font-medium text-ink-3">
              {all.length
                ? searchQuery
                  ? "Aucune tâche ne correspond à votre recherche."
                  : "Aucun item pour ce filtre ou tri."
                : "Aucun item enregistré pour l'instant."}
              <br />
              {!all.length && "Dicte une note ou clique sur + pour commencer."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
