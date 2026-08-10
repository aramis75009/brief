"use client";

import { ProjectDot, TrashIcon } from "./icons";
import { formatDue } from "@/lib/due";
import { PRIORITIES, shapeFor, skinFor } from "@/lib/projects";
import type { Project, Item } from "@/lib/types";

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-tile px-[15px] py-[13px]">
      <span className="flex-none text-13 font-medium text-ink-2">{label}</span>
      <span
        className="text-right text-13 font-semibold break-words"
        style={{ color: color ?? "var(--color-ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function TaskSheet({
  task,
  projects,
  onClose,
  onDelete,
  }: {
  task: Item;
  projects: Project[];
  onClose: () => void;
  onDelete: () => void;
}) {
  const project = projects.find((p) => p.id === task.projectId) ?? {
    id: task.projectId,
    name: "Projet inconnu",
  };
  const skin = skinFor(project);
  const prio = PRIORITIES[task.priority];
  const done = !!task.doneAt;

  return (
    <div role="dialog" aria-modal="true" aria-label={task.title}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="animate-br-in absolute inset-0 cursor-pointer border-none bg-[rgba(19,18,17,0.45)]"
      />
      <div className="animate-br-sheet safe-bottom absolute right-0 bottom-0 left-0 rounded-t-[28px] bg-tile px-6 pt-2.5 pb-[26px] shadow-[var(--e2)] sm:rounded-b-[44px]">
        <div className="mx-auto mb-4 h-1 w-[38px] rounded-[2px] bg-ink-3" />
        <span
          className="inline-flex h-[26px] items-center gap-2 rounded-[9px] px-2.5 text-11 font-semibold"
          style={{ background: skin.bg, color: skin.fg }}
        >
          <ProjectDot shape={shapeFor(project)} />
          {project.name}
        </span>
        <h3 className="mt-3 mb-0 text-21 leading-[1.3] font-semibold tracking-[-0.3px] text-pretty text-ink">
          {task.title}
        </h3>

        <div className="mt-4 mb-5 flex flex-col gap-px overflow-hidden rounded-row bg-[var(--line)]">
          <Row label="Échéance" value={formatDue(task.due, task.allDay)} />
          <Row
            label="Priorité"
            value={prio.long}
            color={prio.fg === "var(--color-ink)" ? "var(--color-ink-2)" : prio.fg}
          />
          <Row
            label="Nature"
            value={task.kind === "event" ? "Rendez-vous" : "Tâche"}
            color="var(--color-ink-2)"
          />
          <Row
            label="Statut"
            value={done ? "Fait" : "À faire"}
            color={done ? "var(--color-ok)" : "var(--color-ink-2)"}
          />
          {task.rrule && <Row label="Récurrence" value={task.rrule} color="var(--color-ink-2)" />}
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onDelete}
            title="Retirer de la liste"
            aria-label="Retirer de la liste"
            className="flex h-[52px] w-[54px] flex-none cursor-pointer items-center justify-center rounded-[17px] border border-[var(--line-2)] bg-tile text-action transition-all duration-200 hover:bg-action-lo"
          >
            <TrashIcon size={19} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-[52px] flex-1 cursor-pointer rounded-[17px] border-none bg-ink text-15 font-semibold text-page transition-all duration-200 hover:bg-ink"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
