"use client";

import { TrashIcon } from "./icons";
import { PRIOS, skinFor } from "@/lib/todoist";
import type { Project, SentTask } from "@/lib/types";

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-card px-[15px] py-[13px]">
      <span className="flex-none text-[13px] font-medium text-muted">{label}</span>
      <span
        className="text-right text-[13.5px] font-semibold break-words"
        style={{ color: color ?? "#1C1A18" }}
      >
        {value}
      </span>
    </div>
  );
}

export function TaskSheet({
  task,
  projects,
  retrying,
  onClose,
  onDelete,
  onRetry,
}: {
  task: SentTask;
  projects: Project[];
  retrying: boolean;
  onClose: () => void;
  onDelete: () => void;
  onRetry: () => void;
}) {
  const project = projects.find((p) => p.id === task.project_id) ?? {
    id: task.project_id,
    name: "Projet inconnu",
  };
  const skin = skinFor(project);
  const prio = PRIOS[task.priority];
  const failed = task.status === "failed";

  return (
    <div role="dialog" aria-modal="true" aria-label={task.content}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="animate-br-in absolute inset-0 cursor-pointer border-none bg-[rgba(28,26,24,0.4)]"
      />
      <div className="animate-br-sheet safe-bottom absolute right-0 bottom-0 left-0 rounded-t-[28px] bg-surface px-6 pt-2.5 pb-[26px] shadow-[0_-12px_40px_-16px_rgba(28,26,24,0.4)] sm:rounded-b-[44px]">
        <div className="mx-auto mb-4 h-1 w-[38px] rounded-[2px] bg-grip" />
        <span
          className="inline-flex h-[26px] items-center rounded-[9px] px-2.5 text-[11.5px] font-semibold"
          style={{ background: skin.bg, color: skin.fg }}
        >
          {project.name}
        </span>
        <h3 className="mt-3 mb-0 text-[21px] leading-[1.3] font-semibold tracking-[-0.3px] text-pretty text-ink">
          {task.content}
        </h3>

        <div className="mt-4 mb-5 flex flex-col gap-px overflow-hidden rounded-2xl bg-[rgba(28,26,24,0.07)]">
          <Row label="Échéance" value={task.due_string || "Pas d'échéance"} />
          <Row
            label="Priorité"
            value={prio.long}
            color={prio.fg === "#1C1A18" ? "#4A4640" : prio.fg}
          />
          <Row
            label="Statut"
            value={failed ? "Échec de l'envoi" : "Envoyée vers Todoist"}
            color={failed ? "#B2542F" : "#5A7A5E"}
          />
          {failed && task.error && <Row label="Détail" value={task.error} color="#B2542F" />}
          {!failed && task.todoistId && (
            <Row label="Identifiant" value={task.todoistId} color="#4A4640" />
          )}
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onDelete}
            title="Retirer de la liste"
            aria-label="Retirer de la liste"
            className="flex h-[52px] w-[54px] flex-none cursor-pointer items-center justify-center rounded-[17px] border border-[rgba(28,26,24,0.1)] bg-card text-accent transition-all duration-200 hover:bg-accent-soft"
          >
            <TrashIcon size={19} />
          </button>
          {failed ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="flex h-[52px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[17px] border-none bg-accent text-[15.5px] font-semibold text-white transition-all duration-200 disabled:opacity-60"
            >
              {retrying && (
                <span className="animate-br-spin block h-4 w-4 rounded-full border-2 border-[rgba(255,255,255,0.4)] border-t-white" />
              )}
              {retrying ? "Envoi…" : "Réessayer"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="h-[52px] flex-1 cursor-pointer rounded-[17px] border-none bg-ink text-[15.5px] font-semibold text-surface transition-all duration-200 hover:bg-ink-hover"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
