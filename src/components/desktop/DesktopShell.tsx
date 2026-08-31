"use client";

/**
 * Cadre desktop — remplace `PhoneFrame` à partir de 1024px (`useIsDesktop`).
 * Les feuilles partagées (Capture, Compte, Aide, Notifications, Chat…)
 * restent rendues par `BriefApp`, exactement comme pour mobile : ce
 * composant ne possède que l'en-tête, la navigation et les cinq écrans
 * propres au desktop.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { DesktopHeader } from "./DesktopHeader";
import { DesktopDashboard } from "./DesktopDashboard";
import { DesktopCalendar } from "./DesktopCalendar";
import { DesktopTasks } from "./DesktopTasks";
import { DesktopKanban } from "./DesktopKanban";
import { DesktopObjectives } from "./DesktopObjectives";
import { DependencyGraph } from "./DependencyGraph";
import { DesktopTaskDetail } from "./DesktopTaskDetail";
import { DesktopIdeas } from "./DesktopIdeas";
import { DesktopSettings } from "./DesktopSettings";
import { CommandPalette } from "./CommandPalette";
import { leastUrgentId, type TaskKindFilter } from "@/lib/desktopDashboard";
import { fallbackProjectId } from "@/lib/projects";
import { graphStatus, graphTasks, indexById } from "@/lib/graph";
import { fetchBoard, addColumn, renameColumn, deleteColumn, reorderColumns, setColumnWip, moveCard, fetchTags, createTag, fetchObjectives, createObjective, updateObjective, deleteObjective } from "@/lib/api";
import type { DesktopScreen } from "./types";
import type { AgendaItem } from "@/lib/agenda";
import type { DraftItem, Item, KanbanBoard, Objective, ObjectiveHorizon, Overview, Project, Tag, ToastKind } from "@/lib/types";

const C = { bg: "var(--color-bg)" } as const;

/** Âge relatif d'un timestamp epoch, en français — pour la ligne CalDAV de « Chaîne & sync ». */
export function DesktopShell({
  items,
  activeItems,
  ideaItems,
  todayAgenda,
  projects,
  overview,
  transcript,
  pushSubscribed,
  onToggleDone,
  onPostpone,
  onArchiveIdea,
  onPromoteIdea,
  onSaveItem,
  onQuickAddTask,
  onRefreshItems,
  onFlash,
  onDeleteItem,
  onEnablePush,
  onOpenCapture,
  onOpenChat,
  onLogout,
  onOpenNotifications,
}: {
  items: Item[];
  activeItems: Item[];
  ideaItems: Item[];
  todayAgenda: AgendaItem[];
  projects: Project[];
  overview: Overview | null;
  transcript: string;
  pushSubscribed: boolean;
  onToggleDone: (id: string, completedAt?: string | null) => void;
  onPostpone: (id: string) => void;
  onArchiveIdea: (id: string) => void;
  onPromoteIdea: (id: string) => void;
  onSaveItem: (id: string, patch: Partial<DraftItem>) => Promise<boolean>;
  onQuickAddTask: (title: string, projectId: string, columnId?: string) => void;
  /** Relit les items depuis le serveur — après un geste qui écrit hors `onSaveItem`. */
  onRefreshItems: () => Promise<void>;
  /** Le bandeau de `BriefApp`. Un dépôt qui échoue doit se voir (`TODOS.md` P3 #8). */
  onFlash: (msg: string, kind?: ToastKind) => void;
  onDeleteItem: (id: string) => void;
  onEnablePush: () => void;
  onOpenCapture: () => void;
  onOpenChat: () => void;
  /** Termine la session — le desktop n'avait aucun moyen de le faire avant le 2026-08-30. */
  onLogout: () => void;
  onOpenNotifications: () => void;
}) {
  const [screen, setScreen] = useState<DesktopScreen>("dashboard");
  const [tasksKind, setTasksKind] = useState<TaskKindFilter>("all");
  const [calendarSelectedId, setCalendarSelectedId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [board, setBoard] = useState<KanbanBoard>({ columns: [], updatedAt: "" });
  const [tags, setTags] = useState<Tag[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);

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

  // Charger le board, les tags et les objectifs au démarrage
  useEffect(() => {
    (async () => {
      try {
        const [b, t, o] = await Promise.all([fetchBoard(), fetchTags(), fetchObjectives()]);
        setBoard(b);
        setTags(t);
        setObjectives(o);
      } catch {
        // Non bloquant — le Kanban affichera des colonnes vides
      }
    })();
  }, []);

  /**
   * ⚠️ Les gestes du board ne sont plus muets.
   *
   * Les cinq `catch` vides d'origine faisaient revenir la carte à sa place
   * sans un mot : indiscernable d'un dépôt refusé, d'une session expirée ou
   * d'une panne réseau. Le succès, lui, reste muet — Trello ne dit
   * rien quand un déplacement marche.
   */
  const handleAddColumn = useCallback(async (name: string) => {
    try {
      setBoard(await addColumn(name));
    } catch {
      onFlash("La liste n'a pas été créée.", "err");
    }
  }, [onFlash]);

  const handleRenameColumn = useCallback(async (id: string, name: string) => {
    try {
      setBoard(await renameColumn(id, name));
    } catch {
      onFlash("Le nom n'a pas été enregistré.", "err");
    }
  }, [onFlash]);

  const handleDeleteColumn = useCallback(async (id: string, _cardCount: number) => {
    try {
      setBoard(await deleteColumn(id));
      // Relecture INCONDITIONNELLE. `cardCount` vient du `items` du client,
      // qui peut être en retard : une carte posée sur cette colonne depuis un
      // autre onglet, par l'iPhone ou par la synchro CalDAV donne `0` ici alors
      // que le serveur en détache une. On sauterait alors le rafraîchissement,
      // et cette carte garderait côté client un `columnId` mort — elle ne
      // s'afficherait ni dans une colonne ni dans « Non placées ». C'est
      // exactement la disparition que cette PR corrige.
      await onRefreshItems();
    } catch {
      onFlash("La liste n'a pas été supprimée.", "err");
    }
  }, [onFlash, onRefreshItems]);

  const handleSetWip = useCallback(async (columnId: string, limit: number | null) => {
    try {
      setBoard(await setColumnWip(columnId, limit));
    } catch {
      onFlash("La limite n'a pas été enregistrée.", "err");
    }
  }, [onFlash]);

  const handleReorderColumns = useCallback(async (ids: string[]) => {
    try {
      setBoard(await reorderColumns(ids));
    } catch {
      onFlash("L'ordre des listes n'a pas été enregistré.", "err");
      try { setBoard(await fetchBoard()); } catch { /* le board affiché reste celui d'avant */ }
    }
  }, [onFlash]);

  /**
   * Déplacement d'une carte. On envoie une INTENTION (les voisins au point de
   * dépôt), jamais des rangs : l'écran ne voit qu'une partie de la colonne.
   * Le serveur numérote, on relit.
   *
   * Ne passe PAS par `onSaveItem` : celui-ci flashe « Modifications
   * enregistrées » à chaque appel — un dépôt en produirait un par carte
   * renumérotée.
   */
  const handleMoveCard = useCallback(
    async (intent: { itemId: string; toColumnId: string | null; beforeId?: string; afterId?: string }) => {
      try {
        await moveCard(intent);
      } catch {
        onFlash("Le déplacement n'a pas été enregistré.", "err");
      }
      // Dans les deux cas : on relit. Après un succès pour prendre les rangs
      // que le serveur a calculés, après un échec pour que la carte revienne à
      // sa place SERVEUR et non à celle qu'on croyait.
      //
      // Le `catch` est indispensable : si c'est le réseau qui est tombé, cette
      // relecture échoue aussi, et un rejet non capturé ici remonterait dans le
      // `.finally` de `DesktopKanban` sans que rien ne l'attrape.
      try {
        await onRefreshItems();
      } catch { /* l'état affiché reste celui d'avant — le toast a déjà parlé */ }
    },
    [onFlash, onRefreshItems],
  );

  /** Le « + » d'une colonne crée une vraie carte, en bas, sur le projet filtré. */
  const handleAddCard = useCallback(
    (columnId: string, title: string, projectId: string | null) => {
      onQuickAddTask(title, projectId ?? fallbackProjectId(projects), columnId);
    },
    [onQuickAddTask, projects],
  );

  /** Recharge les objectifs — l'auto-complétion (`reconcileObjectives`, côté
   * serveur) peut avoir clos ou rouvert un objectif après une mutation d'item. */
  const refreshObjectives = useCallback(async () => {
    try {
      setObjectives(await fetchObjectives());
    } catch { /* silencieux — l'état courant reste affiché */ }
  }, []);

  /**
   * Un seul chemin d'écriture pour « A dépend de B », partagé par la fiche
   * tâche et par le tirage de lien de la vue Graphe. Deux copies du même
   * `dependsOn` finiraient par diverger sur un détail (doublon, garde-fou).
   *
   * `targetId` préfixé `obj:` → c'est la dépendance d'un OBJECTIF ; sinon
   * celle d'un item.
   */
  const handleAddDependency = useCallback(async (targetId: string, depId: string) => {
    if (targetId.startsWith("obj:")) {
      const objId = targetId.slice(4);
      const obj = objectives.find((o) => o.id === objId);
      if (!obj || (obj.dependsOn ?? []).includes(depId)) return;
      // Le serveur réconcilie ; l'objectif peut revenir atteint/rouvert.
      const updated = await updateObjective(objId, { dependsOn: [...(obj.dependsOn ?? []), depId] });
      setObjectives((prev) => prev.map((o) => (o.id === objId ? updated : o)));
      return;
    }
    const it = items.find((i) => i.id === targetId);
    if (!it || (it.dependsOn ?? []).includes(depId)) return;
    // La réconciliation des objectifs est déclenchée par l'effet `itemsObjectiveSig`
    // quand `items` reflète le nouveau `dependsOn`.
    await onSaveItem(targetId, { dependsOn: [...(it.dependsOn ?? []), depId] });
  }, [items, objectives, onSaveItem]);

  const handleRemoveDependency = useCallback(async (targetId: string, depId: string) => {
    if (targetId.startsWith("obj:")) {
      const objId = targetId.slice(4);
      const obj = objectives.find((o) => o.id === objId);
      // Dépendance EXPLICITE (`dependsOn`) : on la retire de l'objectif.
      if (obj && (obj.dependsOn ?? []).includes(depId)) {
        const updated = await updateObjective(objId, {
          dependsOn: (obj.dependsOn ?? []).filter((d) => d !== depId),
        });
        setObjectives((prev) => prev.map((o) => (o.id === objId ? updated : o)));
        return;
      }
      // Dépendance IMPLICITE : une tâche qui pointe sur cet objectif — on la détache.
      const linked = items.find((i) => i.id === depId && i.objectiveId === objId);
      if (linked) await onSaveItem(depId, { objectiveId: null });
      return;
    }
    const it = items.find((i) => i.id === targetId);
    if (!it) return;
    await onSaveItem(targetId, { dependsOn: (it.dependsOn ?? []).filter((d) => d !== depId) });
  }, [items, objectives, onSaveItem]);

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

  /* --- Objectifs --- */

  const handleCreateObjective = useCallback(async (title: string, projectId: string, horizon: ObjectiveHorizon) => {
    const created = await createObjective(title, projectId, horizon);
    setObjectives((prev) => [...prev, created]);
  }, []);

  const handleAchieveObjective = useCallback(async (id: string) => {
    // Geste explicite → collant : `reconcileObjectives` ne le rouvrira pas.
    const updated = await updateObjective(id, {
      achievedAt: new Date().toISOString(),
      achievedManually: true,
    });
    setObjectives((prev) => prev.map((o) => (o.id === id ? updated : o)));
  }, []);

  const handleDeleteObjective = useCallback(async (id: string) => {
    await deleteObjective(id);
    setObjectives((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const handleEditObjective = useCallback(
    async (id: string, patch: { title?: string; horizon?: ObjectiveHorizon; notes?: string }) => {
      const updated = await updateObjective(id, patch);
      setObjectives((prev) => prev.map((o) => (o.id === id ? updated : o)));
    },
    [],
  );

  const handleReopenObjective = useCallback(async (id: string) => {
    const updated = await updateObjective(id, { achievedAt: null, achievedManually: false });
    setObjectives((prev) => prev.map((o) => (o.id === id ? updated : o)));
  }, []);

  /* Auto-complétion : cocher une tâche, la (dé)lier à un objectif ou changer
     ses dépendances peut clore ou rouvrir un objectif côté serveur
     (`reconcileObjectives`). On recharge les objectifs quand une de ces
     signatures bouge — jamais sur un simple re-render. */
  const itemsObjectiveSig = useMemo(
    () =>
      items
        .map((it) => `${it.id}:${it.doneAt ? 1 : 0}:${it.objectiveId ?? ""}:${(it.dependsOn ?? []).join(",")}`)
        .join("|"),
    [items],
  );
  useEffect(() => {
    const id = setTimeout(() => void refreshObjectives(), 250);
    return () => clearTimeout(id);
  }, [itemsObjectiveSig, refreshObjectives]);

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

  // Le badge « Graphe » compte les tâches bloquées : c'est le seul chiffre que
  // cette vue apprend et qu'aucun autre onglet ne montre.
  const blockedCount = useMemo(() => {
    const tasks = graphTasks(activeItems);
    const byId = indexById(tasks);
    return tasks.filter((t) => graphStatus(t, byId) === "blocked").length;
  }, [activeItems]);

  const badges: Partial<Record<DesktopScreen, number>> = {
    calendrier: (overview?.horizon ?? []).filter((d) => d.isToday).reduce((n, d) => n + d.events, 0),
    // L'onglet Tâches & RDV montre les deux par défaut : le badge compte les
    // tâches ET les RDV actifs non faits.
    tâches: activeItems.filter((it) => !it.doneAt).length,
    graphe: blockedCount,
    idées: ideaItems.length,
  };

  return (
    <>
      <div className="h-dvh w-full overflow-hidden" style={{ background: C.bg, padding: "16px 20px 20px" }}>
        <div className="mx-auto flex h-full flex-col gap-3" style={{ maxWidth: 1560, minWidth: 1024 }}>
          {/* L'avatar ouvre l'écran Réglages, il n'ouvre plus le sheet mobile
              (décision Aramis du 2026-08-30). `AccountSheet` reste le chemin
              du mobile, inchangé. */}
          <DesktopHeader
            screen={screen}
            badges={badges}
            onNavigate={setScreen}
            onOpenPalette={() => { setPaletteOpen(true); setPaletteQuery(""); }}
            onOpenNotifications={onOpenNotifications}
            onOpenAccount={() => setScreen("réglages")}
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
              onGoTasksKind={(kind) => { setTasksKind(kind); setScreen("tâches"); }}
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
              initialKind={tasksKind}
            />
          )}

          {screen === "kanban" && (
            <DesktopKanban
              items={activeItems}
              projects={projects}
              board={board}
              tags={tags}
              onMoveCard={handleMoveCard}
              onReorderColumns={handleReorderColumns}
              onAddColumn={handleAddColumn}
              onRenameColumn={handleRenameColumn}
              onDeleteColumn={handleDeleteColumn}
              onSetWip={handleSetWip}
              onAddCard={handleAddCard}
              onOpenTask={openTask}
            />
          )}

          {screen === "graphe" && (
            <DependencyGraph
              items={activeItems}
              projects={projects}
              tags={tags}
              objectives={objectives}
              onOpenTask={openTask}
              onOpenObjectives={() => setScreen("objectifs")}
              onAddDependency={handleAddDependency}
              onRemoveDependency={handleRemoveDependency}
            />
          )}

          {screen === "objectifs" && (
            <DesktopObjectives
              objectives={objectives}
              items={items}
              projects={projects}
              onOpenTask={openTask}
              onToggleDone={(id) => onToggleDone(id)}
              onCreateObjective={handleCreateObjective}
              onAchieveObjective={handleAchieveObjective}
              onDeleteObjective={handleDeleteObjective}
              onEditObjective={handleEditObjective}
              onReopenObjective={handleReopenObjective}
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
              allTags={tags}
              onCreateTag={async (name, color) => {
                try {
                  const tag = await createTag(name, color);
                  setTags((t) => [...t, tag]);
                  return tag;
                } catch { return null; }
              }}
              onAddTag={async (itemId, tagId) => {
                const it = items.find((i) => i.id === itemId);
                if (!it) return;
                const newTags = [...(it.tags ?? []), tagId];
                await onSaveItem(itemId, { tags: newTags });
              }}
              onRemoveTag={async (itemId, tagId) => {
                const it = items.find((i) => i.id === itemId);
                if (!it) return;
                const newTags = (it.tags ?? []).filter((t) => t !== tagId);
                await onSaveItem(itemId, { tags: newTags });
              }}
              onAddDependency={handleAddDependency}
              onRemoveDependency={async (itemId, depId) => {
                const it = items.find((i) => i.id === itemId);
                if (!it) return;
                const newDeps = (it.dependsOn ?? []).filter((d) => d !== depId);
                await onSaveItem(itemId, { dependsOn: newDeps });
              }}
              objectives={objectives.filter((o) => !o.achievedAt && o.projectId === detailItem?.projectId)}
              onSetObjective={async (itemId, objectiveId) => {
                await onSaveItem(itemId, { objectiveId });
              }}
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
              pushSubscribed={pushSubscribed}
              onEnablePush={onEnablePush}
              onLogout={onLogout}
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
