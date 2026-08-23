"use client";

/**
 * Cadre desktop — remplace `PhoneFrame` à partir de 1024px (`useIsDesktop`).
 * Les feuilles partagées (Capture, Compte, Aide, Notifications, Chat…)
 * restent rendues par `BriefApp`, exactement comme pour mobile : ce
 * composant ne possède que l'en-tête, la navigation et les cinq écrans
 * propres au desktop.
 */

import { useEffect, useState, useCallback } from "react";
import { DesktopHeader } from "./DesktopHeader";
import { DesktopDashboard } from "./DesktopDashboard";
import { DesktopCalendar } from "./DesktopCalendar";
import { DesktopTasks } from "./DesktopTasks";
import { DesktopKanban } from "./DesktopKanban";
import { DesktopTaskDetail } from "./DesktopTaskDetail";
import { DesktopIdeas } from "./DesktopIdeas";
import { DesktopSettings } from "./DesktopSettings";
import { CommandPalette } from "./CommandPalette";
import { leastUrgentId } from "@/lib/desktopDashboard";
import { fetchBoard, addColumn, renameColumn, deleteColumn, fetchTags } from "@/lib/api";
import type { DesktopScreen } from "./types";
import type { AgendaItem } from "@/lib/agenda";
import type { DraftItem, Item, KanbanBoard, Overview, Project, Tag } from "@/lib/types";

const C = { bg: "var(--color-bg)" } as const;

