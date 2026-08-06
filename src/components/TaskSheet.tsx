"use client";

import { TrashIcon } from "./icons";
import { PRIOS, fmtDate, iso, projectById } from "@/lib/mock";
import { toQuickAdd } from "@/lib/parse";
import type { SentTask } from "@/lib/types";

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between bg-card px-[15px] py-[13px]">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <span className="text-[13.5px] font-semibold" style={{ color: color ?? "#1C1A18" }}>
        {value}
      </span>
    </div>
  );
}

export function TaskSheet({
  task,
  onClose,
  onDelete,
}: {
  task: SentTask;
  onClose: () => void;
  onDelete: () => void;
}) {
  const p = projectById(task.projectId);
  const today = iso(new Date());
  const overdue = !!task.dueISO && task.dueISO < today;
  const prio = PRIOS[task.prio];

  return (
    <div role="dialog" aria-modal="true" aria-label={task.title}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="animate-br-in absolute inset-0 cursor-pointer border-none bg-[rgba(28,26,24,0.4)]"
      />
      <div className="animate-br-sheet absolute right-0 bottom-0 left-0 rounded-t-[28px] rounded-b-[28px] bg-surface px-6 pt-2.5 pb-[26px] shadow-[0_-12px_40px_-16px_rgba(28,26,24,0.4)] sm:rounded-b-[44px]">
        <div className="mx-auto mb-4 h-1 w-[38px] rounded-[2px] bg-grip" />
        <span
          className="inline-flex h-[26px] items-center rounded-[9px] px-2.5 text-[11.5px] font-semibold"
          style={{ background: p.bg, color: p.fg }}
        >
          {p.name}
        </span>
        <h3 className="mt-3 mb-0 text-[21px] leading-[1.3] font-semibold tracking-[-0.3px] text-pretty text-ink">
          {task.title}
        </h3>
        <p className="mt-3 mb-0 rounded-xl bg-stone-2 px-3 py-2.5 font-mono text-xs leading-[1.6] break-words text-[#6B6560]">
          {toQuickAdd(task)}
        </p>

        <div className="mt-4 mb-5 flex flex-col gap-px overflow-hidden rounded-2xl bg-[rgba(28,26,24,0.07)]">
          <Row
            label="Échéance"
            value={task.dueISO ? `${task.dueText || ""} · ${fmtDate(task.dueISO)}` : "Pas d'échéance"}
            color={overdue ? "#C0603C" : "#1C1A18"}
          />
          <Row
            label="Priorité"
            value={prio.long}
            color={prio.fg === "#1C1A18" ? "#4A4640" : prio.fg}
          />
          <Row
            label="Synchronisation"
            value={task.sync === "synced" ? "Synchronisé" : "En attente"}
            color={task.sync === "synced" ? "#5A7A5E" : "#A8792F"}
          />
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onDelete}
            title="Supprimer"
            aria-label="Supprimer la tâche"
            className="flex h-[52px] w-[54px] flex-none cursor-pointer items-center justify-center rounded-[17px] border border-[rgba(28,26,24,0.1)] bg-card text-accent transition-all duration-200 hover:bg-accent-soft"
          >
            <TrashIcon size={19} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-[52px] flex-1 cursor-pointer rounded-[17px] border-none bg-ink text-[15.5px] font-semibold text-surface transition-all duration-200 hover:bg-ink-hover"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
