"use client";

import { useCallback, useRef, useState } from "react";
import { Chip } from "./Chip";
import { TypeSegmented } from "./TypeSegmented";
import { VoiceBadge } from "./VoiceBadge";
import { WaveformStatic } from "./Waveform";
import {
  ChevronLeftIcon,
  EditIcon,
  CheckIcon,
  CloseIcon,
  PlayIcon,
  ChevronRightIcon,
  ClockIcon,
} from "./icons";
import { isoToLocalInputValue, localInputToIso } from "@/lib/due";
import { itemType, type ItemType } from "@/lib/item-type";
import { apiFetch } from "@/lib/pin";
import { TIMEZONE } from "@/lib/zoned";
import type { DraftItem, Item, Project } from "@/lib/types";

/**
 * TaskDetailScreen — détail d'une tâche avec fil d'origine vocal, et son
 * édition complète (type, titre, projet, date/heure, notes).
 */

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

export function TaskDetailScreen({
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
  // Hooks avant tout retour anticipé (règle de React) : `item` peut être null
  // le temps d'un rendu (fiche ouverte avant que `sent` ne soit chargé).
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft>(() =>
    item ? draftFrom(item) : { title: "", type: "task", projectId: "", dueLocal: "", notes: "" },
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Élément Audio courant — pour éviter d'en créer plusieurs simultanément. */
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /**
   * Rejoue l'enregistrement audio lié à l'item, s'il existe.
   * Fetch avec le header PIN (comme toutes les routes /api/*), puis lecture.
   */
  const handlePlayAudio = useCallback(async () => {
    if (!item?.audioId) return;
    try {
      const res = await apiFetch(`/api/audio/${encodeURIComponent(item.audioId)}`);
      if (!res.ok) return;
      const blob = await res.blob();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      void audio.play();
    } catch {
      /* PIN révoqué ou réseau coupé : on ignore silencieusement */
    }
  }, [item?.audioId]);

  const beginEdit = () => {
    if (!item) return;
    setDraft(draftFrom(item));
    setFormError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setFormError(null);
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!item) return;
    const title = draft.title.trim();
    if (!title) {
      setFormError("Le titre ne peut pas être vide.");
      return;
    }
    if (draft.type === "event" && !draft.dueLocal) {
      setFormError("Un rendez-vous a besoin d'une date et d'une heure.");
      return;
    }
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
      <div className="flex-1 min-h-0 overflow-auto px-5 pb-2" style={{ animation: "fade .25s both" }}>
        <div className="flex items-center justify-between mb-5.5">
          <button onClick={onBack} className="flex size-11 items-center justify-center rounded-full border border-ink/[.08] bg-surface">
            <ChevronLeftIcon size={18} />
          </button>
        </div>
        <p className="text-[15px] text-ink-muted">Item introuvable.</p>
      </div>
    );
  }

  const project = projects.find((p) => p.id === item.projectId);
  const isDone = !!item.doneAt;
  const subs = item.subtasks || [];
  const doneSubs = subs.filter((s) => s.done).length;
  const subPct = subs.length > 0 ? Math.round((doneSubs / subs.length) * 100) : 0;

  const dueLabel = item.due
    ? new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: TIMEZONE,
      }).format(new Date(item.due)).replace(":", "h")
    : "Sans échéance";

  const audio = item.audioOrigin;
  const currentType = itemType(item);
  const chipVariant = currentType === "event" ? "meet" : currentType;

  return (
    <div className="flex-1 min-h-0 overflow-auto px-5 pb-2" style={{ animation: "fade .25s both" }}>
      {/* Header */}
      <div className="mb-5.5 flex items-center justify-between">
        <button
          aria-label={editing ? "Annuler" : "Retour"}
          onClick={editing ? cancelEdit : onBack}
          className="flex size-11 items-center justify-center rounded-full border border-ink/[.08] bg-surface"
        >
          {editing ? <CloseIcon size={16} /> : <ChevronLeftIcon size={18} />}
        </button>
        {editing ? (
          <button
            onClick={() => void saveEdit()}
            disabled={saving}
            className="h-11 rounded-full bg-ink px-5 text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        ) : (
          <button
            aria-label="Modifier"
            onClick={beginEdit}
            className="flex size-11 items-center justify-center rounded-full border border-ink/[.08] bg-surface"
          >
            <EditIcon size={17} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <TypeSegmented value={draft.type} onChange={(t) => setDraft((d) => ({ ...d, type: t }))} />

          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Titre"
            aria-label="Titre"
            className="h-12 rounded-full border border-ink/[.12] bg-surface px-4 text-[16px] font-bold text-ink outline-none"
          />

          <select
            value={draft.projectId}
            onChange={(e) => setDraft((d) => ({ ...d, projectId: e.target.value }))}
            aria-label="Projet"
            className="h-11 rounded-full border border-ink/[.12] bg-surface px-4 text-[14px] font-semibold text-ink"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {draft.type !== "idea" && (
            <input
              type="datetime-local"
              value={draft.dueLocal}
              onChange={(e) => setDraft((d) => ({ ...d, dueLocal: e.target.value }))}
              aria-label={draft.type === "event" ? "Date et heure du rendez-vous" : "Échéance"}
              className="h-11 rounded-full border border-ink/[.12] bg-surface px-4 text-[14px] font-semibold text-ink outline-none"
            />
          )}

          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder="Notes (optionnel)"
            aria-label="Notes"
            rows={4}
            className="rounded-18 border border-ink/[.1] bg-surface p-3.5 text-[14px] font-medium text-ink outline-none"
          />

          {formError && (
            <p className="text-[13px] font-semibold" style={{ color: "var(--color-danger)" }}>{formError}</p>
          )}
        </div>
      ) : (
        <>
          {/* Chips */}
          <div className="mb-3 flex gap-2">
            <Chip variant={chipVariant}>{project ? project.name : "Sans projet"}</Chip>
            {item.due && currentType !== "idea" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/[.08] bg-surface px-3 py-[7px] text-[12px] font-bold">
                <ClockIcon size={12} />
                {dueLabel}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="mb-4 text-[28px] font-extrabold leading-[1.14] tracking-[-0.03em]">{item.title}</h2>

          {/* Notes */}
          {item.notes && (
            <p className="mb-3.5 text-[14.5px] font-medium leading-[1.5] text-ink-muted">{item.notes}</p>
          )}
        </>
      )}

      {!editing && (
      <>
      {/* Fil d'origine */}
      {audio && (
        <div className="mb-3.5 rounded-20 border border-ink/[.06] bg-surface p-4">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between gap-2.5">
            <span className="font-mono text-[10px] tracking-[0.09em] text-ink-faint">
              FIL D&apos;ORIGINE · {new Date(audio.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).toUpperCase()} · {audio.durationSec} S
            </span>
            <button
              aria-label="Écouter l'extrait"
              onClick={handlePlayAudio}
              className="flex size-8 flex-none items-center justify-center rounded-full bg-ink"
            >
              <PlayIcon size={12} className="text-white" />
            </button>
          </div>

          {/* Waveform */}
          <WaveformStatic
            totalBars={24}
            activeStart={Math.floor((audio.startSec / audio.durationSec) * 24)}
            activeEnd={Math.ceil((audio.endSec / audio.durationSec) * 24)}
          />

          {/* Segment */}
          <div className="mb-3 mt-1.5 flex items-center gap-2">
            <span className="w-[33px]" />
            <span className="h-[2px] w-[37px] rounded-full bg-ink" />
            <span className="font-mono text-[10px] text-ink">
              0:{String(Math.floor(audio.startSec)).padStart(2, "0")} → 0:{String(Math.floor(audio.endSec)).padStart(2, "0")}
            </span>
          </div>

          {/* Citation */}
          <p className="mb-3 text-[13px] font-semibold leading-[1.5] text-ink-muted">
            « …
            <span style={{ background: "var(--color-idea-100)", borderRadius: 5, padding: "1px 4px", color: "var(--color-ink)" }}>
              {audio.highlight}
            </span>
            … »
          </p>

          {/* Siblings */}
          {audio.siblingIds.length > 0 && (
            <button
              onClick={() => audio.siblingIds[0] && onOpenSibling?.(audio.siblingIds[0])}
              className="flex w-full items-center justify-between gap-2 border-t border-ink/[.07] pt-3 min-h-[44px]"
            >
              <span className="text-[12.5px] font-bold text-ink">
                {audio.siblingIds.length} autre{audio.siblingIds.length > 1 ? "s" : ""} item{audio.siblingIds.length > 1 ? "s" : ""} de cette dictée
              </span>
              <ChevronRightIcon size={16} />
            </button>
          )}
        </div>
      )}

      {/* Sous-tâches */}
      {subs.length > 0 && (
        <div className="rounded-20 border border-ink/[.06] bg-surface p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[15px] font-bold">Sous-tâches</span>
            <span className="text-[12px] font-bold text-ink-faint">{doneSubs}/{subs.length}</span>
          </div>
          {/* Progress bar */}
          <div className="mb-3.5 h-[5px] overflow-hidden rounded-full bg-ink/[.07]">
            <div
              className="h-full rounded-full bg-ink"
              style={{ width: `${subPct}%`, transition: "width .35s cubic-bezier(.2,.9,.3,1)" }}
            />
          </div>
          {/* List */}
          <div className="flex flex-col gap-0.5">
            {subs.map((sub) => (
              <div key={sub.id} className="flex items-center gap-3 py-[9px]">
                <button
                  aria-label="Cocher"
                  onClick={() => onToggleSub?.(item.id, sub.id)}
                  className="flex size-6 flex-none items-center justify-center rounded-full border-2 border-ink/[.18] bg-surface"
                >
                  {sub.done && <CheckIcon size={12} />}
                </button>
                <span
                  className={`text-[14.5px] font-semibold ${sub.done ? "text-ink-faint line-through" : ""}`}
                >
                  {sub.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-col gap-2.5">
        <button
          onClick={() => onDone(item.id)}
          className="flex h-[52px] items-center justify-center gap-2.5 rounded-full bg-ink text-[15.5px] font-bold text-white"
        >
          <CheckIcon size={17} className="text-white" />
          {isDone ? "Réouvrir" : "Terminer"}
        </button>
        <div className="flex gap-2.5">
          <button
            onClick={() => onPostpone(item.id)}
            className="h-12 flex-1 rounded-full border border-ink/[.12] bg-surface text-[14.5px] font-bold"
          >
            Reporter
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="h-12 flex-1 rounded-full border text-[14.5px] font-bold"
            style={{ borderColor: "rgba(226,58,46,.25)", color: "var(--color-danger)" }}
          >
            Supprimer
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
}