/** Âge relatif d'un timestamp epoch, en français — pour la ligne CalDAV de « Chaîne & sync ». */
function relativeSyncLabel(lastSyncAt: number | null): string {
  if (lastSyncAt === null) return "jamais synchronisé";
  const minutes = Math.max(0, Math.round((Date.now() - lastSyncAt) / 60_000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}

export function DesktopShell({
  items,
  activeItems,
  ideaItems,
  todayAgenda,
  projects,
  overview,
  transcript,
  calendarSyncAt,
  pushSubscribed,
  onToggleDone,
  onPostpone,
  onArchiveIdea,
  onPromoteIdea,
  onSaveItem,
  onQuickAddTask,
  onDeleteItem,
  onEnablePush,
  onOpenCapture,
  onOpenChat,
  onOpenAccount,
  onOpenNotifications,
}: {
  items: Item[];
  activeItems: Item[];
  ideaItems: Item[];
  todayAgenda: AgendaItem[];
  projects: Project[];
  overview: Overview | null;
  transcript: string;
  calendarSyncAt: number | null;
  pushSubscribed: boolean;
  onToggleDone: (id: string, completedAt?: string | null) => void;
  onPostpone: (id: string) => void;
  onArchiveIdea: (id: string) => void;
  onPromoteIdea: (id: string) => void;
  onSaveItem: (id: string, patch: Partial<DraftItem>) => Promise<boolean>;
  onQuickAddTask: (title: string, projectId: string) => void;
  onDeleteItem: (id: string) => void;
  onEnablePush: () => void;
  onOpenCapture: () => void;
  onOpenChat: () => void;
  onOpenAccount: () => void;
  onOpenNotifications: () => void;
}) {
  const [screen, setScreen] = useState<DesktopScreen>("dashboard");
  const [calendarSelectedId, setCalendarSelectedId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [board, setBoard] = useState<KanbanBoard>({ columns: [], updatedAt: "" });
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        setPaletteQuery("");
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Charger le board et les tags au démarrage
  useEffect(() => {
    (async () => {
      try {
        const [b, t] = await Promise.all([fetchBoard(), fetchTags()]);
        setBoard(b);
        setTags(t);
      } catch {
        // Non bloquant — le Kanban affichera des colonnes vides
      }
    })();
  }, []);

  const handleAddColumn = useCallback(async (name: string) => {
    try {
      const b = await addColumn(name);
      setBoard(b);
    } catch { /* silencieux */ }
  }, []);

  const handleRenameColumn = useCallback(async (id: string, name: string) => {
    try {
      const b = await renameColumn(id, name);
      setBoard(b);
    } catch { /* silencieux */ }
  }, []);

  const handleDeleteColumn = useCallback(async (id: string) => {
    try {
      const b = await deleteColumn(id);
      setBoard(b);
    } catch { /* silencieux */ }
  }, []);

  const handleMoveCard = useCallback(async (itemId: string, columnId: string) => {
    try {
      await onSaveItem(itemId, { columnId });
    } catch { /* silencieux */ }
  }, [onSaveItem]);

  const handleToggleSub = useCallback(async (itemId: string, subId: string) => {
    const item = items.find((it) => it.id === itemId);
    if (!item?.subtasks) return;
    const subtasks = item.subtasks.map((s) => s.id === subId ? { ...s, done: !s.done } : s);
    try { await onSaveItem(itemId, { subtasks }); } catch { /* silencieux */ }
  }, [items, onSaveItem]);

  const handleAddSubtask = useCallback(async (itemId: string, title: string) => {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    const subtasks = [...(item.subtasks ?? []), { id: `sub-${Date.now().toString(36)}`, title: title.trim(), done: false }];
    try { await onSaveItem(itemId, { subtasks }); } catch { /* silencieux */ }
  }, [items, onSaveItem]);

  const [detailId, setDetailId] = useState<string | null>(null);

  const detailItem = detailId ? items.find((it) => it.id === detailId) ?? null : null;

  const openTask = (id: string) => {
    setDetailId(id);
    setScreen("détail");
  };

  const onLighten = () => {
    const candidate = overview?.peak ? leastUrgentId(overview.peak.items) : null;
    if (candidate) onPostpone(candidate);
  };

  const badges: Partial<Record<DesktopScreen, number>> = {
    calendrier: (overview?.horizon ?? []).filter((d) => d.isToday).reduce((n, d) => n + d.events, 0),
    tâches: activeItems.filter((it) => it.kind === "task" && !it.doneAt).length,
    idées: ideaItems.length,
  };

  return (
    <>
      <div className="h-dvh w-full overflow-hidden" style={{ background: C.bg, padding: "16px 20px 20px" }}>
        <div className="mx-auto flex h-full flex-col gap-3" style={{ maxWidth: 1560, minWidth: 1024 }}>
          <DesktopHeader
            screen={screen}
            badges={badges}
            onNavigate={setScreen}
            onOpenPalette={() => { setPaletteOpen(true); setPaletteQuery(""); }}
            onOpenNotifications={onOpenNotifications}
            onOpenAccount={onOpenAccount}
            onCapture={onOpenCapture}
          />

          <div className="min-h-0 flex-1">
          {screen === "dashboard" && (
            <DesktopDashboard
              items={items}
              ideaItems={ideaItems}
              todayAgenda={todayAgenda}
              projects={projects}
              overview={overview}
              transcript={transcript}
              onToggleDone={onToggleDone}
              onOpenTask={openTask}
              onOpenCapture={onOpenCapture}
              onOpenChat={onOpenChat}
              onGoTasks={() => setScreen("tâches")}
            />
          )}

          {screen === "calendrier" && (
            <DesktopCalendar
              items={items}
              projects={projects}
              selectedId={calendarSelectedId}
              onSelect={setCalendarSelectedId}
              onToggleDone={onToggleDone}
              onPostpone={onPostpone}
            />
          )}

          {screen === "tâches" && (
            <DesktopTasks
              items={activeItems}
              projects={projects}
              onToggleDone={onToggleDone}
              onOpenTask={openTask}
              onPostpone={onPostpone}
              onQuickAdd={onQuickAddTask}
            />
          )}

          {screen === "kanban" && (
            <DesktopKanban
              items={activeItems}
              projects={projects}
              board={board}
              tags={tags}
              onMoveCard={handleMoveCard}
              onAddColumn={handleAddColumn}
              onRenameColumn={handleRenameColumn}
              onDeleteColumn={handleDeleteColumn}
              onOpenTask={openTask}
            />
          )}

          {screen === "détail" && (
            <DesktopTaskDetail
              item={detailItem}
              items={items}
              projects={projects}
              onBack={() => setScreen("dashboard")}
              onDone={onToggleDone}
              onPostpone={onPostpone}
              onDelete={(id) => { onDeleteItem(id); setScreen("dashboard"); }}
              onToggleSub={handleToggleSub}
              onAddSubtask={handleAddSubtask}
              onOpenSibling={(id) => { setDetailId(id); }}
              onSave={onSaveItem}
            />
          )}

          {screen === "idées" && (
            <DesktopIdeas
              ideas={ideaItems}
              projects={projects}
              onPromote={onPromoteIdea}
              onReroute={(id, projectId) => void onSaveItem(id, { projectId })}
              onArchive={onArchiveIdea}
            />
          )}

          {screen === "réglages" && (
            <DesktopSettings
              projects={projects}
              overview={overview}
              calendarSyncLabel={relativeSyncLabel(calendarSyncAt)}
              pushSubscribed={pushSubscribed}
              onEnablePush={onEnablePush}
            />
          )}
          </div>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        query={paletteQuery}
        onQueryChange={setPaletteQuery}
        onClose={() => setPaletteOpen(false)}
        items={items}
        projects={projects}
        onOpenItem={openTask}
        onDictate={onOpenCapture}
        onGoCalendar={() => setScreen("calendrier")}
        onGoIdeas={() => setScreen("idées")}
        onLighten={onLighten}
      />
    </>
  );
}
