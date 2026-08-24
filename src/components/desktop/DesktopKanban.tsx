"use client";

/**
 * Écran Kanban desktop — board avec colonnes libres (comme Trello).
 * L'utilisateur crée, nomme et réordonne ses colonnes.
 * Drag & drop des cartes entre colonnes via @dnd-kit.
 * Design : prototype Claude Design "Kanban desktop v2".
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
  items,
  onClick,
}: {
  item: Item;
  project: Project | undefined;
  tags: Tag[];
  items: Item[];
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
      <KanbanCard item={item} project={project} tags={tags} items={items} onClick={onClick} />
    </div>
  );
}

/* --- Carte pilule (section non placées) --- */

function DraggablePill({
  item,
  project,
  onClick,
}: {
  item: Item;
  project: Project | undefined;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { columnId: item.columnId },
  });
  const skin = project ? skinFor(project) : null;
  const shape = project ? shapeFor(project) : "disc";
  const radius = shape === "square" || shape === "diamond" ? "2px" : "99px";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="flex items-center"
      style={{
        gap: 9,
        height: 36,
        padding: "0 12px",
        background: C.bg,
        borderRadius: 99,
        cursor: "grab",
        flex: "none",
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {skin && (
        <span style={{ width: 8, height: 8, borderRadius: radius, background: skin.bg, flex: "none" }} />
      )}
      <span className="text-[13px] font-semibold" style={{ whiteSpace: "nowrap", color: C.ink }}>
        {item.title}
      </span>
    </div>
  );
}

/* --- Colonne droppable --- */

