"use client";

/**
 * Cadre desktop — sidebar, en-tête à onglets, contenu, panneau de fiche.
 *
 * ⚠️ La navigation a DEUX axes depuis la refonte v2 (`types.ts`) : `nav` dit
 * OÙ on est, `view` dit COMMENT on le regarde. C'est ce qui permet à
 * « Calendrier » et « Kanban » de cesser d'être des destinations — ils
 * n'étaient que deux façons de voir les mêmes tâches, et en faire des onglets
 * de nav obligeait à choisir entre « mes tâches » et « mon calendrier » alors
 * que c'est le même contenu.
 *
 * Les feuilles partagées (Capture, Compte, Aide, Chat…) restent rendues par
 * `BriefApp`, exactement comme pour mobile.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar, type CreateKind } from "./Sidebar";
import { ViewHeader } from "./ViewHeader";
import { DetailPanel } from "./DetailPanel";
import { InboxScreen } from "./InboxScreen";
import { PortfoliosScreen } from "./PortfoliosScreen";
import { DesktopDashboard } from "./DesktopDashboard";
import { DesktopTasksToolbar } from "./DesktopTasksToolbar";
import { DesktopKanban } from "./DesktopKanban";
import { DesktopSettings } from "./DesktopSettings";
import { DependencyGraph } from "./DependencyGraph";
import { CommandPalette } from "./CommandPalette";
import { ListView } from "./views/ListView";
import { TimelineView, shiftRangePatch } from "./views/TimelineView";
import { WeekCalendarView } from "./views/WeekCalendarView";
import { DashboardView } from "./views/DashboardView";
import { FilesView } from "./views/FilesView";
import { C } from "./tokens";
import { hasViews, VIEWS_FOR, type NavKey, type ViewKey } from "./types";
import { DesktopCalendar } from "./DesktopCalendar";
import { fallbackProjectId } from "@/lib/projects";
import { filterAgendaItems, TASK_KIND_FILTERS, type TaskKindFilter } from "@/lib/desktopDashboard";
import { sortItems, type TaskSort } from "@/lib/tasks";
import { graphStatus, graphTasks, indexById } from "@/lib/graph";
import { groupItems } from "@/lib/views";
import { agree, plural } from "@/lib/plural";
import { relativeSyncLabel } from "@/lib/syncLabel";
import {
  addColumn,
  createObjective,
  createPortfolio,
  createTag,
  deleteAttachment,
  deleteColumn,
  deleteObjective,
  deletePortfolio,
  fetchBoard,
  fetchCalDavStatus,
  fetchCollaborators,
  fetchInbox,
  fetchObjectives,
  fetchPortfolios,
  fetchPrefs,
  fetchTags,
  markInboxRead,
  moveCard,
  patchPrefs,
  renameColumn,
  reorderColumns,
  setColumnWip,
  updateObjective,
  updatePortfolio,
  uploadAttachment,
} from "@/lib/api";
import type { AgendaItem } from "@/lib/agenda";
import type {
  DraftItem,
  InboxEvent,
  Item,
  KanbanBoard,
  Objective,
  ObjectiveHorizon,
  Overview,
  Portfolio,
  Project,
  Tag,
  ToastKind,
} from "@/lib/types";

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
  onRefreshItems: () => Promise<void>;
  onFlash: (msg: string, kind?: ToastKind) => void;
  onDeleteItem: (id: string) => void;
  onEnablePush: () => void;
  onOpenCapture: () => void;
  onOpenChat: () => void;
  onLogout: () => void;
  onOpenNotifications: () => void;
}) {
  /* --- Navigation, deux axes ------------------------------------------- */
  const [nav, setNav] = useState<NavKey>("accueil");
  const [view, setView] = useState<ViewKey>("list");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  /**
   * Filtre de type et tri — repris de l'ecran « Taches & RDV » supprime.
   * Sans eux, la refonte perdrait deux controles qui existaient, ce qui n'est
   * pas la meme chose que de les remplacer.
   */
  const [kindFilter, setKindFilter] = useState<TaskKindFilter>("all");
  const [sort, setSort] = useState<TaskSort>("urgency");
  /**
   * Préférences « Mes tâches » — chargées du store, PATCH à chaque
   * modification. Si la lecture échoue, on garde les défauts : la
   * toolbar reste utilisable.
   */
  const [doneHidden, setDoneHidden] = useState(true);
  const [groupBy, setGroupBy] = useState<"time" | "project">("time");
  /** Le calendrier garde ses DEUX portees : la semaine du prototype, et le mois de la v1. */
  const [calendarMode, setCalendarMode] = useState<"week" | "month">("week");
  const [calendarSelectedId, setCalendarSelectedId] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [focusDetail, setFocusDetail] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");

  const [board, setBoard] = useState<KanbanBoard>({ columns: [], updatedAt: "" });
  const [tags, setTags] = useState<Tag[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  /** Comptes assignables (2026-09-07) — vide = sélecteur caché, l'app vit. */
  const [collabList, setCollabList] = useState<{ userId: string; displayName: string }[]>([]);
  const [inbox, setInbox] = useState<{ events: InboxEvent[]; unread: number }>({ events: [], unread: 0 });
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  /**
   * `now` est figé par rendu et rafraîchi chaque minute.
   *
   * Sans ça, chaque `new Date()` dans le rendu donne un instant différent :
   * une tâche pouvait être « En retard » dans la liste et « Dans les délais »
   * dans le donut de la même page, pour un écart de quelques millisecondes
   * autour de son échéance.
   */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

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

  // Chargement initial. Chaque source échoue INDÉPENDAMMENT : un `/api/inbox`
  // en erreur ne doit pas laisser le Kanban sans colonnes.
  useEffect(() => {
    void (async () => {
      const settle = async <T,>(p: Promise<T>, apply: (v: T) => void) => {
        try {
          apply(await p);
        } catch {
          /* la vue concernée reste vide, les autres s'affichent */
        }
      };
      await Promise.all([
        settle(fetchBoard(), setBoard),
        settle(fetchTags(), setTags),
        settle(fetchObjectives(), setObjectives),
        settle(fetchPortfolios(), setPortfolios),
        settle(fetchInbox(), setInbox),
        settle(fetchCalDavStatus(), (s) => setLastSyncAt(s.lastSyncAt)),
        settle(fetchCollaborators(), setCollabList),
        settle(fetchPrefs(), (p) => {
          if (p.tasksToolbar) {
            setDoneHidden(p.tasksToolbar.doneHidden);
            setSort(p.tasksToolbar.sort);
            setGroupBy(p.tasksToolbar.groupBy);
          }
        }),
      ]);
    })();
  }, []);

  /* --- Périmètre affiché ------------------------------------------------ */

  const project = projectId ? (projects.find((p) => p.id === projectId) ?? null) : null;

  /**
   * Les items de la vue courante.
   *
   * Dans un projet : ceux du projet. Dans « Mes tâches » : tous les actifs.
   * Les idées ne sont JAMAIS ici — elles vivent dans la boîte de réception,
   * onglet « À trier », parce qu'une idée n'est pas encore une tâche.
   */
  const scoped = useMemo(() => {
    const base =
      nav === "project" && projectId
        ? activeItems.filter((it) => it.projectId === projectId)
        : activeItems;
    // Filtre « tâches terminées masquées » (07/09) — actif par défaut.
    // On n'exclut PAS les terminées du compte de tâches global (le Dashboard
    // continue de rendre le pourcentage global), on ne les enlève QUE de
    // l'écran Mes tâches et de ses 4 vues.
    const filtered = doneHidden ? base.filter((it) => !it.doneAt) : base;
    return sortItems(filterAgendaItems(filtered, kindFilter), sort);
  }, [nav, projectId, activeItems, kindFilter, sort, doneHidden]);

  const groups = useMemo(
    () => groupItems(scoped, nav === "project" ? "column" : "time", board.columns, now),
    [scoped, nav, board.columns, now],
  );

  const projectCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of activeItems) {
      if (it.doneAt) continue;
      map.set(it.projectId, (map.get(it.projectId) ?? 0) + 1);
    }
    return map;
  }, [activeItems]);

  const detailItem = detailId ? (items.find((it) => it.id === detailId) ?? null) : null;

  const openTask = useCallback((id: string) => setDetailId(id), []);
  const closeDetail = useCallback(() => {
    setDetailId(null);
    setFocusDetail(false);
  }, []);

  const goTo = useCallback((key: NavKey) => {
    setNav(key);
    setDetailId(null);
    setFocusDetail(false);
    if (key === "mytasks") setView((v) => (VIEWS_FOR.mytasks.some((x) => x.key === v) ? v : "list"));
  }, []);

  const openProject = useCallback((id: string) => {
    setNav("project");
    setProjectId(id);
    setDetailId(null);
    setFocusDetail(false);
  }, []);

  /* --- Kanban ------------------------------------------------------------ */

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

  const handleDeleteColumn = useCallback(async (id: string) => {
    try {
      setBoard(await deleteColumn(id));
      // Relecture INCONDITIONNELLE : le `items` du client peut être en retard,
      // et une carte détachée côté serveur garderait sinon un `columnId` mort —
      // elle disparaîtrait de l'écran sans erreur.
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
      try {
        setBoard(await fetchBoard());
      } catch { /* le board affiché reste celui d'avant */ }
    }
  }, [onFlash]);

  const handleMoveCard = useCallback(
    async (intent: { itemId: string; toColumnId: string | null; beforeId?: string; afterId?: string }) => {
      try {
        await moveCard(intent);
      } catch {
        onFlash("Le déplacement n'a pas été enregistré.", "err");
      }
      // Dans les deux cas on relit : après un succès pour prendre les rangs
      // calculés par le serveur, après un échec pour que la carte revienne à
      // sa place SERVEUR et non à celle qu'on croyait.
      try {
        await onRefreshItems();
      } catch { /* le toast a déjà parlé */ }
    },
    [onFlash, onRefreshItems],
  );

  const handleAddCard = useCallback(
    (columnId: string, title: string, forProject: string | null) => {
      onQuickAddTask(title, forProject ?? projectId ?? fallbackProjectId(projects), columnId);
    },
    [onQuickAddTask, projectId, projects],
  );

  /* --- Objectifs --------------------------------------------------------- */

  const refreshObjectives = useCallback(async () => {
    try {
      setObjectives(await fetchObjectives());
    } catch { /* l'état courant reste affiché */ }
  }, []);

  const handleAddDependency = useCallback(async (targetId: string, depId: string) => {
    if (targetId.startsWith("obj:")) {
      const objId = targetId.slice(4);
      const obj = objectives.find((o) => o.id === objId);
      if (!obj || (obj.dependsOn ?? []).includes(depId)) return;
      const updated = await updateObjective(objId, { dependsOn: [...(obj.dependsOn ?? []), depId] });
      setObjectives((prev) => prev.map((o) => (o.id === objId ? updated : o)));
      return;
    }
    const it = items.find((i) => i.id === targetId);
    if (!it || (it.dependsOn ?? []).includes(depId)) return;
    await onSaveItem(targetId, { dependsOn: [...(it.dependsOn ?? []), depId] });
  }, [items, objectives, onSaveItem]);

  const handleRemoveDependency = useCallback(async (targetId: string, depId: string) => {
    if (targetId.startsWith("obj:")) {
      const objId = targetId.slice(4);
      const obj = objectives.find((o) => o.id === objId);
      if (obj && (obj.dependsOn ?? []).includes(depId)) {
        const updated = await updateObjective(objId, {
          dependsOn: (obj.dependsOn ?? []).filter((d) => d !== depId),
        });
        setObjectives((prev) => prev.map((o) => (o.id === objId ? updated : o)));
        return;
      }
      // Dépendance IMPLICITE : une tâche qui pointe sur cet objectif.
      const linked = items.find((i) => i.id === depId && i.objectiveId === objId);
      if (linked) await onSaveItem(depId, { objectiveId: null });
      return;
    }
    const it = items.find((i) => i.id === targetId);
    if (!it) return;
    await onSaveItem(targetId, { dependsOn: (it.dependsOn ?? []).filter((d) => d !== depId) });
  }, [items, objectives, onSaveItem]);

  const handleCreateObjective = useCallback(
    async (title: string, forProject: string, horizon: ObjectiveHorizon) => {
      try {
        const created = await createObjective(title, forProject, horizon);
        setObjectives((prev) => [...prev, created]);
      } catch {
        onFlash("L'objectif n'a pas été créé.", "err");
      }
    },
    [onFlash],
  );

  const handleDeleteObjective = useCallback(async (id: string) => {
    try {
      await deleteObjective(id);
      setObjectives((prev) => prev.filter((o) => o.id !== id));
    } catch {
      onFlash("L'objectif n'a pas été supprimé.", "err");
    }
  }, [onFlash]);

  const handleAchieveObjective = useCallback(async (id: string) => {
    // Geste explicite → collant : `reconcileObjectives` ne le rouvrira pas.
    const updated = await updateObjective(id, { achievedAt: new Date().toISOString(), achievedManually: true });
    setObjectives((prev) => prev.map((o) => (o.id === id ? updated : o)));
  }, []);

  const handleReopenObjective = useCallback(async (id: string) => {
    const updated = await updateObjective(id, { achievedAt: null, achievedManually: false });
    setObjectives((prev) => prev.map((o) => (o.id === id ? updated : o)));
  }, []);

  /* Cocher une tâche, la (dé)lier à un objectif ou changer ses dépendances
     peut clore ou rouvrir un objectif CÔTÉ SERVEUR (`reconcileObjectives`).
     On recharge quand une de ces signatures bouge — jamais sur un re-render. */
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

  /* --- Sous-tâches ------------------------------------------------------- */

  const handleToggleSub = useCallback(async (itemId: string, subId: string) => {
    const item = items.find((it) => it.id === itemId);
    if (!item?.subtasks) return;
    const subtasks = item.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s));
    try {
      await onSaveItem(itemId, { subtasks });
    } catch { /* silencieux */ }
  }, [items, onSaveItem]);

  const handleAddSubtask = useCallback(async (itemId: string, title: string) => {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    const subtasks = [...(item.subtasks ?? []), { id: `sub-${Date.now().toString(36)}`, title: title.trim(), done: false }];
    try {
      await onSaveItem(itemId, { subtasks });
    } catch { /* silencieux */ }
  }, [items, onSaveItem]);

  /* --- Portefeuilles ----------------------------------------------------- */

  const handleCreatePortfolio = useCallback(async (name: string) => {
    try {
      const created = await createPortfolio(name);
      setPortfolios((prev) => [...prev, created]);
    } catch {
      onFlash("Le portefeuille n'a pas été créé.", "err");
    }
  }, [onFlash]);

  const handlePatchPortfolio = useCallback(
    async (id: string, patch: { name?: string; projectIds?: string[] }) => {
      try {
        const updated = await updatePortfolio(id, patch);
        setPortfolios((prev) => prev.map((p) => (p.id === id ? updated : p)));
      } catch {
        onFlash("Le portefeuille n'a pas été mis à jour.", "err");
      }
    },
    [onFlash],
  );

  const handleDeletePortfolio = useCallback(async (id: string) => {
    try {
      await deletePortfolio(id);
      setPortfolios((prev) => prev.filter((p) => p.id !== id));
    } catch {
      onFlash("Le portefeuille n'a pas été supprimé.", "err");
    }
  }, [onFlash]);

  /* --- Boîte de réception ------------------------------------------------ */

  const handleMarkInboxRead = useCallback(async () => {
    try {
      setInbox(await markInboxRead([]));
    } catch {
      onFlash("Le journal n'a pas été mis à jour.", "err");
    }
  }, [onFlash]);

  /* --- Pièces jointes ---------------------------------------------------- */

  const handleUpload = useCallback(
    async (itemId: string, file: File) => {
      try {
        await uploadAttachment(itemId, file);
        await onRefreshItems();
      } catch (e) {
        onFlash(e instanceof Error ? e.message : "Le fichier n'a pas été envoyé.", "err");
      }
    },
    [onFlash, onRefreshItems],
  );

  const handleDeleteAttachment = useCallback(
    async (attachmentId: string) => {
      try {
        await deleteAttachment(attachmentId);
        await onRefreshItems();
      } catch {
        onFlash("La pièce jointe n'a pas été supprimée.", "err");
      }
    },
    [onFlash, onRefreshItems],
  );

  /* --- Création depuis la sidebar ---------------------------------------- */

  const handleCreate = useCallback(
    (kind: CreateKind) => {
      switch (kind) {
        case "dictee":
          onOpenCapture();
          return;
        case "task":
          onQuickAddTask("Nouvelle tâche", projectId ?? fallbackProjectId(projects));
          goTo("mytasks");
          return;
        case "portfolio":
          goTo("portfolios");
          return;
        case "objective":
          goTo("portfolios");
          onFlash("Crée l'objectif depuis un projet du portefeuille.");
          return;
        case "project":
          // Les projets se créent dans les Réglages, où vivent déjà teinte et
          // forme. Un second formulaire divergerait de celui-là.
          setNav("réglages");
          return;
      }
    },
    [goTo, onFlash, onOpenCapture, onQuickAddTask, projectId, projects],
  );

  /* --- Rendu ------------------------------------------------------------- */

  const blockedCount = useMemo(() => {
    const tasks = graphTasks(activeItems);
    const byId = indexById(tasks);
    return tasks.filter((t) => graphStatus(t, byId) === "blocked").length;
  }, [activeItems]);

  const openCount = scoped.filter((it) => !it.doneAt).length;
  const doneCount = scoped.length - openCount;

  const subtitle = useMemo(() => {
    if (nav === "project") return `${plural(openCount, "ouverte")} · ${plural(doneCount, "terminée")}`;
    if (nav === "mytasks") return "Tout ce qui t'attend, toutes destinations confondues";
    if (nav === "inbox") return inbox.unread > 0 ? `${inbox.unread} non lus` : "";
    if (nav === "portfolios") return plural(portfolios.length, "portefeuille");
    if (nav === "graphe") {
      return blockedCount > 0
        ? `${plural(blockedCount, "tâche")} ${agree(blockedCount, "bloquée")}`
        : "Aucune tâche bloquée";
    }
    return "";
  }, [nav, openCount, doneCount, inbox.unread, portfolios.length, blockedCount]);

  const showsTasks = hasViews(nav);
  const listLike = showsTasks && (view === "list" || view === "board" || view === "timeline" || view === "calendar");

  return (
    <>
      <div className="flex h-dvh w-full overflow-hidden" style={{ background: C.bg }}>
        <Sidebar
          nav={nav}
          activeProjectId={projectId}
          projects={projects}
          counts={projectCounts}
          inboxUnread={inbox.unread}
          syncLabel={lastSyncAt === null ? null : relativeSyncLabel(lastSyncAt, now.getTime())}
          onNavigate={goTo}
          onOpenProject={openProject}
          onCreate={handleCreate}
          onOpenAccount={() => setNav("réglages")}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ViewHeader
            nav={nav}
            view={view}
            project={project}
            subtitle={subtitle}
            countLabel={showsTasks ? `${plural(scoped.length, "tâche")} · ${plural(doneCount, "terminée")}` : null}
            onSelectView={setView}
            onOpenPalette={() => {
              setPaletteOpen(true);
              setPaletteQuery("");
            }}
            onOpenNotifications={onOpenNotifications}
            onCapture={onOpenCapture}
            onAddTask={
              listLike
                ? () => onQuickAddTask("Nouvelle tâche", projectId ?? fallbackProjectId(projects))
                : null
            }
            toolbar={
              showsTasks ? (
                <div className="flex w-full items-center justify-between gap-3">
                  <DesktopTasksToolbar
                    state={{
                      doneHidden,
                      sort,
                      groupBy,
                      doneHiddenCount: activeItems.filter((it) => it.doneAt).length,
                    }}
                    handlers={{
                      onAddTask: () =>
                        onQuickAddTask(
                          "Nouvelle tâche",
                          projectId ?? fallbackProjectId(projects),
                        ),
                      onToggleDoneHidden: (next) => {
                        setDoneHidden(next);
                        void patchPrefs({
                          tasksToolbar: { doneHidden: next },
                        });
                      },
                      onChangeSort: (s) => {
                        setSort(s);
                        void patchPrefs({ tasksToolbar: { sort: s } });
                      },
                      onChangeGroupBy: (g) => {
                        setGroupBy(g);
                        void patchPrefs({ tasksToolbar: { groupBy: g } });
                      },
                    }}
                  />
                  <ViewToolbar
                    view={view}
                    kind={kindFilter}
                    sort={sort}
                    weekOffset={weekOffset}
                    calendarMode={calendarMode}
                    onKind={setKindFilter}
                    onSort={setSort}
                    onWeekOffset={setWeekOffset}
                    onCalendarMode={setCalendarMode}
                  />
                </div>
              ) : null
            }
          />

          <main className="min-h-0 flex-1 overflow-auto" style={{ padding: "22px 24px 60px" }}>
            {nav === "accueil" && (
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
                onGoTasks={() => goTo("mytasks")}
                onGoTasksKind={() => goTo("mytasks")}
              />
            )}

            {nav === "inbox" && (
              <InboxScreen
                events={inbox.events}
                unread={inbox.unread}
                ideas={ideaItems}
                projects={projects}
                now={now}
                onMarkRead={handleMarkInboxRead}
                onOpenTask={openTask}
                onPromoteIdea={onPromoteIdea}
                onArchiveIdea={onArchiveIdea}
                onRerouteIdea={(id, p) => void onSaveItem(id, { projectId: p })}
              />
            )}

            {nav === "portfolios" && (
              <PortfoliosScreen
                portfolios={portfolios}
                projects={projects}
                items={items}
                objectives={objectives}
                now={now}
                onOpenProject={openProject}
                onCreatePortfolio={handleCreatePortfolio}
                onRenamePortfolio={(id, name) => void handlePatchPortfolio(id, { name })}
                onSetProjects={(id, ids) => void handlePatchPortfolio(id, { projectIds: ids })}
                onDeletePortfolio={handleDeletePortfolio}
                onAchieveObjective={(id) => void handleAchieveObjective(id)}
                onReopenObjective={(id) => void handleReopenObjective(id)}
                onCreateObjective={(t, p, h) => void handleCreateObjective(t, p, h)}
                onDeleteObjective={(id) => void handleDeleteObjective(id)}
              />
            )}

            {nav === "graphe" && (
              <DependencyGraph
                items={activeItems}
                projects={projects}
                tags={tags}
                objectives={objectives}
                onOpenTask={openTask}
                onOpenObjectives={() => goTo("portfolios")}
                onAddDependency={handleAddDependency}
                onRemoveDependency={handleRemoveDependency}
              />
            )}

            {nav === "réglages" && (
              <DesktopSettings
                projects={projects}
                overview={overview}
                pushSubscribed={pushSubscribed}
                onEnablePush={onEnablePush}
                onLogout={onLogout}
              />
            )}

            {showsTasks && view === "list" && (
              <ListView
                groups={groups}
                projects={projects}
                items={items}
                now={now}
                onToggleDone={(id) => onToggleDone(id)}
                onOpenTask={openTask}
                onAddTask={(groupKey) =>
                  onQuickAddTask(
                    "Nouvelle tâche",
                    projectId ?? fallbackProjectId(projects),
                    nav === "project" ? groupKey : undefined,
                  )
                }
              />
            )}

            {showsTasks && view === "board" && (
              <DesktopKanban
                items={scoped}
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

            {showsTasks && view === "timeline" && (
              <TimelineView
                items={scoped}
                projects={projects}
                now={now}
                onOpenTask={openTask}
                onMoveRange={(id, days) => {
                  const it = items.find((i) => i.id === id);
                  if (!it) return;
                  void onSaveItem(id, shiftRangePatch(it, days));
                }}
              />
            )}

            {showsTasks && view === "calendar" && calendarMode === "week" && (
              <WeekCalendarView
                items={scoped}
                projects={projects}
                now={now}
                weekOffset={weekOffset}
                onOpenTask={openTask}
              />
            )}

            {showsTasks && view === "calendar" && calendarMode === "month" && (
              <DesktopCalendar
                items={scoped}
                projects={projects}
                selectedId={calendarSelectedId}
                onSelect={setCalendarSelectedId}
                onToggleDone={onToggleDone}
                onPostpone={onPostpone}
              />
            )}

            {showsTasks && view === "dashboard" && (
              <DashboardView items={scoped} groups={groups} now={now} />
            )}

            {showsTasks && view === "files" && (
              <FilesView
                items={scoped}
                onOpenTask={openTask}
                onUpload={detailItem ? (file) => handleUpload(detailItem.id, file) : null}
                onDelete={(id) => void handleDeleteAttachment(id)}
              />
            )}
          </main>
        </div>

        <DetailPanel
          item={detailItem}
          items={items}
          projects={projects}
          focus={focusDetail}
          onToggleFocus={() => setFocusDetail((v) => !v)}
          onClose={closeDetail}
          onDone={onToggleDone}
          onPostpone={onPostpone}
          onDelete={(id) => {
            onDeleteItem(id);
            closeDetail();
          }}
          onToggleSub={handleToggleSub}
          onAddSubtask={handleAddSubtask}
          onOpenSibling={(id) => setDetailId(id)}
          onSave={onSaveItem}
          allTags={tags}
          onCreateTag={async (name, color) => {
            try {
              const tag = await createTag(name, color);
              setTags((t) => [...t, tag]);
              return tag;
            } catch {
              return null;
            }
          }}
          onAddTag={async (itemId, tagId) => {
            const it = items.find((i) => i.id === itemId);
            if (!it) return;
            await onSaveItem(itemId, { tags: [...(it.tags ?? []), tagId] });
          }}
          onRemoveTag={async (itemId, tagId) => {
            const it = items.find((i) => i.id === itemId);
            if (!it) return;
            await onSaveItem(itemId, { tags: (it.tags ?? []).filter((t) => t !== tagId) });
          }}
          onAddDependency={handleAddDependency}
          onRemoveDependency={handleRemoveDependency}
          objectives={objectives.filter((o) => !o.achievedAt && o.projectId === detailItem?.projectId)}
          onSetObjective={async (itemId, objectiveId) => {
            await onSaveItem(itemId, { objectiveId });
          }}
          collaborators={collabList}
          onSetAssignee={async (itemId, assigneeId) => {
            await onSaveItem(itemId, { assigneeId });
          }}
        />
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
        onGoCalendar={() => {
          goTo("mytasks");
          setView("calendar");
        }}
        onGoIdeas={() => goTo("inbox")}
        onLighten={() => {
          const candidate = overview?.peak?.items?.[0]?.id;
          if (candidate) onPostpone(candidate);
        }}
      />
    </>
  );
}

/**
 * La barre d'outils de la vue courante.
 *
 * Le filtre de type et le tri viennent de l'ancien ecran « Taches & RDV » ;
 * la navigation de semaine et la bascule semaine/mois n'apparaissent que sur
 * le calendrier. Un controle sans effet sur la vue affichee ne s'y montre pas
 * plutot que d'y rester grise.
 */
function ViewToolbar({
  view,
  kind,
  sort,
  weekOffset,
  calendarMode,
  onKind,
  onSort,
  onWeekOffset,
  onCalendarMode,
}: {
  view: ViewKey;
  kind: TaskKindFilter;
  sort: TaskSort;
  weekOffset: number;
  calendarMode: "week" | "month";
  onKind: (k: TaskKindFilter) => void;
  onSort: (s: TaskSort) => void;
  onWeekOffset: (n: number) => void;
  onCalendarMode: (m: "week" | "month") => void;
}) {
  const chip = {
    height: 32,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid var(--hairline-2)",
    background: "var(--color-surface)",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  } as const;

  const onCalendar = view === "calendar";

  return (
    <div className="flex items-center gap-2">
      {/* Le filtre de type ne dit rien sur le tableau de bord ni les fichiers. */}
      {(view === "list" || view === "board" || view === "timeline" || onCalendar) && (
        <div className="flex gap-0.5" style={{ padding: 3, background: "var(--color-bg)", borderRadius: 999 }}>
          {TASK_KIND_FILTERS.map((f) => {
            const on = f.key === kind;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onKind(f.key)}
                aria-pressed={on}
                style={{
                  height: 26,
                  padding: "0 11px",
                  borderRadius: 999,
                  border: "none",
                  background: on ? "var(--color-ink)" : "transparent",
                  color: on ? "#FFFFFF" : "var(--color-ink-muted)",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {view === "list" && (
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as TaskSort)}
          aria-label="Trier"
          style={chip}
        >
          <option value="urgency">Tri : urgence</option>
          <option value="due">Tri : échéance</option>
          <option value="priority">Tri : priorité</option>
          <option value="project">Tri : projet</option>
        </select>
      )}

      {onCalendar && (
        <>
          <div className="flex gap-0.5" style={{ padding: 3, background: "var(--color-bg)", borderRadius: 999 }}>
            {(["week", "month"] as const).map((m) => {
              const on = m === calendarMode;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onCalendarMode(m)}
                  aria-pressed={on}
                  style={{
                    height: 26,
                    padding: "0 11px",
                    borderRadius: 999,
                    border: "none",
                    background: on ? "var(--color-ink)" : "transparent",
                    color: on ? "#FFFFFF" : "var(--color-ink-muted)",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {m === "week" ? "Semaine" : "Mois"}
                </button>
              );
            })}
          </div>

          {calendarMode === "week" && (
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="Semaine précédente" onClick={() => onWeekOffset(weekOffset - 1)} style={chip}>
                ‹
              </button>
              <button type="button" onClick={() => onWeekOffset(0)} style={{ ...chip, fontWeight: 700 }}>
                {weekOffset === 0
                  ? "Cette semaine"
                  : `Semaine ${weekOffset > 0 ? "+" : "−"}${Math.abs(weekOffset)}`}
              </button>
              <button type="button" aria-label="Semaine suivante" onClick={() => onWeekOffset(weekOffset + 1)} style={chip}>
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
