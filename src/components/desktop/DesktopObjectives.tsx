"use client";

/**
 * Écran Objectifs desktop (spec Aramis 29/08).
 *
 * Objectifs regroupés par projet, triés par horizon (court → moyen → long).
 * Chaque objectif montre sa progression (tâches liées faites/total) et les
 * tâches à faire, et se déplie pour être modifié (titre, horizon, notes).
 * Création inline par projet. La logique (progression, regroupement, tri) vit
 * dans `@/lib/objectives`, testée sans DOM.
 */

import { useMemo, useState } from "react";
import { CheckIcon, CloseIcon } from "../icons";
import { skinFor, shapeFor } from "@/lib/projects";
import {
  HORIZONS,
  HORIZON_LABEL,
  objectiveSatisfied,
  objectivesByProject,
  openTasksFor,
} from "@/lib/objectives";
import { compareByDue, formatDue } from "@/lib/due";
import type { Item, Objective, ObjectiveHorizon, Project } from "@/lib/types";

const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  danger: "var(--color-danger)",
  task100: "var(--color-task-100)",
  task700: "var(--color-task-700)",
} as const;

function ProjectSwatch({ project, size = 12 }: { project: Project; size?: number }) {
  const skin = skinFor(project);
  const shape = shapeFor(project);
  const base: React.CSSProperties = {
    width: size,
    height: size,
    flex: "none",
    display: "inline-block",
    background: skin.bg,
  };
  if (shape === "square") return <span style={{ ...base, borderRadius: 2 }} />;
  if (shape === "diamond")
    return <span style={{ ...base, width: size - 1, height: size - 1, borderRadius: 2, transform: "rotate(45deg)" }} />;
  if (shape === "ring")
    return <span style={{ ...base, background: "transparent", border: `2px solid ${skin.bg}`, borderRadius: 99 }} />;
  if (shape === "capsule") return <span style={{ ...base, width: size + 4, height: size - 2, borderRadius: 99 }} />;
  return <span style={{ ...base, borderRadius: 99 }} />;
}

/** État du formulaire de création inline — un brouillon par projet max. */
type Draft = { projectId: string; title: string; horizon: ObjectiveHorizon } | null;

/** Brouillon d'édition d'un objectif existant. */
type EditDraft = { title: string; horizon: ObjectiveHorizon; notes: string } | null;

/** Sélecteur d'horizon segmenté — partagé création / édition. */
function HorizonPicker({
  value,
  onChange,
}: {
  value: ObjectiveHorizon;
  onChange: (h: ObjectiveHorizon) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {HORIZONS.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onChange(h)}
          style={{
            padding: "6px 13px",
            borderRadius: 99,
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 700,
            background: value === h ? C.ink : C.bg,
            color: value === h ? "#fff" : C.inkMuted,
          }}
        >
          {HORIZON_LABEL[h]}
        </button>
      ))}
    </div>
  );
}

