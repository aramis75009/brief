"use client";

/**
 * Écran Kanban desktop — board avec colonnes libres (comme Trello).
 * L'utilisateur crée, nomme et réordonne ses colonnes.
 * Drag & drop des cartes entre colonnes via @dnd-kit.
 */

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanCard } from "./KanbanCard";
import { skinFor, shapeFor } from "@/lib/projects";
import { formatDue } from "@/lib/due";
import type { Item, KanbanBoard, Project, Tag } from "@/lib/types";

const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
} as const;

/* --- Carte draggable --- */

function DraggableCard({
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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { columnId: item.columnId },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        opacity: isDragging ? 0.4 : 1,
        touchAction: "none",
      }}
    >
      <KanbanCard item={item} project={project} tags={tags} onClick={onClick} />
    </div>
  );
}

/* --- Colonne droppable --- */

function KanbanColumnView({
  column,
  items,
  projects,
  tags,
  onOpenTask,
  onRenameColumn,
  onDeleteColumn,
}: {
  column: { id: string; name: string; order: number };
  items: Item[];
  projects: Project[];
  tags: Tag[];
  onOpenTask: (id: string) => void;
  onRenameColumn: (id: string, name: string) => void;
  onDeleteColumn: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);

  return (
    <div
      ref={setNodeRef}
      className="flex h-full min-h-0 w-[300px] flex-none flex-col gap-2"
      style={{
        padding: 14,
        background: isOver ? "rgba(16,16,16,.03)" : C.bg,
        borderRadius: 20,
        border: isOver ? "2px solid rgba(16,16,16,.12)" : "1px solid rgba(16,16,16,.06)",
        transition: "background .15s, border .15s",
      }}
    >
      {/* Header colonne */}
      <div className="flex items-center gap-2">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (name.trim() && name.trim() !== column.name) {
                onRenameColumn(column.id, name.trim());
              } else {
                setName(column.name);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setEditing(false);
                if (name.trim() && name.trim() !== column.name) {
                  onRenameColumn(column.id, name.trim());
                }
              }
              if (e.key === "Escape") {
                setEditing(false);
                setName(column.name);
              }
            }}
            className="flex-1"
            style={{
              padding: "6px 10px",
              background: C.surface,
              border: "1px solid rgba(16,16,16,.12)",
              borderRadius: 8,
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 700,
              color: C.ink,
            }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 text-left"
            style={{
              background: "none",
              border: "none",
              padding: "6px 0",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 700,
              color: C.ink,
            }}
          >
            {column.name}
          </button>
        )}
        <span className="tnum text-[12px] font-bold" style={{ color: C.inkFaint }}>
          {items.length}
        </span>
        <button
          onClick={() => onDeleteColumn(column.id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: C.inkFaint,
            fontSize: 16,
            lineHeight: 1,
          }}
          title="Supprimer la colonne"
        >
          ×
        </button>
      </div>

      {/* Cartes */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {items.map((item) => {
          const project = projects.find((p) => p.id === item.projectId);
          return (
            <DraggableCard
              key={item.id}
              item={item}
              project={project}
              tags={tags}
              onClick={() => onOpenTask(item.id)}
            />
          );
        })}
        {items.length === 0 && (
          <span className="text-[12px] font-medium" style={{ color: C.inkFaint, padding: "12px 4px" }}>
            Glisse une carte ici
          </span>
        )}
      </div>
    </div>
  );
}

/* --- Board --- */

export function DesktopKanban({
  items,
  projects,
  board,
  tags,
  onMoveCard,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
  onOpenTask,
}: {
  items: Item[];
  projects: Project[];
  board: KanbanBoard;
  tags: Tag[];
  onMoveCard: (itemId: string, columnId: string) => void;
  onAddColumn: (name: string) => void;
  onRenameColumn: (columnId: string, name: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onOpenTask: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const columns = [...board.columns].sort((a, b) => a.order - b.order);
  const unplaced = items.filter((it) => !it.columnId && !it.doneAt);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = e;
      if (!over) return;
      const itemId = String(active.id);
      const targetColumnId = String(over.id);
      // Si on drop sur une colonne existante
      if (columns.some((c) => c.id === targetColumnId)) {
        onMoveCard(itemId, targetColumnId);
      }
    },
    [columns, onMoveCard],
  );

  const activeItem = activeId ? items.find((it) => it.id === activeId) : null;
  const activeProject = activeItem ? projects.find((p) => p.id === activeItem.projectId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-3 overflow-x-auto" style={{ animation: "fade .3s both" }}>
        {/* Section non placées (si des cartes existent) */}
        {unplaced.length > 0 && (
          <KanbanColumnView
            column={{ id: "__unplaced", name: "Non placées", order: -1 }}
            items={unplaced}
            projects={projects}
            tags={tags}
            onOpenTask={onOpenTask}
            onRenameColumn={() => {}}
            onDeleteColumn={() => {}}
          />
        )}

        {/* Colonnes du board */}
        {columns.map((col) => {
          const colItems = items.filter((it) => it.columnId === col.id && !it.doneAt);
          return (
            <KanbanColumnView
              key={col.id}
              column={col}
              items={colItems}
              projects={projects}
              tags={tags}
              onOpenTask={onOpenTask}
              onRenameColumn={onRenameColumn}
              onDeleteColumn={onDeleteColumn}
            />
          );
        })}

        {/* Ajouter une colonne */}
        <div className="flex w-[280px] flex-none flex-col gap-2" style={{ padding: 14 }}>
          {addingColumn ? (
            <div className="flex flex-col gap-2" style={{ padding: 14, background: C.bg, borderRadius: 20, border: "1px solid rgba(16,16,16,.06)" }}>
              <input
                autoFocus
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newColumnName.trim()) {
                    onAddColumn(newColumnName.trim());
                    setNewColumnName("");
                    setAddingColumn(false);
                  }
                  if (e.key === "Escape") {
                    setNewColumnName("");
                    setAddingColumn(false);
                  }
                }}
                placeholder="Nom de la liste…"
                style={{
                  padding: "10px 12px",
                  background: C.surface,
                  border: "1px solid rgba(16,16,16,.12)",
                  borderRadius: 12,
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.ink,
                }}
              />
              <button
                onClick={() => {
                  if (newColumnName.trim()) {
                    onAddColumn(newColumnName.trim());
                    setNewColumnName("");
                    setAddingColumn(false);
                  }
                }}
                style={{
                  padding: "10px 12px",
                  background: C.ink,
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Ajouter
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="flex items-center justify-center gap-2"
              style={{
                padding: "14px",
                background: "rgba(16,16,16,.03)",
                border: "1px dashed rgba(16,16,16,.12)",
                borderRadius: 20,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 600,
                color: C.inkMuted,
              }}
            >
              + Ajouter une liste
            </button>
          )}
        </div>
      </div>

      {/* Drag overlay — la carte suit le curseur */}
      <DragOverlay>
        {activeItem ? (
          <div style={{ width: 272, opacity: 0.9 }}>
            <KanbanCard item={activeItem} project={activeProject} tags={tags} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}