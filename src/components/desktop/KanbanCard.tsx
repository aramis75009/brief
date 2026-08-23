"use client";

/**
 * Carte Kanban — affiche une tâche dans une colonne du board.
 * Drag & drop géré par le parent (DesktopKanban) via @dnd-kit.
 */

import { skinFor, shapeFor } from "@/lib/projects";
import { formatDue } from "@/lib/due";
import type { Item, Project, Tag } from "@/lib/types";

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

export function KanbanCard({
  item,
  project,
  tags,
  onClick,
}: {
  item: Item;
  project: Project | undefined;
  tags: Tag[];
  onClick: () => void;
}) {
  const skin = project ? skinFor(project) : null;
  const shape = project ? shapeFor(project) : "disc";
  const late = item.due ? new Date(item.due).getTime() < Date.now() : false;
  const subtaskCount = item.subtasks?.length ?? 0;
  const subtaskDone = item.subtasks?.filter((s) => s.done).length ?? 0;
  const depCount = item.dependsOn?.length ?? 0;

  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col gap-2 text-left"
      style={{
        padding: 14,
        background: C.surface,
        borderRadius: 16,
        border: "1px solid rgba(16,16,16,.06)",
        boxShadow: "0 2px 8px rgba(16,16,16,.04)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 4).map((tagId) => {
            const tag = tags.find((t) => t.id === tagId);
            if (!tag) return null;
            const bg = TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.blue;
            return (
              <span
                key={tagId}
                style={{
                  height: 8,
                  width: 32,
                  borderRadius: 99,
                  background: bg,
                  flex: "none",
                }}
              />
            );
          })}
        </div>
      )}

      {/* Titre */}
      <span
        className="text-[14px] font-semibold tracking-[-0.01em]"
        style={{
          color: item.doneAt ? C.inkFaint : C.ink,
          textDecoration: item.doneAt ? "line-through" : "none",
          lineHeight: 1.3,
        }}
      >
        {item.title}
      </span>

      {/* Métadonnées */}
      <div className="flex items-center gap-2">
        {project && skin && (
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: shape === "square" ? 2 : 99,
              background: skin.bg,
              flex: "none",
            }}
          />
        )}
        {item.due && (
          <span
            className="text-[11px] font-semibold"
            style={{ color: late ? C.danger : C.inkMuted }}
          >
            {formatDue(item.due, item.allDay)}
          </span>
        )}
        {subtaskCount > 0 && (
          <span className="text-[11px] font-medium" style={{ color: C.inkMuted }}>
            {subtaskDone}/{subtaskCount}
          </span>
        )}
        {depCount > 0 && (
          <span className="text-[11px] font-medium" style={{ color: C.inkMuted }}>
            ⚠ {depCount}
          </span>
        )}
      </div>
    </button>
  );
}