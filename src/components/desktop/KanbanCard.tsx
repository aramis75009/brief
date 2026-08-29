"use client";

/**
 * Carte Kanban — affiche une tâche dans une colonne du board.
 * Drag & drop géré par le parent (DesktopKanban) via @dnd-kit.
 * Design : prototype Claude Design "Kanban desktop v2".
 */

import { skinFor, shapeFor } from "@/lib/projects";
import { formatDue } from "@/lib/due";
import type { Item, Project, Shape, Tag } from "@/lib/types";

import { TAG_COLOR_MAP } from "@/lib/tagColors";
const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  danger: "var(--color-danger)",
} as const;


/* --- Pastille projet selon la forme --- */
function swatchStyle(skin: { bg: string } | null, shape: Shape): React.CSSProperties {
  const base: React.CSSProperties = { width: 10, height: 10, flex: "none", borderRadius: "99px", background: skin?.bg ?? "#A9A9A2" };
  if (shape === "square") return { ...base, borderRadius: "2px" };
  if (shape === "diamond") return { ...base, width: 9, height: 9, borderRadius: "2px", transform: "rotate(45deg)" };
  if (shape === "ring") return { ...base, background: "transparent", border: `2px solid ${skin?.bg ?? "#A9A9A2" }` };
  if (shape === "capsule") return { ...base, width: 14, height: 8 };
  return base;
}

/* --- Vérifie si un item est bloqué (au moins une dépendance non terminée) --- */
function isBlocked(item: Item, items: Item[]): boolean {
  if (!item.dependsOn || item.dependsOn.length === 0) return false;
  return item.dependsOn.some((depId) => {
    const dep = items.find((it) => it.id === depId);
    return dep ? !dep.doneAt : false;
  });
}

/* --- Icône cadenas inline --- */
function LockIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#101010" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

/** Une carte est « en retard » si son échéance est passée (horloge réelle). */
function isLate(due: string | null | undefined): boolean {
  return due ? new Date(due).getTime() < Date.now() : false;
}

export function KanbanCard({
  item,
  project,
  tags,
  items,
  onClick,
}: {
  item: Item;
  project: Project | undefined;
  tags: Tag[];
  items?: Item[];
  onClick: () => void;
}) {
  const skin = project ? skinFor(project) : null;
  const shape = project ? shapeFor(project) : "disc";
  const late = isLate(item.due);
  const subtaskCount = item.subtasks?.length ?? 0;
  const subtaskDone = item.subtasks?.filter((s) => s.done).length ?? 0;
  const hasAudio = !!(item.audioOrigin || item.audioId);
  const blocked = items ? isBlocked(item, items) : false;

  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col text-left"
      style={{
        padding: "12px 13px",
        background: C.surface,
        borderRadius: 16,
        border: "1px solid rgba(16,16,16,.06)",
        boxShadow: "0 2px 8px rgba(16,16,16,.04)",
        cursor: "pointer",
        fontFamily: "inherit",
        gap: 0,
      }}
    >
      {/* Tags — barres compactes colorées en haut */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1" style={{ marginBottom: 8 }}>
          {item.tags.slice(0, 4).map((tagId) => {
            const tag = tags.find((t) => t.id === tagId);
            if (!tag) return null;
            const bg = TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.blue;
            return (
              <span
                key={tagId}
                title={tag.name}
                style={{
                  height: 8,
                  width: 28,
                  borderRadius: 99,
                  background: bg,
                  flex: "none",
                }}
              />
            );
          })}
        </div>
      )}

      {/* Badge bloquée */}
      {blocked && (
        <div
          className="inline-flex items-center gap-1.5"
          style={{
            height: 22,
            padding: "0 9px",
            marginBottom: 7,
            borderRadius: 99,
            background: "#F4F4F2",
            fontSize: 11,
            fontWeight: 700,
            color: "#101010",
            width: "fit-content",
          }}
        >
          <LockIcon size={11} />
          bloquée
        </div>
      )}

      {/* Titre */}
      <span
        className="text-[14px] font-semibold tracking-[-0.01em]"
        style={{
          color: item.doneAt ? C.inkFaint : C.ink,
          textDecoration: item.doneAt ? "line-through" : "none",
          lineHeight: 1.3,
          display: "block",
        }}
      >
        {item.title}
      </span>

      {/* Bas de carte — pastille projet + échéance + sous-tâches + waveform */}
      <div className="flex items-center" style={{ gap: 9, marginTop: 9 }}>
        {/* Pastille projet */}
        {project && skin && <span style={swatchStyle(skin, shape)} />}

        {/* Échéance */}
        {item.due && (
          <span className="text-[11px] font-semibold" style={{ color: late ? C.danger : C.inkMuted }}>
            {formatDue(item.due, item.allDay)}
          </span>
        )}

        {/* Compteur sous-tâches avec mini barre de progression */}
        {subtaskCount > 0 && (
          <span className="inline-flex items-center" style={{ gap: 6 }}>
            <span
              style={{
                width: 34,
                height: 4,
                borderRadius: 99,
                background: "rgba(16,16,16,.09)",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  borderRadius: 99,
                  background: "#101010",
                  width: `${subtaskCount > 0 ? Math.round((subtaskDone / subtaskCount) * 100) : 0}%`,
                }}
              />
            </span>
            <span className="tnum text-[11px] font-semibold" style={{ color: C.inkMuted }}>
              {subtaskDone}/{subtaskCount}
            </span>
          </span>
        )}

        {/* Mini waveform si audio */}
        {hasAudio && (
          <span
            title="Issue d'une dictée"
            className="inline-flex items-end"
            style={{ marginLeft: "auto", gap: 2, height: 12 }}
          >
            <span style={{ width: 2, height: 5, borderRadius: 99, background: "#A9A9A2" }} />
            <span style={{ width: 2, height: 10, borderRadius: 99, background: "#A9A9A2" }} />
            <span style={{ width: 2, height: 7, borderRadius: 99, background: "#A9A9A2" }} />
            <span style={{ width: 2, height: 12, borderRadius: 99, background: "#A9A9A2" }} />
          </span>
        )}
      </div>
    </button>
  );
}