function KanbanColumnView({
  column,
  items,
  allItems,
  projects,
  tags,
  wipLimit,
  onOpenTask,
  onRenameColumn,
  onDeleteColumn,
}: {
  column: { id: string; name: string; order: number };
  items: Item[];
  allItems: Item[];
  projects: Project[];
  tags: Tag[];
  wipLimit?: number;
  onOpenTask: (id: string) => void;
  onRenameColumn: (id: string, name: string) => void;
  onDeleteColumn: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const [menuOpen, setMenuOpen] = useState(false);

  const overWip = wipLimit !== undefined && items.length > wipLimit;

  return (
    <div
      ref={setNodeRef}
      className="flex h-full min-h-0 w-[300px] flex-none flex-col"
      style={{
        background: isOver ? "#FFFFFF" : "rgba(16,16,16,.03)",
        borderRadius: 20,
        border: isOver ? "1px solid rgba(16,16,16,.20)" : "1px solid rgba(16,16,16,.06)",
        transition: "background .15s, border .15s",
      }}
    >
      {/* Header colonne */}
      <div className="flex items-center" style={{ gap: 9, padding: "13px 14px 10px", flex: "none" }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: "#A9A9A2", flex: "none" }} />
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
              letterSpacing: "-0.01em",
            }}
          >
            {column.name}
          </button>
        )}
        {/* Compteur dans pill */}
        <span
          className="tnum"
          style={{
            minWidth: 20,
            padding: "2px 6px",
            borderRadius: 99,
            background: C.surface,
            border: "1px solid rgba(16,16,16,.06)",
            fontSize: 10,
            fontWeight: 700,
            textAlign: "center",
            color: C.inkMuted,
          }}
        >
          {items.length}
        </span>
        {/* WIP limit */}
        {wipLimit !== undefined && wipLimit > 0 && (
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.09em",
              color: overWip ? "var(--color-danger)" : C.inkFaint,
            }}
          >
            LIMITE {wipLimit}
          </span>
        )}
        {/* Boutons +/⋯ */}
        <button
          onClick={() => onDeleteColumn(column.id)}
          aria-label="Ajouter une carte"
          style={{
            width: 26,
            height: 26,
            flex: "none",
            borderRadius: 99,
            border: "1px solid rgba(16,16,16,.1)",
            background: C.surface,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 700,
            color: C.ink,
            lineHeight: 1,
          }}
        >
          +
        </button>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Options de la liste"
          style={{
            width: 26,
            height: 26,
            flex: "none",
            borderRadius: 99,
            border: "1px solid rgba(16,16,16,.1)",
            background: C.surface,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            color: C.inkMuted,
            lineHeight: 1,
          }}
        >
          ⋯
        </button>
      </div>

      {/* Menu déroulant */}
      {menuOpen && (
        <div
          style={{
            margin: "0 12px 8px",
            padding: 6,
            background: C.surface,
            border: "1px solid rgba(16,16,16,.08)",
            borderRadius: 12,
            boxShadow: "0 6px 20px rgba(16,16,16,.07)",
          }}
        >
          <button
            onClick={() => { setEditing(true); setMenuOpen(false); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.ink }}
          >
            Renommer la liste
          </button>
          <button
            onClick={() => { setMenuOpen(false); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.ink }}
          >
            Définir une limite (WIP)
          </button>
          <button
            onClick={() => { onDeleteColumn(column.id); setMenuOpen(false); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--color-danger)" }}
          >
            Vider et supprimer
          </button>
        </div>
      )}

      {/* Cartes */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ gap: 8, padding: "0 12px 12px" }}>
        {items.map((item) => {
          const project = projects.find((p) => p.id === item.projectId);
          return (
            <DraggableCard
              key={item.id}
              item={item}
              project={project}
              tags={tags}
              items={allItems}
              onClick={() => onOpenTask(item.id)}
            />
          );
        })}
        {items.length === 0 && (
          <div
            className="flex items-center justify-center"
            style={{
              height: 74,
              border: "1px dashed rgba(16,16,16,.14)",
              borderRadius: 16,
              fontSize: 12,
              fontWeight: 600,
              color: C.inkFaint,
            }}
          >
            Déposer une carte ici
          </div>
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
  const [activeProjectFilter, setActiveProjectFilter] = useState<string | null>(null);
  const [showUnplaced, setShowUnplaced] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const columns = [...board.columns].sort((a, b) => a.order - b.order);
  const allUnplaced = items.filter((it) => !it.columnId && !it.doneAt);

  // Filtre par projet
  const visibleItems = activeProjectFilter
    ? items.filter((it) => it.projectId === activeProjectFilter)
    : items;

  const unplaced = visibleItems.filter((it) => !it.columnId && !it.doneAt);
  const openCount = visibleItems.filter((it) => !it.doneAt).length;

  // Projets représentés dans les items
  const projectIdsInUse = new Set(items.filter((it) => !it.doneAt && it.projectId).map((it) => it.projectId));
  const filterProjects = projects.filter((p) => projectIdsInUse.has(p.id));

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
    <div className="flex h-full flex-col overflow-hidden" style={{ animation: "fade .3s both" }}>
      {/* En-tête : Titre + filtres + Non placées */}
      <div className="flex items-center flex-none" style={{ gap: 12, margin: "0 2px 12px" }}>
        <h1 className="text-[22px] font-extrabold" style={{ margin: 0, letterSpacing: "-0.02em", color: C.ink }}>
          Kanban
        </h1>
        <span className="tnum text-[13px] font-bold" style={{ color: C.inkFaint }}>
          {openCount} ouvertes
        </span>

        {/* Filtres projets */}
        <div className="flex" style={{ gap: 6, marginLeft: 8 }}>
          {filterProjects.map((p) => {
            const skin = skinFor(p);
            const shape = shapeFor(p);
            const radius = shape === "square" || shape === "diamond" ? "2px" : "99px";
            const on = activeProjectFilter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActiveProjectFilter(on ? null : p.id)}
                className="inline-flex items-center"
                style={{
                  gap: 7,
                  height: 30,
                  padding: "0 12px",
                  borderRadius: 99,
                  border: `1px solid ${on ? "#101010" : "rgba(16,16,16,.08)"}`,
                  background: on ? "#101010" : C.surface,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  color: on ? "#FFFFFF" : C.ink,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: radius, background: skin.bg, flex: "none" }} />
                {p.name}
              </button>
            );
          })}
        </div>

        {/* Bouton Non placées */}
        <div className="flex items-center" style={{ marginLeft: "auto", gap: 8 }}>
          <button
            onClick={() => setShowUnplaced(!showUnplaced)}
            className="flex items-center"
            style={{
              gap: 8,
              height: 36,
              padding: "0 14px",
              borderRadius: 99,
              border: "1px solid rgba(16,16,16,.12)",
              background: C.surface,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              color: C.ink,
            }}
          >
            Non placées
            <span
              className="tnum"
              style={{
                minWidth: 18,
                padding: "2px 5px",
                borderRadius: 99,
                background: C.bg,
                fontSize: 10,
                fontWeight: 700,
                textAlign: "center",
                color: C.inkMuted,
              }}
            >
              {allUnplaced.length}
            </span>
            <span style={{ color: C.inkFaint }}>{showUnplaced ? "−" : "+"}</span>
          </button>
        </div>
      </div>

      {/* Section non placées — barre horizontale */}
      {showUnplaced && allUnplaced.length > 0 && (
        <div
          className="flex items-center flex-none"
          style={{
            gap: 10,
            padding: "10px 12px",
            marginBottom: 12,
            background: C.surface,
            border: "1px dashed rgba(16,16,16,.14)",
            borderRadius: 18,
            animation: "fade .2s both",
          }}
        >
          <span
            className="font-mono flex-none"
            style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint, paddingLeft: 4 }}
          >
            NON PLACÉES
          </span>
          <div className="flex overflow-x-auto" style={{ gap: 8 }}>
            {allUnplaced.map((item) => {
              const project = projects.find((p) => p.id === item.projectId);
              return (
                <DraggablePill
                  key={item.id}
                  item={item}
                  project={project}
                  onClick={() => onOpenTask(item.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Colonnes + ajout */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto" style={{ paddingBottom: 6 }}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Colonnes du board */}
          {columns.map((col) => {
            const colItems = visibleItems.filter((it) => it.columnId === col.id && !it.doneAt);
            return (
              <KanbanColumnView
                key={col.id}
                column={col}
                items={colItems}
                allItems={items}
                projects={projects}
                tags={tags}
                onOpenTask={onOpenTask}
                onRenameColumn={onRenameColumn}
                onDeleteColumn={onDeleteColumn}
              />
            );
          })}

          {/* Ajouter une colonne */}
          <div className="flex w-[250px] flex-none flex-col" style={{ paddingTop: 2 }}>
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
                className="flex items-center justify-center"
                style={{
                  width: "100%",
                  height: 46,
                  background: "rgba(16,16,16,.03)",
                  border: "1px dashed rgba(16,16,16,.14)",
                  borderRadius: 20,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.inkMuted,
                  gap: 8,
                }}
              >
                + Ajouter une liste
              </button>
            )}
            {/* Note en bas */}
            <p className="text-[11px] font-medium leading-[1.5]" style={{ margin: "12px 4px 0", color: C.inkFaint }}>
              Une liste vide se supprime seule au bout de 30 jours. Les colonnes gardent l&apos;ordre défini ici.
            </p>
          </div>

          {/* Drag overlay — la carte suit le curseur */}
          <DragOverlay>
            {activeItem ? (
              <div style={{ width: 272, opacity: 0.9 }}>
                <KanbanCard item={activeItem} project={activeProject} tags={tags} items={items} onClick={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}