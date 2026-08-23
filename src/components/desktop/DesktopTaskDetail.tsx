"use client";

/**
 * Fiche de détail d'une tâche — version desktop.
 * Layout 2 colonnes : gauche (titre, notes, audio, sous-tâches, actions)
 * + droite (métadonnées : projet, échéance, tags, dépendances, historique).
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
import { calendarForProjectName } from "@/lib/calendarMapping";
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
  items,
  projects,
  onBack,
  onDone,
  onPostpone,
  onDelete,
  onToggleSub,
  onAddSubtask,
  onOpenSibling,
  onSave,
}: {
  item: Item | null;
  items: Item[];
  projects: Project[];
  onBack: () => void;
  onDone: (id: string) => void;
  onPostpone: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSub?: (itemId: string, subId: string) => void;
  onAddSubtask?: (itemId: string, title: string) => void;
  onOpenSibling?: (id: string) => void;
  onSave: (id: string, patch: Partial<DraftItem>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft>(() =>
    item ? draftFrom(item) : { title: "", type: "task", projectId: "", dueLocal: "", notes: "" },
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState("");
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
  const calName = calendarForProjectName(item.projectId);

  // Items liés (siblings de la même dictée + dépendances)
  const siblings = audio?.siblingIds
    ? audio.siblingIds.map((id) => items.find((it) => it.id === id)).filter(Boolean) as Item[]
    : [];
  const deps = (item.dependsOn ?? [])
    .map((id) => items.find((it) => it.id === id))
    .filter(Boolean) as Item[];

  // Métadonnées pour la sidebar
  const createdLabel = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: TIMEZONE }).format(new Date(item.createdAt));

  return (
    <div className="flex h-full overflow-hidden" style={{ animation: "fade .25s both" }}>
      {/* Colonne principale — la fiche */}
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto" style={{ maxWidth: 720, padding: "24px 32px" }}>
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
            {/* Audio — Fil d'origine */}
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
                {/* Transcription complète */}
                {audio.text && (
                  <p className="mb-3 text-[13px] font-medium leading-[1.6]" style={{ color: C.inkFaint, whiteSpace: "pre-wrap" }}>
                    {audio.text}
                  </p>
                )}
              </div>
            )}

            {/* Audio — Enregistrement vocal (audioId seul) */}
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

            {/* Audio — section vide (préparée pour les futures tâches) */}
            {!audio && !item?.audioId && (
              <div className="mb-4" style={{ padding: 20, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 20 }}>
                <div className="flex items-center gap-3">
                  <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint }}>AUDIO</span>
                  <span className="text-[13px] font-medium" style={{ color: C.inkFaint }}>Aucun enregistrement</span>
                </div>
                <p className="mt-2 text-[12px] font-medium" style={{ color: C.inkFaint, lineHeight: 1.4 }}>
                  Les nouvelles tâches dictées à la voix stockent automatiquement l'audio.
                </p>
              </div>
            )}

            {/* Sous-tâches + Items liés (fusionnés) */}
            <div className="mb-4" style={{ padding: 20, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 20 }}>
              {/* Sous-tâches */}
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[16px] font-bold">Sous-tâches</span>
                {subs.length > 0 && <span className="text-[13px] font-bold" style={{ color: C.inkFaint }}>{doneSubs}/{subs.length}</span>}
              </div>
              {subs.length > 0 && (
                <div className="mb-4" style={{ height: 5, borderRadius: 99, overflow: "hidden", background: "rgba(16,16,16,.07)" }}>
                  <div style={{ height: "100%", borderRadius: 99, width: `${subPct}%`, background: C.ink, transition: "width .35s cubic-bezier(.2,.9,.3,1)" }} />
                </div>
              )}
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
                {/* Ajouter une sous-tâche */}
                <div className="flex items-center gap-3" style={{ padding: "10px 0" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 99, border: "2px dashed rgba(16,16,16,.12)", flex: "none" }} />
                  <input
                    value={newSubTitle}
                    onChange={(e) => setNewSubTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newSubTitle.trim()) {
                        onAddSubtask?.(item.id, newSubTitle.trim());
                        setNewSubTitle("");
                      }
                    }}
                    placeholder="Ajouter une sous-tâche…"
                    style={{ flex: 1, padding: "8px 0", background: "none", border: "none", borderBottom: "1px solid rgba(16,16,16,.06)", fontFamily: "inherit", fontSize: 15, fontWeight: 500, color: C.ink, outline: "none" }}
                  />
                </div>
              </div>

              {/* Items liés (siblings + dépendances) */}
              {(siblings.length > 0 || deps.length > 0) && (
                <div className="mt-4" style={{ borderTop: "1px solid rgba(16,16,16,.07)", paddingTop: 16 }}>
                  <span className="mb-3 block text-[14px] font-bold">Items liés</span>
                  <div className="flex flex-col gap-1">
                    {siblings.map((sib) => {
                      const sibProject = projects.find((p) => p.id === sib.projectId);
                      const sibSkin = sibProject ? skinFor(sibProject) : null;
                      const sibShape = sibProject ? shapeFor(sibProject) : "disc";
                      return (
                        <button
                          key={sib.id}
                          onClick={() => onOpenSibling?.(sib.id)}
                          className="flex items-center gap-3"
                          style={{ padding: "8px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                        >
                          {sibSkin && <span style={{ width: 8, height: 8, borderRadius: sibShape === "square" ? 2 : 99, background: sibSkin.bg, flex: "none" }} />}
                          <span className="text-[14px] font-semibold" style={{ color: sib.doneAt ? C.inkFaint : C.ink, textDecoration: sib.doneAt ? "line-through" : "none" }}>
                            {sib.title}
                          </span>
                          <span className="text-[11px] font-medium" style={{ color: C.inkFaint }}>· même dictée</span>
                          <ChevronRightIcon size={14} />
                        </button>
                      );
                    })}
                    {deps.map((dep) => {
                      const depProject = projects.find((p) => p.id === dep.projectId);
                      const depSkin = depProject ? skinFor(depProject) : null;
                      const depShape = depProject ? shapeFor(depProject) : "disc";
                      return (
                        <button
                          key={dep.id}
                          onClick={() => onOpenSibling?.(dep.id)}
                          className="flex items-center gap-3"
                          style={{ padding: "8px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                        >
                          {depSkin && <span style={{ width: 8, height: 8, borderRadius: depShape === "square" ? 2 : 99, background: depSkin.bg, flex: "none" }} />}
                          <span className="text-[14px] font-semibold" style={{ color: dep.doneAt ? C.inkFaint : C.ink, textDecoration: dep.doneAt ? "line-through" : "none" }}>
                            {dep.title}
                          </span>
                          <span className="text-[11px] font-medium" style={{ color: C.inkFaint }}>· bloqué par</span>
                          <ChevronRightIcon size={14} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

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

      {/* Sidebar droite — métadonnées */}
      {!editing && (
        <div className="flex h-full w-[340px] flex-none flex-col gap-3 overflow-y-auto" style={{ padding: "24px 24px 24px 0" }}>
          {/* Projet */}
          <div style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 20 }}>
            <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint, textTransform: "uppercase" }}>Projet</span>
            <div className="mt-2.5 flex items-center gap-3">
              {skin && <span style={{ width: 18, height: 18, borderRadius: shape === "square" ? 5 : 99, background: skin.bg, flex: "none" }} />}
              <div className="flex flex-col">
                <span className="text-[16px] font-bold" style={{ color: C.ink }}>{project?.name ?? "Sans projet"}</span>
                <span className="text-[12px] font-medium" style={{ color: C.inkMuted }}>→ {calName}</span>
              </div>
            </div>
          </div>

          {/* Échéance */}
          <div style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 20 }}>
            <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint, textTransform: "uppercase" }}>Échéance</span>
            <div className="mt-2.5 flex items-center gap-2.5">
              <ClockIcon size={16} />
              <span className="text-[15px] font-bold" style={{ color: C.ink }}>
                {item.due ? dueLabel : "Sans échéance"}
              </span>
            </div>
          </div>

          {/* Tags (section préparée) */}
          <div style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 20 }}>
            <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint, textTransform: "uppercase" }}>Étiquettes</span>
            <div className="mt-2.5">
              {item.tags && item.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tagId) => (
                    <span key={tagId} style={{ padding: "4px 10px", borderRadius: 99, background: C.bg, fontSize: 12, fontWeight: 600, color: C.inkMuted }}>
                      {tagId}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[13px] font-medium" style={{ color: C.inkFaint }}>Aucune étiquette</span>
              )}
            </div>
          </div>

          {/* Dépendances */}
          <div style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 20 }}>
            <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint, textTransform: "uppercase" }}>Dépendances</span>
            <div className="mt-2.5">
              {deps.length > 0 ? (
                <span className="text-[13px] font-medium" style={{ color: C.ink }}>{deps.length} tâche{deps.length > 1 ? "s" : ""} prédécesseure{deps.length > 1 ? "s" : ""}</span>
              ) : (
                <span className="text-[13px] font-medium" style={{ color: C.inkFaint }}>Aucune dépendance</span>
              )}
            </div>
          </div>

          {/* Historique */}
          <div style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 20 }}>
            <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint, textTransform: "uppercase" }}>Historique</span>
            <div className="mt-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span style={{ width: 6, height: 6, borderRadius: 99, background: C.inkFaint, flex: "none" }} />
                <span className="text-[13px] font-medium" style={{ color: C.inkMuted }}>Créée le {createdLabel}</span>
              </div>
              {item.doneAt && (
                <div className="flex items-center gap-2">
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--color-p6)", flex: "none" }} />
                  <span className="text-[13px] font-medium" style={{ color: C.inkMuted }}>Terminée</span>
                </div>
              )}
              {item.caldavSyncedDue && (
                <div className="flex items-center gap-2">
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--color-p1)", flex: "none" }} />
                  <span className="text-[13px] font-medium" style={{ color: C.inkMuted }}>Sync CalDAV</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}