export function DesktopObjectives({
  objectives,
  items,
  projects,
  onOpenTask,
  onToggleDone,
  onCreateObjective,
  onAchieveObjective,
  onDeleteObjective,
  onEditObjective,
  onReopenObjective,
}: {
  objectives: Objective[];
  items: Item[];
  projects: Project[];
  onOpenTask: (id: string) => void;
  onToggleDone: (id: string) => void;
  onCreateObjective: (title: string, projectId: string, horizon: ObjectiveHorizon) => Promise<void>;
  onAchieveObjective: (id: string) => Promise<void>;
  onDeleteObjective: (id: string) => Promise<void>;
  onEditObjective: (id: string, patch: { title?: string; horizon?: ObjectiveHorizon; notes?: string }) => Promise<void>;
  onReopenObjective: (id: string) => Promise<void>;
}) {
  const groups = useMemo(() => objectivesByProject(objectives, projects, items), [objectives, projects, items]);
  const [draft, setDraft] = useState<Draft>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>(null);
  const [showAchieved, setShowAchieved] = useState(false);

  const activeCount = useMemo(() => objectives.filter((o) => !o.achievedAt).length, [objectives]);
  const achieved = useMemo(() => objectives.filter((o) => o.achievedAt), [objectives]);
  const achievedCount = achieved.length;

  function startEdit(o: Objective) {
    setEditingId(o.id);
    setEditDraft({ title: o.title, horizon: o.horizon, notes: o.notes ?? "" });
  }

  async function submitEdit(id: string) {
    if (!editDraft || !editDraft.title.trim() || busy) return;
    setBusy(true);
    try {
      await onEditObjective(id, {
        title: editDraft.title.trim(),
        horizon: editDraft.horizon,
        notes: editDraft.notes.trim(),
      });
      setEditingId(null);
      setEditDraft(null);
    } finally {
      setBusy(false);
    }
  }

  async function submitDraft() {
    if (!draft || !draft.title.trim() || busy) return;
    setBusy(true);
    try {
      await onCreateObjective(draft.title.trim(), draft.projectId, draft.horizon);
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4" style={{ animation: "fade .3s both" }}>
      {/* En-tête */}
      <section
        className="flex flex-none items-center justify-between"
        style={{
          padding: "18px 24px",
          background: C.surface,
          border: "1px solid rgba(16,16,16,.06)",
          borderRadius: 24,
          boxShadow: "0 6px 20px rgba(16,16,16,.07)",
        }}
      >
        <div className="flex flex-col gap-1">
          <h1 className="font-extrabold tracking-[-0.03em]" style={{ fontSize: 24, lineHeight: 1.1, margin: 0 }}>
            Objectifs
          </h1>
          <span className="text-[13px] font-medium" style={{ color: C.inkMuted }}>
            {activeCount === 0
              ? "Aucun objectif actif — crée le premier ci-dessous."
              : `${activeCount} objectif${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""}${achievedCount ? ` · ${achievedCount} atteint${achievedCount > 1 ? "s" : ""}` : ""}`}
          </span>
        </div>
        {achievedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAchieved((v) => !v)}
            aria-pressed={showAchieved}
            className="text-[11px] font-bold"
            style={{
              padding: "5px 12px",
              borderRadius: 99,
              border: `1px solid ${showAchieved ? C.ink : "rgba(16,16,16,.12)"}`,
              background: showAchieved ? C.ink : C.surface,
              color: showAchieved ? "#fff" : C.inkMuted,
              cursor: "pointer",
              fontFamily: "inherit",
              flex: "none",
            }}
          >
            {achievedCount} atteint{achievedCount > 1 ? "s" : ""}
          </button>
        )}
      </section>

      {/* Corps : une carte par projet qui a des objectifs ou un brouillon ouvert */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {groups.map(({ project, rows }) => (
          <section
            key={project.id}
            style={{
              padding: 20,
              background: C.surface,
              border: "1px solid rgba(16,16,16,.06)",
              borderRadius: 24,
              boxShadow: "0 6px 20px rgba(16,16,16,.07)",
            }}
          >
            <div className="flex items-center gap-2.5" style={{ marginBottom: 14 }}>
              <ProjectSwatch project={project} />
              <span className="font-bold tracking-[-0.02em]" style={{ fontSize: 17 }}>{project.name}</span>
              <span className="text-[12px] font-semibold" style={{ color: C.inkMuted }}>
                {rows.length} objectif{rows.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {rows.map(({ objective, progress }) => {
                const open = openTasksFor(objective, items, objectives).sort(compareByDue).slice(0, 5);
                return (
                  <div
                    key={objective.id}
                    style={{
                      padding: 14,
                      background: C.bg,
                      borderRadius: 18,
                      border: "1px solid rgba(16,16,16,.04)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Pastille horizon */}
                      <span
                        className="text-[11px] font-bold"
                        style={{
                          padding: "3px 10px",
                          borderRadius: 99,
                          background: skinFor(project).bg,
                          color: skinFor(project).fg,
                          flex: "none",
                        }}
                      >
                        {HORIZON_LABEL[objective.horizon]}
                      </span>
                      <button
                        onClick={() => (editingId === objective.id ? setEditingId(null) : startEdit(objective))}
                        className="min-w-0 flex-1 truncate text-left text-[14px] font-semibold tracking-[-0.01em]"
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", color: C.ink }}
                        title="Modifier cet objectif"
                      >
                        {objective.title}
                      </button>
                      {/* Progression */}
                      <span className="tnum flex-none text-[12px] font-bold" style={{ color: C.inkMuted }}>
                        {progress.done}/{progress.total}
                      </span>
                      <div className="flex-none" style={{ width: 90, height: 7, borderRadius: 99, background: "rgba(16,16,16,.07)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${progress.pct}%`,
                            borderRadius: 99,
                            background: skinFor(project).bg,
                            transition: "width .3s",
                          }}
                        />
                      </div>
                      {/* Modifier */}
                      <button
                        onClick={() => (editingId === objective.id ? setEditingId(null) : startEdit(objective))}
                        aria-label={`Modifier « ${objective.title} »`}
                        aria-expanded={editingId === objective.id}
                        title="Modifier"
                        className="flex items-center justify-center text-[13px] font-bold"
                        style={{ width: 26, height: 26, borderRadius: 99, border: "none", background: editingId === objective.id ? C.ink : "transparent", cursor: "pointer", color: editingId === objective.id ? "#fff" : C.inkFaint, flex: "none" }}
                      >
                        ✎
                      </button>
                      {/* Atteint */}
                      <button
                        onClick={() => onAchieveObjective(objective.id)}
                        aria-label={`Marquer « ${objective.title} » atteint`}
                        title="Marquer atteint"
                        className="flex items-center justify-center"
                        style={{ width: 26, height: 26, borderRadius: 99, border: `2px solid ${skinFor(project).bg}`, background: "transparent", cursor: "pointer", flex: "none", color: skinFor(project).bg }}
                      >
                        <CheckIcon size={13} />
                      </button>
                      {/* Supprimer */}
                      <button
                        onClick={() => onDeleteObjective(objective.id)}
                        aria-label={`Supprimer « ${objective.title} »`}
                        title="Supprimer"
                        className="flex items-center justify-center"
                        style={{ width: 26, height: 26, borderRadius: 99, border: "none", background: "transparent", cursor: "pointer", color: C.inkFaint, flex: "none" }}
                      >
                        <CloseIcon size={13} />
                      </button>
                    </div>

                    {/* Éditeur déplié */}
                    {editingId === objective.id && editDraft && (
                      <div className="flex flex-col gap-3" style={{ marginTop: 12, padding: 14, background: C.surface, borderRadius: 14, border: "1px solid rgba(16,16,16,.06)" }}>
                        <input
                          autoFocus
                          value={editDraft.title}
                          onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void submitEdit(objective.id);
                            if (e.key === "Escape") { setEditingId(null); setEditDraft(null); }
                          }}
                          maxLength={80}
                          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(16,16,16,.1)", background: C.bg, fontFamily: "inherit", fontSize: 14, fontWeight: 600, outline: "none" }}
                        />
                        <HorizonPicker value={editDraft.horizon} onChange={(h) => setEditDraft({ ...editDraft, horizon: h })} />
                        <textarea
                          value={editDraft.notes}
                          onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                          placeholder="Notes (optionnel)"
                          maxLength={500}
                          rows={2}
                          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(16,16,16,.1)", background: C.bg, fontFamily: "inherit", fontSize: 13, fontWeight: 500, outline: "none", resize: "vertical" }}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditingId(null); setEditDraft(null); }}
                            style={{ padding: "8px 14px", borderRadius: 99, border: "none", background: C.bg, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: C.inkMuted }}
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => void submitEdit(objective.id)}
                            disabled={!editDraft.title.trim() || busy}
                            style={{ padding: "8px 16px", borderRadius: 99, border: "none", background: C.ink, color: "#fff", cursor: editDraft.title.trim() && !busy ? "pointer" : "default", opacity: editDraft.title.trim() && !busy ? 1 : 0.4, fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}
                          >
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Tâches à faire pour cet objectif */}
                    {open.length > 0 && (
                      <div className="flex flex-col gap-1" style={{ marginTop: 10, paddingLeft: 12 }}>
                        {open.map((it) => (
                          <div key={it.id} className="flex items-center gap-2.5">
                            <button
                              onClick={() => onToggleDone(it.id)}
                              aria-label={`Marquer « ${it.title} » faite`}
                              style={{ width: 18, height: 18, borderRadius: 99, border: "1.5px solid rgba(16,16,16,.22)", background: C.surface, cursor: "pointer", flex: "none" }}
                            />
                            <button
                              onClick={() => onOpenTask(it.id)}
                              className="min-w-0 flex-1 truncate text-left text-[13px] font-medium"
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", color: C.ink }}
                            >
                              {it.title}
                            </button>
                            <span className="tnum flex-none text-[11px] font-semibold" style={{ color: C.inkMuted }}>
                              {formatDue(it.due, it.allDay) ?? "sans date"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Création — sélecteur de projet + titre + horizon */}
        <section
          style={{
            padding: 20,
            background: C.surface,
            border: "1px dashed rgba(16,16,16,.14)",
            borderRadius: 24,
          }}
        >
          {draft === null ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold" style={{ color: C.inkMuted }}>Nouvel objectif dans</span>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDraft({ projectId: p.id, title: "", horizon: "moyen" })}
                  className="flex items-center gap-2"
                  style={{
                    padding: "7px 14px",
                    borderRadius: 99,
                    border: "1px solid rgba(16,16,16,.08)",
                    background: C.bg,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <ProjectSwatch project={p} size={9} />
                  {p.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <ProjectSwatch project={projects.find((p) => p.id === draft.projectId)!} />
                <span className="text-[13px] font-bold">{projects.find((p) => p.id === draft.projectId)?.name}</span>
              </div>
              <input
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitDraft();
                  if (e.key === "Escape") setDraft(null);
                }}
                placeholder="Ex. Rejoindre la Web@cadémie"
                maxLength={80}
                style={{
                  padding: "11px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(16,16,16,.1)",
                  background: C.bg,
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  outline: "none",
                }}
              />
              <div className="flex items-center gap-2">
                <HorizonPicker value={draft.horizon} onChange={(h) => setDraft({ ...draft, horizon: h })} />
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setDraft(null)}
                    style={{ padding: "8px 14px", borderRadius: 99, border: "none", background: C.bg, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: C.inkMuted }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => void submitDraft()}
                    disabled={!draft.title.trim() || busy}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 99,
                      border: "none",
                      background: C.ink,
                      color: "#fff",
                      cursor: draft.title.trim() && !busy ? "pointer" : "default",
                      opacity: draft.title.trim() && !busy ? 1 : 0.4,
                      fontFamily: "inherit",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Créer
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {showAchieved && achieved.length > 0 && (
          <section style={{ padding: 20, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24 }}>
            <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: C.inkFaint }}>
              Objectifs atteints
            </span>
            <div className="flex flex-col gap-2" style={{ marginTop: 12 }}>
              {achieved.map((o) => {
                const p = projects.find((pr) => pr.id === o.projectId);
                // Un objectif encore « satisfait » (toutes ses tâches faites) se
                // referme aussitôt si on le rouvre — le bouton paraîtrait mort.
                // On propose alors « décoche une tâche » plutôt qu'un no-op.
                const stillSatisfied = objectiveSatisfied(o, items, objectives);
                return (
                  <div key={o.id} className="flex items-center gap-3" style={{ padding: 12, background: C.bg, borderRadius: 14 }}>
                    {p && <ProjectSwatch project={p} size={10} />}
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: C.inkMuted, textDecoration: "line-through" }}>
                      {o.title}
                    </span>
                    {stillSatisfied ? (
                      <span className="text-[11px] font-semibold" style={{ color: C.inkFaint, flex: "none" }}>
                        toutes les tâches sont faites
                      </span>
                    ) : (
                      <button
                        onClick={() => onReopenObjective(o.id)}
                        className="text-[11px] font-bold"
                        style={{ padding: "6px 12px", borderRadius: 99, border: "1px solid rgba(16,16,16,.12)", background: C.surface, color: C.ink, cursor: "pointer", fontFamily: "inherit", flex: "none" }}
                      >
                        Rouvrir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {groups.length === 0 && draft === null && (
          <div className="flex flex-col items-center gap-2" style={{ padding: "40px 0" }}>
            <span className="text-[14px] font-semibold" style={{ color: C.inkMuted }}>
              Aucun objectif pour l’instant.
            </span>
            <span className="text-[12px] font-medium" style={{ color: C.inkFaint }}>
              Choisis un projet ci-dessus pour poser le premier.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
