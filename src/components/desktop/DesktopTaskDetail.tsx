"use client";

/**
 * Fiche de détail d'une tâche — version desktop.
 * Design basé sur le prototype Claude Design "Fiche tâche desktop.dc.html".
 * Layout : barre d'actions en haut + 2 colonnes (contenu + sidebar méta).
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
  TrashIcon,
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

/** Ligne label/valeur pour la sidebar (style Claude Design) */
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3" style={{ padding: "9px 0", borderBottom: "1px solid rgba(16,16,16,.04)" }}>
      <span className="text-[12px] font-bold" style={{ color: C.inkFaint, letterSpacing: "0.03em" }}>{label}</span>
      <span className="text-[13px] font-semibold text-right" style={{ color: C.ink }}>{children}</span>
    </div>
  );
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
  const [showTranscript, setShowTranscript] = useState(false);
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
    ? new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE }).format(new Date(item.due)).replace(":", "h")
    : "Sans échéance";

  const dueLong = item.due
    ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE }).format(new Date(item.due)).replace(":", "h")
    : "Sans échéance";

  const audio = item.audioOrigin;
  const currentType = itemType(item);
  const chipVariant = currentType === "event" ? "meet" : currentType;
  const skin = project ? skinFor(project) : null;
  const shape = project ? shapeFor(project) : "disc";
  const calName = calendarForProjectName(item.projectId);

  const siblings = audio?.siblingIds
    ? audio.siblingIds.map((id) => items.find((it) => it.id === id)).filter(Boolean) as Item[]
    : [];
  const deps = (item.dependsOn ?? [])
    .map((id) => items.find((it) => it.id === id))
    .filter(Boolean) as Item[];

  const createdLabel = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: TIMEZONE }).format(new Date(item.createdAt));

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ animation: "fade .25s both" }}>
      {/* Barre d'actions supérieure */}
      <div className="mx-auto flex w-full max-w-[1080px] flex-none items-center justify-between" style={{ padding: "0 0 16px 0" }}>
        <div className="flex items-center gap-3">
          <button
            aria-label={editing ? "Annuler" : "Retour"}
            onClick={editing ? cancelEdit : onBack}
            className="flex items-center justify-center"
            style={{ width: 40, height: 40, borderRadius: 99, border: "1px solid rgba(16,16,16,.08)", background: C.surface, cursor: "pointer" }}
          >
            {editing ? <CloseIcon size={16} /> : <ChevronLeftIcon size={18} />}
          </button>
          <span className="text-[13px] font-bold" style={{ color: C.inkFaint, letterSpacing: "0.02em" }}>
            TÂCHES / {project?.name ?? "Sans projet"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <button
              onClick={() => void saveEdit()}
              disabled={saving}
              style={{ padding: "9px 20px", background: C.ink, color: "#fff", border: "none", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "…" : "Enregistrer"}
            </button>
          ) : (
            <>
              <button onClick={beginEdit} className="flex items-center gap-1.5" style={{ padding: "8px 16px", background: C.surface, border: "1px solid rgba(16,16,16,.08)", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: C.ink }}>
                <EditIcon size={14} /> Modifier
              </button>
              <button onClick={() => onPostpone(item.id)} className="flex items-center gap-1.5" style={{ padding: "8px 16px", background: C.surface, border: "1px solid rgba(16,16,16,.08)", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: C.ink }}>
                Reporter
              </button>
              <button onClick={() => onDelete(item.id)} className="flex items-center justify-center" style={{ width: 36, height: 36, background: C.surface, border: "1px solid rgba(226,58,46,.15)", borderRadius: 99, cursor: "pointer", color: C.danger }} title="Supprimer">
                <TrashIcon size={15} />
              </button>
              <button onClick={() => onDone(item.id)} className="flex items-center gap-2" style={{ padding: "9px 20px", background: C.ink, color: "#fff", border: "none", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
                <CheckIcon size={15} className="text-white" />
                {isDone ? "Réouvrir" : "Terminer"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Corps — 2 colonnes */}
      <div className="mx-auto flex w-full max-w-[1080px] min-h-0 flex-1 gap-6 overflow-hidden">
        {/* Colonne principale */}
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
          {editing ? (
            <div className="flex flex-col gap-4" style={{ paddingTop: 8 }}>
              <TypeSegmented value={draft.type} onChange={(t) => setDraft((d) => ({ ...d, type: t }))} />
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Titre"
                style={{ padding: "14px 18px", background: C.surface, border: "1px solid rgba(16,16,16,.12)", borderRadius: 99, fontFamily: "inherit", fontSize: 18, fontWeight: 700, color: C.ink, outline: "none" }}
              />
              <select
                value={draft.projectId}
                onChange={(e) => setDraft((d) => ({ ...d, projectId: e.target.value }))}
                style={{ padding: "12px 16px", background: C.surface, border: "1px solid rgba(16,16,16,.12)", borderRadius: 99, fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: C.ink }}
              >
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {draft.type !== "idea" && (
                <input type="datetime-local" value={draft.dueLocal} onChange={(e) => setDraft((d) => ({ ...d, dueLocal: e.target.value }))}
                  style={{ padding: "12px 16px", background: C.surface, border: "1px solid rgba(16,16,16,.12)", borderRadius: 99, fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: C.ink, outline: "none" }}
                />
              )}
              <textarea value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Notes" rows={4}
                style={{ padding: "14px 16px", background: C.surface, border: "1px solid rgba(16,16,16,.1)", borderRadius: 18, fontFamily: "inherit", fontSize: 15, fontWeight: 500, color: C.ink, outline: "none", resize: "vertical" }}
              />
              {formError && <p className="text-[14px] font-semibold" style={{ color: C.danger }}>{formError}</p>}
            </div>
          ) : (
            <>
              {/* Chips + titre */}
              <div className="flex flex-wrap gap-2.5" style={{ marginBottom: 12 }}>
                <Chip variant={chipVariant}>{currentType === "event" ? "Rendez-vous" : "Tâche"}</Chip>
                <Chip variant={chipVariant}>{project?.name ?? "Sans projet"}</Chip>
                {item.due && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/[.08] bg-surface px-3 py-1.5 text-[12px] font-bold">
                    <ClockIcon size={12} />{dueLabel}
                  </span>
                )}
              </div>
              <h2 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]" style={{ color: isDone ? C.inkFaint : C.ink, textDecoration: isDone ? "line-through" : "none", marginBottom: 12 }}>
                {item.title}
              </h2>
              {item.notes && (
                <p className="text-[15px] font-medium leading-[1.55]" style={{ color: C.inkMuted, marginBottom: 16 }}>{item.notes}</p>
              )}

              {/* Audio — fil d'origine */}
              {audio && (
                <div style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 18, marginBottom: 12 }}>
                  <div className="flex items-center justify-between gap-3" style={{ marginBottom: 12 }}>
                    <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint }}>
                      FIL D'ORIGINE · {new Date(audio.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).toUpperCase()} · {audio.durationSec} S
                    </span>
                    <button onClick={handlePlayAudio} className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 99, background: C.ink, border: "none", cursor: "pointer" }}>
                      <PlayIcon size={12} className="text-white" />
                    </button>
                  </div>
                  <WaveformStatic totalBars={28} activeStart={Math.floor((audio.startSec / audio.durationSec) * 28)} activeEnd={Math.ceil((audio.endSec / audio.durationSec) * 28)} />
                  <div className="flex items-center gap-2" style={{ marginTop: 8, marginBottom: 12 }}>
                    <span style={{ height: 2, width: 36, borderRadius: 99, background: C.ink }} />
                    <span className="font-mono" style={{ fontSize: 10, color: C.ink }}>
                      0:{String(Math.floor(audio.startSec)).padStart(2, "0")} → 0:{String(Math.floor(audio.endSec)).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="text-[14px] font-semibold leading-[1.5]" style={{ color: C.inkMuted, marginBottom: 8 }}>
                    « …<span style={{ background: "var(--color-idea-100)", borderRadius: 5, padding: "1px 5px", color: C.ink }}>{audio.highlight}</span>… »
                  </p>
                  <button onClick={() => setShowTranscript(!showTranscript)} className="text-[12px] font-bold" style={{ color: C.inkFaint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    TRANSCRIPTION COMPLÈTE {showTranscript ? "↑" : "↓"}
                  </button>
                  {showTranscript && audio.text && (
                    <p className="text-[13px] font-medium leading-[1.6]" style={{ color: C.inkFaint, whiteSpace: "pre-wrap", marginTop: 8 }}>{audio.text}</p>
                  )}
                </div>
              )}

              {/* Audio — enregistrement vocal seul */}
              {!audio && item?.audioId && (
                <div style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 18, marginBottom: 12 }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint }}>ENREGISTREMENT VOCAL</span>
                    <button onClick={handlePlayAudio} className="flex items-center justify-center" style={{ width: 38, height: 38, borderRadius: 99, background: C.ink, border: "none", cursor: "pointer" }}>
                      <PlayIcon size={14} className="text-white" />
                    </button>
                  </div>
                  <div style={{ marginTop: 12 }}><WaveformStatic totalBars={28} activeStart={0} activeEnd={28} /></div>
                </div>
              )}

              {/* Audio — section vide discrète avec CTA */}
              {!audio && !item?.audioId && (
                <div style={{ padding: "14px 18px", background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 18, marginBottom: 12 }}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint }}>AUDIO</span>
                    <span className="text-[13px] font-medium" style={{ color: C.inkFaint }}>Aucun enregistrement — saisie clavier</span>
                  </div>
                </div>
              )}

              {/* Sous-tâches + items liés */}
              <div style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 18, marginBottom: 12 }}>
                {/* Sous-tâches */}
                <div className="flex items-baseline justify-between" style={{ marginBottom: 10 }}>
                  <span className="text-[15px] font-bold">Sous-tâches</span>
                  {subs.length > 0 && <span className="text-[12px] font-bold" style={{ color: C.inkFaint }}>{doneSubs}/{subs.length}</span>}
                </div>
                {subs.length > 0 && (
                  <div style={{ height: 4, borderRadius: 99, overflow: "hidden", background: "rgba(16,16,16,.07)", marginBottom: 12 }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${subPct}%`, background: C.ink, transition: "width .35s" }} />
                  </div>
                )}
                {subs.length === 0 && (
                  <p className="text-[13px] font-medium" style={{ color: C.inkFaint, marginBottom: 8 }}>aucune</p>
                )}
                <div className="flex flex-col gap-0.5">
                  {subs.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-3" style={{ padding: "8px 0" }}>
                      <button onClick={() => onToggleSub?.(item.id, sub.id)} className="flex flex-none items-center justify-center"
                        style={{ width: 24, height: 24, borderRadius: 99, border: "2px solid rgba(16,16,16,.18)", background: sub.done ? C.ink : C.surface, cursor: "pointer" }}>
                        {sub.done && <CheckIcon size={12} className="text-white" />}
                      </button>
                      <span className="text-[14px] font-semibold" style={{ color: sub.done ? C.inkFaint : C.ink, textDecoration: sub.done ? "line-through" : "none" }}>{sub.title}</span>
                    </div>
                  ))}
                  {/* Champ d'ajout */}
                  <div className="flex items-center gap-3" style={{ padding: "8px 0" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 99, border: "2px dashed rgba(16,16,16,.12)", flex: "none" }} />
                    <input value={newSubTitle} onChange={(e) => setNewSubTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && newSubTitle.trim()) { onAddSubtask?.(item.id, newSubTitle.trim()); setNewSubTitle(""); } }}
                      placeholder="Ajouter une sous-tâche…"
                      style={{ flex: 1, padding: "6px 0", background: "none", border: "none", borderBottom: "1px solid rgba(16,16,16,.06)", fontFamily: "inherit", fontSize: 14, fontWeight: 500, color: C.ink, outline: "none" }}
                    />
                  </div>
                </div>

                {/* Items liés */}
                {(siblings.length > 0 || deps.length > 0) && (
                  <div style={{ marginTop: 16, borderTop: "1px solid rgba(16,16,16,.07)", paddingTop: 14 }}>
                    <span className="text-[13px] font-bold" style={{ color: C.inkFaint, letterSpacing: "0.02em", marginBottom: 8, display: "block" }}>ITEMS LIÉS</span>
                    <div className="flex flex-col gap-0.5">
                      {siblings.map((sib) => {
                        const sp = projects.find((p) => p.id === sib.projectId);
                        const ss = sp ? skinFor(sp) : null;
                        const shp = sp ? shapeFor(sp) : "disc";
                        return (
                          <button key={sib.id} onClick={() => onOpenSibling?.(sib.id)} className="flex items-center gap-3"
                            style={{ padding: "7px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                            {ss && <span style={{ width: 8, height: 8, borderRadius: shp === "square" ? 2 : 99, background: ss.bg, flex: "none" }} />}
                            <span className="text-[13px] font-semibold" style={{ color: sib.doneAt ? C.inkFaint : C.ink, textDecoration: sib.doneAt ? "line-through" : "none" }}>{sib.title}</span>
                            <span className="text-[11px] font-medium" style={{ color: C.inkFaint }}>· même dictée</span>
                            <ChevronRightIcon size={13} />
                          </button>
                        );
                      })}
                      {deps.map((dep) => {
                        const dp = projects.find((p) => p.id === dep.projectId);
                        const ds = dp ? skinFor(dp) : null;
                        const dhp = dp ? shapeFor(dp) : "disc";
                        return (
                          <button key={dep.id} onClick={() => onOpenSibling?.(dep.id)} className="flex items-center gap-3"
                            style={{ padding: "7px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                            {ds && <span style={{ width: 8, height: 8, borderRadius: dhp === "square" ? 2 : 99, background: ds.bg, flex: "none" }} />}
                            <span className="text-[13px] font-semibold" style={{ color: dep.doneAt ? C.inkFaint : C.ink, textDecoration: dep.doneAt ? "line-through" : "none" }}>{dep.title}</span>
                            <span className="text-[11px] font-medium" style={{ color: C.inkFaint }}>· bloqué par</span>
                            <ChevronRightIcon size={13} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Boutons + discrets */}
                <div className="flex gap-2" style={{ marginTop: 14 }}>
                  <button className="text-[12px] font-bold" style={{ padding: "6px 12px", background: C.bg, border: "1px solid rgba(16,16,16,.06)", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", color: C.inkMuted }}>+ Étiquette</button>
                  <button className="text-[12px] font-bold" style={{ padding: "6px 12px", background: C.bg, border: "1px solid rgba(16,16,16,.06)", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", color: C.inkMuted }}>+ Dépendance</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar droite — méta en liste */}
        {!editing && (
          <div className="flex h-full w-[300px] flex-none flex-col overflow-y-auto" style={{ paddingTop: 8 }}>
            <div style={{ padding: "0 4px" }}>
              <MetaRow label="PROJET">
                <span className="flex items-center gap-2">
                  {skin && <span style={{ width: 12, height: 12, borderRadius: shape === "square" ? 3 : 99, background: skin.bg, flex: "none" }} />}
                  {project?.name ?? "—"}
                </span>
              </MetaRow>
              <div className="text-[11px] font-medium" style={{ color: C.inkFaint, padding: "2px 0 4px 0", textAlign: "right" }}>→ {calName}</div>
              <MetaRow label="ÉCHÉANCE">{dueLong}</MetaRow>
              <MetaRow label="ÉTIQUETTES">
                {item.tags && item.tags.length > 0 ? item.tags.join(", ") : "Aucune"}
              </MetaRow>
              <MetaRow label="BLOQUÉ PAR">
                {deps.length > 0 ? `${deps.length} tâche${deps.length > 1 ? "s" : ""}` : "Aucune"}
              </MetaRow>
            </div>

            {/* Historique */}
            <div style={{ marginTop: 20, padding: "0 4px" }}>
              <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint, textTransform: "uppercase" }}>Historique</span>
              <div className="flex flex-col gap-2" style={{ marginTop: 10 }}>
                <div className="flex items-center gap-2">
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: C.inkFaint, flex: "none" }} />
                  <span className="text-[12px] font-medium" style={{ color: C.inkMuted }}>Créée le {createdLabel}</span>
                </div>
                {item.caldavSyncedDue && (
                  <div className="flex items-center gap-2">
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--color-p1)", flex: "none" }} />
                    <span className="text-[12px] font-medium" style={{ color: C.inkMuted }}>Sync CalDAV</span>
                  </div>
                )}
                {item.doneAt && (
                  <div className="flex items-center gap-2">
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--color-p6)", flex: "none" }} />
                    <span className="text-[12px] font-medium" style={{ color: C.inkMuted }}>Terminée</span>
                  </div>
                )}
                {!item.doneAt && (
                  <div className="flex items-center gap-2">
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: "rgba(16,16,16,.12)", flex: "none" }} />
                    <span className="text-[12px] font-medium" style={{ color: C.inkFaint }}>Pas encore terminée</span>
                  </div>
                )}
              </div>
            </div>

            {/* Raccourcis clavier */}
            <div style={{ marginTop: "auto", padding: "16px 4px 0" }}>
              <div className="flex flex-col gap-1.5">
                {[
                  { k: "E", label: "Modifier" },
                  { k: "⌘⏎", label: "Terminer" },
                  { k: "R", label: "Reporter" },
                  { k: "ESC", label: "Fermer" },
                ].map((s) => (
                  <div key={s.k} className="flex items-center gap-2">
                    <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: C.bg, color: C.inkMuted, border: "1px solid rgba(16,16,16,.06)" }}>{s.k}</span>
                    <span className="text-[11px] font-medium" style={{ color: C.inkFaint }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}