"use client";

/**
 * Fiche de détail d'une tâche — version desktop.
 * Design basé sur le prototype Claude Design "Fiche tâche desktop.dc.html".
 * Layout : barre d'actions en haut + 2 colonnes (contenu + sidebar méta).
 */

import { useCallback, useRef, useState, useEffect } from "react";
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
import type { DraftItem, Item, Project, Tag } from "@/lib/types";

const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  danger: "var(--color-danger)",
} as const;

const TAG_COLOR_MAP: Record<string, string> = {
  yellow: "#FBE2AE",
  orange: "#FFCC00",
  red: "#FF3B30",
  purple: "#AF52DE",
  blue: "#007AFF",
  green: "#34C759",
  teal: "#5AC8FA",
  brown: "#A2845E",
  pink: "#FF2D55",
  sky: "#64D2FF",
};

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

function ChainSection({
  item,
  items,
  deps,
  projects,
  onOpenSibling,
  onAddDependency,
  onRemoveDependency,
}: {
  item: Item;
  items: Item[];
  deps: Item[];
  projects: Project[];
  onOpenSibling?: (id: string) => void;
  onAddDependency?: (itemId: string, depId: string) => void;
  onRemoveDependency?: (itemId: string, depId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const after = items.filter((it) => (it.dependsOn ?? []).includes(item.id));

  return (
    <div style={{ marginBottom: 12, padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 18 }}>
      <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
        <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint }}>CHAÎNE {open ? "↑" : "↓"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2" style={{ marginTop: 12 }}>
          {deps.length > 0 && <span className="font-mono" style={{ fontSize: 10, color: C.inkFaint }}>AVANT</span>}
          {deps.map((dep) => {
            const dp = projects.find((p) => p.id === dep.projectId);
            const ds = dp ? skinFor(dp) : null;
            return (
              <div key={dep.id} className="flex items-center gap-2.5" style={{ padding: "4px 0" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: ds?.bg ?? C.inkFaint, flex: "none" }} />
                <button onClick={() => onOpenSibling?.(dep.id)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", padding: 0, flex: 1 }}>
                  <span className="text-[13px] font-semibold" style={{ color: dep.doneAt ? C.inkFaint : C.ink, textDecoration: dep.doneAt ? "line-through" : "none" }}>{dep.title}</span>
                  {dep.doneAt && <span className="text-[11px] font-medium" style={{ color: C.inkFaint }}>· fait</span>}
                </button>
                {onRemoveDependency && (
                  <button onClick={() => onRemoveDependency(item.id, dep.id)} aria-label="Retirer la dépendance" style={{ marginLeft: "auto", cursor: "pointer", color: C.inkFaint, fontSize: 16, background: "none", border: "none", padding: "2px 6px", fontFamily: "inherit", lineHeight: 1 }}>×</button>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-2.5" style={{ padding: "4px 0" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--color-p1)", flex: "none" }} />
            <span className="text-[13px] font-bold" style={{ color: C.ink }}>{item.title}</span>
            <span className="text-[11px] font-medium" style={{ color: C.inkFaint }}>· ici</span>
          </div>
          {after.length > 0 && <span className="font-mono" style={{ fontSize: 10, color: C.inkFaint, marginTop: 4 }}>APRÈS</span>}
          {after.map((aft) => {
            const ap = projects.find((p) => p.id === aft.projectId);
            const as = ap ? skinFor(ap) : null;
            return (
              <button key={aft.id} onClick={() => onOpenSibling?.(aft.id)} className="flex items-center gap-2.5" style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", padding: "4px 0" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: as?.bg ?? C.inkFaint, flex: "none" }} />
                <span className="text-[13px] font-semibold" style={{ color: aft.doneAt ? C.inkFaint : C.ink }}>{aft.title}</span>
                {!aft.doneAt && <span className="text-[11px] font-medium" style={{ color: C.inkFaint }}>· en attente</span>}
              </button>
            );
          })}
          {onAddDependency && (
            <DependencyPicker items={items} currentItem={item} projects={projects} onAdd={(depId) => onAddDependency(item.id, depId)} />
          )}
        </div>
      )}
    </div>
  );
}

function TagPicker({ allTags, itemTags, onAdd, onCreateTag }: { allTags: Tag[]; itemTags: string[]; onAdd: (tagId: string) => void; onCreateTag?: (name: string, color: string) => Promise<Tag | null> }) {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("blue");
  const ref = useRef<HTMLDivElement>(null);
  const available = allTags.filter((t) => !itemTags.includes(t.id));

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setNewTagName("");
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  return (
    <div ref={ref} style={{ display: "inline-block" }}>
      <button onClick={() => setOpen(!open)} style={{ padding: "4px 10px", background: C.bg, border: "1px solid rgba(16,16,16,.06)", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: C.inkMuted }}>+ Étiquette</button>
      {open && (
        <div style={{ marginTop: 8, padding: 14, background: C.surface, border: "1px solid rgba(16,16,16,.08)", borderRadius: 18, maxWidth: 320 }}>
          {available.length > 0 && (
            <>
              <span className="font-mono" style={{ fontSize: 10, color: C.inkFaint, marginBottom: 8, display: "block", letterSpacing: "0.09em" }}>EXISTANTES</span>
              <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 12 }}>
                {available.map((tag) => (
                  <button key={tag.id} onClick={() => { onAdd(tag.id); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, background: TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.blue, fontSize: 12, fontWeight: 700, color: C.ink, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    {tag.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {onCreateTag && (
            <>
              <span className="font-mono" style={{ fontSize: 10, color: C.inkFaint, marginBottom: 8, display: "block" }}>CRÉER</span>
              <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Nom…" style={{ width: "100%", padding: "8px 12px", background: C.bg, border: "1px solid rgba(16,16,16,.1)", borderRadius: 12, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.ink, outline: "none", marginBottom: 8 }} />
              <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 10 }}>
                {Object.keys(TAG_COLOR_MAP).map((c) => (
                  <button key={c} onClick={() => setNewTagColor(c)} title={c} style={{ width: 24, height: 24, borderRadius: 99, background: TAG_COLOR_MAP[c], border: newTagColor === c ? "2px solid var(--color-ink)" : "2px solid rgba(16,16,16,.1)", cursor: "pointer", padding: 0, flex: "none" }} />
                ))}
              </div>
              <button
                onClick={async () => {
                  const name = newTagName.trim();
                  if (!name) return;
                  const tag = await onCreateTag(name, newTagColor);
                  if (tag) { onAdd(tag.id); setNewTagName(""); setOpen(false); }
                }}
                style={{ width: "100%", padding: "10px 14px", background: C.ink, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}
              >Créer</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DependencyPicker({ items, currentItem, projects, onAdd }: { items: Item[]; currentItem: Item; projects: Project[]; onAdd: (depId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const existing = new Set(currentItem.dependsOn ?? []);
  const candidates = items
    .filter((it) => it.id !== currentItem.id && !existing.has(it.id) && !it.doneAt)
    .filter((it) => !query || it.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  return (
    <div style={{ marginTop: 8 }} ref={ref}>
      {open ? (
        <div style={{ padding: 14, background: C.bg, borderRadius: 14, border: "1px solid rgba(16,16,16,.08)" }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une tâche…"
            style={{ width: "100%", padding: "10px 14px", background: C.surface, border: "1px solid rgba(16,16,16,.1)", borderRadius: 12, fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: C.ink, outline: "none", marginBottom: 10 }}
            onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setQuery(""); } }}
          />
          {candidates.length === 0 && <span className="text-[13px] font-medium" style={{ color: C.inkFaint }}>Aucune tâche trouvée.</span>}
          {candidates.map((it) => {
            const proj = projects.find((p) => p.id === it.projectId);
            const sk = proj ? skinFor(proj) : null;
            const shp = proj ? shapeFor(proj) : "disc";
            return (
              <button key={it.id} onClick={() => { onAdd(it.id); setOpen(false); setQuery(""); }} className="flex items-center gap-3" style={{ display: "flex", width: "100%", padding: "8px 4px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                {sk && <span style={{ width: 10, height: 10, borderRadius: shp === "square" ? 2 : 99, background: sk.bg, flex: "none" }} />}
                <span className="text-[14px] font-semibold" style={{ color: C.ink, flex: 1 }}>{it.title}</span>
                {proj && <span className="text-[12px] font-medium" style={{ color: C.inkFaint }}>{proj.name}</span>}
                {it.due && <span className="text-[11px] font-medium" style={{ color: C.inkFaint }}>{formatDueShort(it.due)}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{ padding: "7px 14px", background: "none", border: "1px dashed rgba(16,16,16,.12)", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: C.inkMuted }}>+ Lier une tâche…</button>
      )}
    </div>
  );
}

function formatDueShort(due: string): string {
  const d = new Date(due);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return "demain";
  if (diffDays < 0) return "en retard";
  if (diffDays < 7) return `+${diffDays}j`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(d);
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
  allTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onAddDependency,
  onRemoveDependency,
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
  allTags?: Tag[];
  onAddTag?: (itemId: string, tagId: string) => void;
  onRemoveTag?: (itemId: string, tagId: string) => void;
  onCreateTag?: (name: string, color: string) => Promise<Tag | null>;
  onAddDependency?: (itemId: string, depId: string) => void;
  onRemoveDependency?: (itemId: string, depId: string) => void;
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

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- useCallback est nécessaire
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
              {/* Bandeau de blocage — dépendances non terminées */}
              {deps.filter((d) => !d.doneAt).length > 0 && (
                <div style={{ padding: "14px 18px", background: "rgba(16,16,16,.04)", borderRadius: 18, marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.inkMuted, flex: "none" }}>
                    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
                    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
                  </svg>
                  <span className="text-[13px] font-bold" style={{ color: C.inkMuted }}>
                    Bloquée par {deps.filter((d) => !d.doneAt).length} tâche{deps.filter((d) => !d.doneAt).length > 1 ? "s" : ""}
                  </span>
                  {deps.find((d) => !d.doneAt) && (
                    <button
                      onClick={() => onOpenSibling?.(deps.find((d) => !d.doneAt)!.id)}
                      style={{ marginLeft: "auto", padding: "7px 14px", background: C.ink, color: "#fff", border: "none", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}
                    >
                      Terminer d&apos;abord
                    </button>
                  )}
                </div>
              )}

              {/* Chaîne AVANT / ICI / APRÈS — toujours affichée pour permettre l'ajout */}
              <ChainSection item={item} items={items} deps={deps} projects={projects} onOpenSibling={onOpenSibling} onAddDependency={onAddDependency} onRemoveDependency={onRemoveDependency} />

              {/* Étiquettes */}
              <div style={{ marginBottom: 12 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                  <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint }}>ÉTIQUETTES</span>
                  {item.tags && item.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((tagId) => {
                        const tag = allTags?.find((t) => t.id === tagId);
                        const bg = tag ? (TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.blue) : TAG_COLOR_MAP.blue;
                        const count = items.filter((it) => (it.tags ?? []).includes(tagId)).length;
                        return (
                          <span key={tagId} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, background: bg, fontSize: 12, fontWeight: 700, color: C.ink }}>
                            {tag?.name ?? tagId}
                            {count > 1 && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.6 }}>{count}</span>}
                            {onRemoveTag && (
                              <button onClick={() => onRemoveTag(item.id, tagId)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, opacity: 0.4, color: C.ink }}>×</button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-[13px] font-medium" style={{ color: C.inkFaint }}>Aucune</span>
                  )}
                  {onAddTag && (
                    <TagPicker allTags={allTags ?? []} itemTags={item.tags ?? []} onAdd={(tagId) => onAddTag(item.id, tagId)} onCreateTag={onCreateTag} />
                  )}
                </div>
              </div>

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
                      FIL D&apos;ORIGINE · {new Date(audio.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).toUpperCase()} · {audio.durationSec} S
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

          </div>
        )}
      </div>
    </div>
  );
}