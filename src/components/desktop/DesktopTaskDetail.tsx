"use client";

/**
 * Fiche de détail d'une tâche — version desktop.
 * Reprend l'écran mobile (TaskDetailScreen) avec une mise en page adaptée :
 * plein écran, pas coincé dans un panneau latéral de calendrier.
 */

import { useCallback, useRef, useState } from "react";
import { Chip } from "../Chip";
import { TypeSegmented } from "../TypeSegmented";
import { WaveformStatic } from "../Waveform";
import {
  ChevronLeftIcon,
  EditIcon,
  CheckIcon,
  CloseIcon,
  PlayIcon,
  ChevronRightIcon,
  ClockIcon,
} from "../icons";
import { isoToLocalInputValue, localInputToIso } from "@/lib/due";
import { itemType, type ItemType } from "@/lib/item-type";
import { apiFetch } from "@/lib/pin";
import { skinFor, shapeFor } from "@/lib/projects";
import { TIMEZONE } from "@/lib/zoned";
import type { DraftItem, Item, Project } from "@/lib/types";

const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  danger: "var(--color-danger)",
} as const;

type EditDraft = {
  title: string;
  type: ItemType;
  projectId: string;
  dueLocal: string;
  notes: string;
};

function draftFrom(item: Item): EditDraft {
  return {
    title: item.title,
    type: itemType(item),
    projectId: item.projectId,
    dueLocal: isoToLocalInputValue(item.due),
    notes: item.notes ?? "",
  };
}

