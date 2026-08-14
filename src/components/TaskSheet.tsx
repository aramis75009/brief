"use client";

import { useState } from "react";
import { DoneBox } from "./DoneBox";
import { ChevronDownIcon, ClockIcon, ProjectDot, TrashIcon } from "./icons";
import { formatDue, resolveDue } from "@/lib/due";
import {
  DUE_CLEAR,
  DUE_SUGGESTIONS,
  PRIORITIES,
  PRIORITY_VALUES,
  fallbackProjectId,
  shapeFor,
  skinFor,
} from "@/lib/projects";
import type { DraftItem, Item, Priority, Project } from "@/lib/types";

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
  onToggleDone,
  busy = false,
  onSave,
  saving,
}: {
  task: Item;
  projects: Project[];
  onClose: () => void;
  onDelete: () => void;
  onToggleDone: (done: boolean) => void;
  busy?: boolean;
  /** Applique un patch sur l'item enregistré. Le serveur persiste, renvoie l'item à jour. */
  onSave: (patch: Partial<DraftItem>) => void;
  saving: boolean;
}) {
  const project = projects.find((p) => p.id === task.projectId) ?? {
    id: task.projectId,
    name: "Projet inconnu",
  };
  const prio = PRIORITIES[task.priority];
  const done = !!task.doneAt;

  /**
   * Le projet à présélectionner dans le `<select>`.
   *
   * ⚠️ Un item dont le projet a été supprimé depuis Réglages n'a plus d'option
   * qui lui corresponde. Le select affichait alors le premier projet tout en
   * gardant l'identifiant mort dans `form`, et `sanitizePatch` le réécrivait
   * côté serveur en `fallbackProjectId()` : corriger le titre d'un item
   * orphelin le déplaçait donc de projet, sans un mot. On présélectionne le
   * projet de repli — celui-là même que le serveur choisirait — pour que ce
   * qui est affiché soit ce qui sera écrit.
   */
  const selectableProjectId = (id: string) =>
    projects.some((p) => p.id === id) ? id : fallbackProjectId(projects);

  const blank = () => ({
    title: task.title,
    kind: task.kind,
    projectId: selectableProjectId(task.projectId),
    due: task.due,
    allDay: task.allDay,
    priority: task.priority,
  });

  // Mode d'édition — on part de l'item réel, on ne travaille jamais sur un vide.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(blank);

  const startEdit = () => {
    setForm(blank());
    setEditing(true);
  };

  // En édition, la pastille suit le select : elle annonce où l'item ira, pas
  // d'où il vient.
  const shownProject = editing
    ? (projects.find((p) => p.id === form.projectId) ?? project)
    : project;
  const skin = skinFor(shownProject);

  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  const save = () => {
    if (!form.title.trim()) return;
    onSave({
      title: form.title.trim(),
      kind: form.kind,
      projectId: form.projectId,
      due: form.due,
      allDay: form.allDay,
      priority: form.priority,
    });
  };

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
          <ProjectDot shape={shapeFor(shownProject)} />
          {shownProject.name}
        </span>

        {editing ? (
          <>
            <input
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Intitulé"
              aria-label="Intitulé"
              // `border-none` posait `border-style: none` et annulait le
              // soulignement au focus, quelles que soient largeur et couleur.
              className="mt-3 w-full border-0 border-b border-solid border-b-transparent bg-transparent pb-[5px] text-21 leading-[1.3] font-semibold tracking-[-0.3px] text-ink outline-none transition-colors duration-200 focus:border-b-action"
            />

            <div className="mt-4 mb-5 flex flex-col gap-2.5">
              {/* Projet */}
              <span className="relative flex h-10 items-center gap-2 rounded-field bg-page px-3 text-13 font-semibold text-ink">
                <ProjectDot shape={shapeFor(projects.find((p) => p.id === form.projectId) ?? project)} />
                {projects.find((p) => p.id === form.projectId)?.name ?? "Projet"}
                <ChevronDownIcon className="ml-auto opacity-55" />
                <select
                  value={form.projectId}
                  onChange={(e) => patch({ projectId: e.target.value })}
                  aria-label="Projet"
                  className="absolute inset-0 h-full w-full cursor-pointer border-none opacity-0"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </span>

              {/* Nature */}
              <button
                type="button"
                onClick={() => patch({ kind: form.kind === "event" ? "task" : "event" })}
                aria-label={`Nature : ${form.kind === "event" ? "rendez-vous" : "tâche"}, appuyer pour changer`}
                className="flex h-10 cursor-pointer items-center rounded-field border border-[var(--line-2)] bg-page px-3 text-13 font-semibold text-ink-2 transition-colors duration-200 hover:bg-page"
              >
                {form.kind === "event" ? "Rendez-vous" : "Tâche"}
              </button>

              {/* Échéance */}
              <span className="relative flex h-10 items-center gap-2 rounded-field bg-page px-3 text-13 font-medium text-ink-2">
                <ClockIcon />
                {form.due ? formatDue(form.due, form.allDay) : "Pas d'échéance"}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value === DUE_CLEAR) {
                      patch({ due: null, allDay: true });
                      return;
                    }
                    const resolved = resolveDue(e.target.value);
                    patch({
                      due: resolved?.due ?? null,
                      allDay: resolved?.allDay ?? true,
                    });
                  }}
                  aria-label="Échéance"
                  className="absolute inset-0 h-full w-full cursor-pointer border-none opacity-0"
                >
                  {/* Aucune option ne porte `value=""` — voir DUE_CLEAR. */}
                  <option value={DUE_CLEAR}>Pas d&apos;échéance</option>
                  {DUE_SUGGESTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </span>

              {/* Priorité */}
              <span className="flex h-10 gap-[3px] rounded-field bg-page p-[3px]">
                {PRIORITY_VALUES.map((v: Priority) => {
                  const on = form.priority === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => patch({ priority: v })}
                      title={PRIORITIES[v].long}
                      aria-pressed={on}
                      className="flex-1 cursor-pointer rounded-[9px] border-none text-11 font-semibold transition-all duration-200"
                      style={{
                        background: on ? PRIORITIES[v].bg : "transparent",
                        color: on ? PRIORITIES[v].fg : "var(--color-ink-3)",
                        boxShadow: on ? "var(--e1)" : "none",
                      }}
                    >
                      {PRIORITIES[v].label}
                    </button>
                  );
                })}
              </span>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-[52px] flex-1 cursor-pointer rounded-[17px] border border-[var(--line-2)] bg-tile text-15 font-semibold text-ink-2 transition-all duration-200 hover:bg-page"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !form.title.trim()}
                className="h-[52px] flex-1 cursor-pointer rounded-[17px] border-none bg-ink text-15 font-semibold text-page transition-all duration-200 hover:bg-ink disabled:cursor-default disabled:bg-ink-3 disabled:text-page/60"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* La coche « fait » reste visible à la lecture — c'est l'action la
                plus fréquente de la fiche. En mode édition elle disparaît. */}
            <div className="mt-3 flex items-start gap-3">
              <span className="mt-[3px] ml-[9px] flex-none">
                <DoneBox
                  done={done}
                  busy={busy}
                  label={done ? "Rouvrir cette tâche" : "Marquer comme fait"}
                  onToggle={() => onToggleDone(!done)}
                />
              </span>
              <h3
                className={
                  "m-0 min-w-0 flex-1 text-21 leading-[1.3] font-semibold tracking-[-0.3px] text-pretty " +
                  (done ? "text-ink-3 line-through" : "text-ink")
                }
              >
                {task.title}
              </h3>
            </div>

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
                onClick={startEdit}
                className="h-[52px] flex-1 cursor-pointer rounded-[17px] border border-[var(--line-2)] bg-tile text-15 font-semibold text-ink transition-all duration-200 hover:bg-page"
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-[52px] flex-1 cursor-pointer rounded-[17px] border-none bg-ink text-15 font-semibold text-page transition-all duration-200 hover:bg-ink"
              >
                Fermer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