export function DesktopTaskDetail({
  item,
  projects,
  onBack,
  onDone,
  onPostpone,
  onDelete,
  onToggleSub,
  onOpenSibling,
  onSave,
}: {
  item: Item | null;
  projects: Project[];
  onBack: () => void;
  onDone: (id: string) => void;
  onPostpone: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSub?: (itemId: string, subId: string) => void;
  onOpenSibling?: (id: string) => void;
  onSave: (id: string, patch: Partial<DraftItem>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft>(() =>
    item ? draftFrom(item) : { title: "", type: "task", projectId: "", dueLocal: "", notes: "" },
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayAudio = useCallback(async () => {
    if (!item?.audioId) return;
    try {
      const res = await apiFetch(`/api/audio/${encodeURIComponent(item.audioId)}`);
      if (!res.ok) return;
      const blob = await res.blob();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; };
      void audio.play();
    } catch { /* silencieux */ }
  }, [item?.audioId]);

  const beginEdit = () => {
    if (!item) return;
    setDraft(draftFrom(item));
    setFormError(null);
    setEditing(true);
  };

  const cancelEdit = () => { setFormError(null); setEditing(false); };

  const saveEdit = async () => {
    if (!item) return;
    const title = draft.title.trim();
    if (!title) { setFormError("Le titre ne peut pas être vide."); return; }
    if (draft.type === "event" && !draft.dueLocal) { setFormError("Un rendez-vous a besoin d'une date et d'une heure."); return; }
    setFormError(null);
    setSaving(true);
    const due = draft.type === "idea" ? null : draft.dueLocal ? localInputToIso(draft.dueLocal) : null;
    const ok = await onSave(item.id, {
      title,
      kind: draft.type === "idea" ? item.kind : draft.type,
      status: draft.type === "idea" ? "idea" : "active",
      projectId: draft.projectId,
      due,
      allDay: due === null,
      notes: draft.notes.trim() || undefined,
    });
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4" style={{ animation: "fade .25s both" }}>
        <p className="text-[15px] font-medium" style={{ color: C.inkMuted }}>Item introuvable.</p>
        <button onClick={onBack} style={{ padding: "10px 20px", background: C.ink, color: "#fff", border: "none", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700 }}>Retour</button>
      </div>
    );
  }

  const project = projects.find((p) => p.id === item.projectId);
  const isDone = !!item.doneAt;
  const subs = item.subtasks || [];
  const doneSubs = subs.filter((s) => s.done).length;
  const subPct = subs.length > 0 ? Math.round((doneSubs / subs.length) * 100) : 0;

  const dueLabel = item.due
    ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE }).format(new Date(item.due)).replace(":", "h")
    : "Sans échéance";

  const audio = item.audioOrigin;
  const currentType = itemType(item);
  const chipVariant = currentType === "event" ? "meet" : currentType;
  const skin = project ? skinFor(project) : null;
  const shape = project ? shapeFor(project) : "disc";

  return (
    <div className="flex h-full overflow-hidden" style={{ animation: "fade .25s both" }}>
      {/* Colonne principale — la fiche */}
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto" style={{ maxWidth: 640, padding: "24px 32px" }}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            aria-label={editing ? "Annuler" : "Retour"}
            onClick={editing ? cancelEdit : onBack}
            className="flex items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 99, border: "1px solid rgba(16,16,16,.08)", background: C.surface, cursor: "pointer" }}
          >
            {editing ? <CloseIcon size={16} /> : <ChevronLeftIcon size={18} />}
          </button>
          {editing ? (
            <button
              onClick={() => void saveEdit()}
              disabled={saving}
              style={{ padding: "10px 22px", background: C.ink, color: "#fff", border: "none", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          ) : (
            <button
              aria-label="Modifier"
              onClick={beginEdit}
              className="flex items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 99, border: "1px solid rgba(16,16,16,.08)", background: C.surface, cursor: "pointer" }}
            >
              <EditIcon size={17} />
            </button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-4">
            <TypeSegmented value={draft.type} onChange={(t) => setDraft((d) => ({ ...d, type: t }))} />
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Titre"
              aria-label="Titre"
              style={{ padding: "14px 18px", background: C.surface, border: "1px solid rgba(16,16,16,.12)", borderRadius: 99, fontFamily: "inherit", fontSize: 18, fontWeight: 700, color: C.ink, outline: "none" }}
            />
            <select
              value={draft.projectId}
              onChange={(e) => setDraft((d) => ({ ...d, projectId: e.target.value }))}
              aria-label="Projet"
              style={{ padding: "12px 16px", background: C.surface, border: "1px solid rgba(16,16,16,.12)", borderRadius: 99, fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: C.ink }}
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {draft.type !== "idea" && (
              <input
                type="datetime-local"
                value={draft.dueLocal}
                onChange={(e) => setDraft((d) => ({ ...d, dueLocal: e.target.value }))}
                style={{ padding: "12px 16px", background: C.surface, border: "1px solid rgba(16,16,16,.12)", borderRadius: 99, fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: C.ink, outline: "none" }}
              />
            )}
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Notes (optionnel)"
              rows={4}
              style={{ padding: "14px 16px", background: C.surface, border: "1px solid rgba(16,16,16,.1)", borderRadius: 18, fontFamily: "inherit", fontSize: 15, fontWeight: 500, color: C.ink, outline: "none", resize: "vertical" }}
            />
            {formError && <p className="text-[14px] font-semibold" style={{ color: C.danger }}>{formError}</p>}
          </div>
        ) : (
          <>
            {/* Chips */}
            <div className="mb-4 flex flex-wrap gap-2.5">
              <Chip variant={chipVariant}>{project ? project.name : "Sans projet"}</Chip>
              {item.due && currentType !== "idea" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/[.08] bg-surface px-3.5 py-2 text-[13px] font-bold">
                  <ClockIcon size={13} />
                  {dueLabel}
                </span>
              )}
            </div>

            {/* Title */}
            <h2 className="mb-5 text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em]" style={{ color: isDone ? C.inkFaint : C.ink, textDecoration: isDone ? "line-through" : "none" }}>
              {item.title}
            </h2>

            {/* Notes */}
            {item.notes && (
              <p className="mb-5 text-[16px] font-medium leading-[1.55]" style={{ color: C.inkMuted }}>{item.notes}</p>
            )}
          </>
        )}

        {!editing && (
          <>
            {/* Fil d'origine — audio avec métadonnées */}
            {audio && (
              <div className="mb-4" style={{ padding: 20, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 20 }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint }}>
                    FIL D'ORIGINE · {new Date(audio.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).toUpperCase()} · {audio.durationSec} S
                  </span>
                  <button
                    aria-label="Écouter l'extrait"
                    onClick={handlePlayAudio}
                    className="flex items-center justify-center"
                    style={{ width: 36, height: 36, borderRadius: 99, background: C.ink, border: "none", cursor: "pointer" }}
                  >
                    <PlayIcon size={13} className="text-white" />
                  </button>
                </div>
                <WaveformStatic
                  totalBars={24}
                  activeStart={Math.floor((audio.startSec / audio.durationSec) * 24)}
                  activeEnd={Math.ceil((audio.endSec / audio.durationSec) * 24)}
                />
                <div className="mb-3 mt-2 flex items-center gap-2">
                  <span style={{ width: 36 }} />
                  <span style={{ height: 2, width: 40, borderRadius: 99, background: C.ink }} />
                  <span className="font-mono" style={{ fontSize: 10, color: C.ink }}>
                    0:{String(Math.floor(audio.startSec)).padStart(2, "0")} → 0:{String(Math.floor(audio.endSec)).padStart(2, "0")}
                  </span>
                </div>
                <p className="mb-3 text-[14px] font-semibold leading-[1.5]" style={{ color: C.inkMuted }}>
                  « …<span style={{ background: "var(--color-idea-100)", borderRadius: 5, padding: "1px 5px", color: C.ink }}>{audio.highlight}</span>… »
                </p>
                {audio.siblingIds.length > 0 && (
                  <button
                    onClick={() => audio.siblingIds[0] && onOpenSibling?.(audio.siblingIds[0])}
                    className="flex w-full items-center justify-between gap-2"
                    style={{ borderTop: "1px solid rgba(16,16,16,.07)", paddingTop: 12, minHeight: 44, background: "none", border: "none", borderBottom: "none", borderLeft: "none", borderRight: "none", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <span className="text-[13px] font-bold" style={{ color: C.ink }}>
                      {audio.siblingIds.length} autre{audio.siblingIds.length > 1 ? "s" : ""} item{audio.siblingIds.length > 1 ? "s" : ""} de cette dictée
                    </span>
                    <ChevronRightIcon size={16} />
                  </button>
                )}
              </div>
            )}

            {/* Enregistrement vocal — audioId seul */}
            {!audio && item?.audioId && (
              <div className="mb-4" style={{ padding: 20, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 20 }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint }}>ENREGISTREMENT VOCAL</span>
                  <button
                    aria-label="Écouter l'enregistrement"
                    onClick={handlePlayAudio}
                    className="flex items-center justify-center"
                    style={{ width: 40, height: 40, borderRadius: 99, background: C.ink, border: "none", cursor: "pointer" }}
                  >
                    <PlayIcon size={15} className="text-white" />
                  </button>
                </div>
                <div className="mt-3"><WaveformStatic totalBars={24} activeStart={0} activeEnd={24} /></div>
              </div>
            )}

            {/* Sous-tâches */}
            {subs.length > 0 && (
              <div className="mb-4" style={{ padding: 20, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 20 }}>
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-[16px] font-bold">Sous-tâches</span>
                  <span className="text-[13px] font-bold" style={{ color: C.inkFaint }}>{doneSubs}/{subs.length}</span>
                </div>
                <div className="mb-4" style={{ height: 5, borderRadius: 99, overflow: "hidden", background: "rgba(16,16,16,.07)" }}>
                  <div style={{ height: "100%", borderRadius: 99, width: `${subPct}%`, background: C.ink, transition: "width .35s cubic-bezier(.2,.9,.3,1)" }} />
                </div>
                <div className="flex flex-col gap-1">
                  {subs.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-3" style={{ padding: "10px 0" }}>
                      <button
                        aria-label="Cocher"
                        onClick={() => onToggleSub?.(item.id, sub.id)}
                        className="flex flex-none items-center justify-center"
                        style={{ width: 26, height: 26, borderRadius: 99, border: "2px solid rgba(16,16,16,.18)", background: sub.done ? C.ink : C.surface, cursor: "pointer" }}
                      >
                        {sub.done && <CheckIcon size={13} className="text-white" />}
                      </button>
                      <span
                        className="text-[15px] font-semibold"
                        style={{ color: sub.done ? C.inkFaint : C.ink, textDecoration: sub.done ? "line-through" : "none" }}
                      >
                        {sub.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex flex-col gap-3">
              <button
                onClick={() => onDone(item.id)}
                className="flex items-center justify-center gap-2.5"
                style={{ height: 52, borderRadius: 99, background: C.ink, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 16, fontWeight: 700 }}
              >
                <CheckIcon size={18} className="text-white" />
                {isDone ? "Réouvrir" : "Terminer"}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => onPostpone(item.id)}
                  style={{ height: 48, flex: 1, borderRadius: 99, border: "1px solid rgba(16,16,16,.12)", background: C.surface, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: C.ink }}
                >
                  Reporter
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  style={{ height: 48, flex: 1, borderRadius: 99, border: "1px solid rgba(226,58,46,.25)", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: C.danger }}
                >
                  Supprimer
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}