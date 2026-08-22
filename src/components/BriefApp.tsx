"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useMemo } from "react";
import { HomeScreen } from "./HomeScreen";
import { TaskDetailScreen } from "./TaskDetailScreen";
import { AgendaScreen } from "./AgendaScreen";
import { IdeasScreen } from "./IdeasScreen";
import { SearchScreen } from "./SearchScreen";
import { CaptureSheet, type CaptureStage } from "./CaptureSheet";
import { AccountSheet } from "./AccountSheet";
import { BottomNav, type Screen } from "./BottomNav";
import { CaptureBar } from "./CaptureBar";
import { PhoneFrame, StatusBar } from "./PhoneFrame";
import { PinGate } from "./PinGate";
import { Toast } from "./Toast";
import { EmptyState } from "./EmptyState";
import { SkeletonList } from "./Skeleton";
import { CheckIcon } from "./icons";
import {
  ApiError,
  createProject,
  deleteItem,
  deleteProject,
  fetchAgendaDay,
  fetchCalDavStatus,
  fetchProjects,
  fetchItems,
  fetchOverview,
  parseNote,
  saveItems,
  setItemDone,
  transcribeAudio,
  updateItem,
} from "@/lib/api";
import type { AgendaItem } from "@/lib/agenda";
import { formatDue, resolveDue } from "@/lib/due";
import { uid } from "@/lib/ids";
import {
  enqueue,
  flushQueue,
  queueDepth,
  queueServerSnapshot,
  queueSnapshot,
  subscribeQueue,
} from "@/lib/queue";
import { UnauthorizedError, clearPin, getPin, PIN_HEADER, readStoredTranscript } from "@/lib/pin";
import { SEED_PROJECTS, fallbackProjectId } from "@/lib/projects";
import { useRecorder, type Recording } from "@/lib/useRecorder";
import { zonedParts } from "@/lib/zoned";
import type { DraftItem, Item, Overview, Phase, Project, ToastKind } from "@/lib/types";

/** Date du jour, `AAAA-MM-JJ` en Europe/Paris — clé attendue par `/api/agenda`. */
function todayDateKey(): string {
  const p = zonedParts(new Date());
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

const TRANSCRIPT_KEY = "brief:transcript";

const subscribeNoop = () => () => {};
const useHydrated = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

export function BriefApp() {
  const hydrated = useHydrated();
  const [unlocked, setUnlocked] = useState(() => !!getPin());

  // Navigation
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // Écran vers lequel « Retour » doit revenir depuis une fiche — capturé au
  // moment de l'ouverture, pas figé sur "home". Sans ça, Recherche → Fiche →
  // Retour ramenait toujours à l'Accueil au lieu de Recherche.
  const [returnScreen, setReturnScreen] = useState<Screen>("home");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [calendarSyncAt, setCalendarSyncAt] = useState<number | null>(null);
  const [captureStage, setCaptureStage] = useState<CaptureStage>("idle");

  // Data
  const [transcript, setTranscript] = useState(readStoredTranscript);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [sent, setSent] = useState<Item[]>([]);
  const [doneBusyId, setDoneBusyId] = useState<string | null>(null);
  const pending = useSyncExternalStore(subscribeQueue, queueSnapshot, queueServerSnapshot);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  // Source unique pour « aujourd'hui » : le même `/api/agenda` que l'onglet
  // Rendez-vous, pour que la tuile d'accueil et l'onglet ne puissent jamais
  // afficher deux nombres différents pour le même jour (voir HANDOFF.md).
  const [todayAgenda, setTodayAgenda] = useState<AgendaItem[]>([]);
  const [todayAgendaLoaded, setTodayAgendaLoaded] = useState(false);
  const [projects, setProjects] = useState<Project[]>(SEED_PROJECTS);
  const [reloading, setReloading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectsRef = useRef(projects);
  const structureRef = useRef<(text: string) => void>(() => {});
  const sendRef = useRef<() => void>(() => {});
  const loadedRef = useRef(false);

  useEffect(() => { projectsRef.current = projects; }, [projects]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (transcript) window.localStorage.setItem(TRANSCRIPT_KEY, transcript);
      else window.localStorage.removeItem(TRANSCRIPT_KEY);
    } catch { /* stockage indisponible */ }
  }, [transcript, hydrated]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  /** Ouvre une fiche en mémorisant l'écran de provenance pour le Retour. */
  const openTask = useCallback((id: string) => {
    setReturnScreen(screen);
    setSelectedTaskId(id);
    setScreen("task");
  }, [screen]);

  /** Ouvre le compte, avec l'âge RÉEL du dernier passage CalDAV — jamais un texte figé. */
  const openAccount = useCallback(() => {
    setAccountOpen(true);
    void fetchCalDavStatus()
      .then(({ lastSyncAt }) => setCalendarSyncAt(lastSyncAt))
      .catch(() => {}); // non bloquant : l'écran Compte reste utilisable sans cette info
  }, []);

  const flash = useCallback((msg: string, kind: ToastKind = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, kind });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const fail = useCallback((e: unknown, fallbackTitle: string, retry?: () => void) => {
    if (e instanceof UnauthorizedError) {
      clearPin();
      setUnlocked(false);
      return;
    }
    const title = e instanceof ApiError ? e.message : fallbackTitle;
    flash(title, "err");
  }, [flash]);

  /* --- Overview --- */
  const refreshOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      setOverview(await fetchOverview());
    } catch (e) {
      if (e instanceof UnauthorizedError) { clearPin(); setUnlocked(false); }
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  /* --- Rendez-vous du jour (source unique, partagée avec l'onglet Rendez-vous) --- */
  const refreshTodayAgenda = useCallback(async () => {
    try {
      setTodayAgenda(await fetchAgendaDay(todayDateKey()));
    } catch (e) {
      if (e instanceof UnauthorizedError) { clearPin(); setUnlocked(false); }
      // Réseau : non bloquant, comme refreshItems() — l'accueil garde le
      // dernier instantané connu plutôt que de casser l'écran.
    } finally {
      setTodayAgendaLoaded(true);
    }
  }, []);

  /* --- Toggle done --- */
  const toggleDone = useCallback(async (id: string, completedAt?: string | null) => {
    const before = sent.find((t) => t.id === id);
    if (!before) return;
    const done = !before.doneAt;
    setDoneBusyId(id);
    setSent((s) => s.map((t) => (t.id === id ? { ...t, doneAt: done ? new Date().toISOString() : null } : t)));
    try {
      const { item, outcome } = await setItemDone(id, done, completedAt);
      setSent((s) => s.map((t) => (t.id === id ? item : t)));
      // « Repoussé » disait à Aramis que la coche avait raté sa cible : on
      // termine l'occurrence du jour (masquée de l'agenda et de l'accueil),
      // et la série continue à la prochaine occurrence — le toast le dit.
      if (outcome === "advanced") flash(`Terminée — prochaine le ${formatDue(item.due, item.allDay)}.`);
      void refreshOverview();
      void refreshTodayAgenda();
    } catch (e) {
      setSent((s) => s.map((t) => (t.id === id ? before : t)));
      if (e instanceof UnauthorizedError) { fail(e, ""); return; }
      flash(e instanceof ApiError ? e.message : "La coche n'a pas été enregistrée.", "err");
    } finally {
      setDoneBusyId(null);
    }
  }, [sent, flash, refreshOverview, refreshTodayAgenda, fail]);

  /* --- Remove item --- */
  const removeItem = useCallback(async (id: string) => {
    const before = sent;
    setSent((s) => s.filter((t) => t.id !== id));
    setSelectedTaskId(null);
    setScreen("home");
    try {
      await deleteItem(id);
      void refreshOverview();
      void refreshTodayAgenda();
    } catch (e) {
      setSent(before);
      if (e instanceof UnauthorizedError) { fail(e, ""); return; }
      flash(e instanceof ApiError ? e.message : "La suppression n'a pas été enregistrée.", "err");
    }
  }, [sent, flash, refreshOverview, refreshTodayAgenda, fail]);

  /* --- Postpone --- */
  const postponeItem = useCallback(async (id: string) => {
    const res = resolveDue("demain", new Date());
    if (!res) return;
    try {
      const updated = await updateItem(id, { due: res.due, allDay: res.allDay });
      setSent((s) => s.map((t) => (t.id === id ? updated : t)));
      flash("Reporté à demain.");
      void refreshOverview();
      void refreshTodayAgenda();
    } catch (e) {
      if (e instanceof UnauthorizedError) { fail(e, ""); return; }
      flash("Impossible de reporter la tâche.", "err");
    }
  }, [flash, refreshOverview, refreshTodayAgenda, fail]);

  /* --- Édition complète d'un item (fiche) --- */
  const saveItemEdit = useCallback(async (id: string, patch: Partial<DraftItem>): Promise<boolean> => {
    try {
      const updated = await updateItem(id, patch);
      setSent((s) => s.map((t) => (t.id === id ? updated : t)));
      flash("Modifications enregistrées.");
      void refreshOverview();
      void refreshTodayAgenda();
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedError) { fail(e, ""); return false; }
      flash(e instanceof ApiError ? e.message : "La modification n'a pas été enregistrée.", "err");
      return false;
    }
  }, [flash, refreshOverview, refreshTodayAgenda, fail]);

  /* --- Refresh items --- */
  const refreshItems = useCallback(async () => {
    try {
      if (queueDepth() > 0) {
        const { saved, remaining } = await flushQueue();
        if (saved) flash(`${saved} item(s) en attente enregistré(s).`);
        if (remaining) flash(`${remaining} toujours en attente.`, "err");
      }
      setSent(await fetchItems());
      void refreshOverview();
      void refreshTodayAgenda();
    } catch { /* non bloquant */ }
  }, [flash, refreshOverview, refreshTodayAgenda]);

  /* --- Projects --- */
  const loadProjects = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setReloading(true);
    try {
      const list = await fetchProjects();
      if (list.length) setProjects(list);
    } catch (e) {
      if (e instanceof UnauthorizedError) { clearPin(); setUnlocked(false); }
    } finally {
      setReloading(false);
    }
  }, []);

  /* --- Structuration --- */
  const structure = useCallback(async (text: string) => {
    const source = text.trim();
    if (!source) return;
    setCaptureStage("transcribing");
    try {
      if (!loadedRef.current) {
        loadedRef.current = true;
        await loadProjects({ silent: true });
      }
      const items = await parseNote(source);
      setDrafts(items);
      setCaptureStage("done");
    } catch (e) {
      fail(e, "La structuration a échoué.", () => structureRef.current(source));
      setCaptureStage("idle");
    }
  }, [fail, loadProjects]);

  useEffect(() => { structureRef.current = (text: string) => void structure(text); }, [structure]);

  /* --- Édition d'un brouillon avant envoi (type, date/heure) --- */
  const updateDraft = useCallback((id: string, patch: Partial<DraftItem>) => {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  /* --- Transcription --- */
  const onRecorded = useCallback(async (rec: Recording) => {
    try {
      const text = await transcribeAudio(rec.blob, rec.mimeType, () => setCaptureStage("transcribing"));
      if (!text) {
        setCaptureStage("idle");
        flash("Rien n'a été entendu.", "err");
        return;
      }
      setTranscript((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      // Auto-structure après transcription
      void structure(text);
    } catch (e) {
      fail(e, "La transcription a échoué.");
      setCaptureStage("idle");
    }
  }, [flash, fail, structure]);

  const recorder = useRecorder(onRecorded);

  const toggleMic = useCallback(() => {
    if (recorder.recording) {
      recorder.stop();
    } else {
      setCaptureStage("listening");
      void recorder.start();
    }
  }, [recorder]);

  /* --- Capture sheet --- */
  const openCapture = useCallback(() => {
    setCaptureStage("idle");
    setCaptureOpen(true);
  }, []);

  const closeCapture = useCallback(() => {
    setCaptureOpen(false);
    setCaptureStage("idle");
    setDrafts([]);
  }, []);

  const handleSubmitText = useCallback((text: string) => {
    void structure(text);
  }, [structure]);

  /* --- Send --- */
  const send = useCallback(async () => {
    const ready = drafts.filter((d) => d.title.trim());
    if (!ready.length) {
      flash("Rien à enregistrer.", "err");
      return;
    }
    try {
      const { saved, total } = await saveItems(ready.map((d) => ({ ...d, title: d.title.trim() })));
      if (saved < total) {
        flash(`${saved} enregistré(s) sur ${total}.`, "err");
        return;
      }
      await refreshItems();
      setDrafts([]);
      setTranscript("");
      setCaptureOpen(false);
      setCaptureStage("idle");
      setScreen("home");
      flash(`${saved} item${saved > 1 ? "s" : ""} enregistré${saved > 1 ? "s" : ""}`);
    } catch (e) {
      const queued = enqueue(ready.map((d) => ({ ...d, title: d.title.trim() })));
      if (queued) {
        setDrafts([]);
        setTranscript("");
        setCaptureOpen(false);
        flash(`Hors ligne — ${ready.length} en attente.`, "err");
      } else {
        fail(e, "L'enregistrement a échoué.", () => sendRef.current());
      }
    }
  }, [drafts, flash, fail, refreshItems]);

  useEffect(() => { sendRef.current = () => void send(); }, [send]);

  /* --- First load --- */
  useEffect(() => {
    if (!hydrated || !unlocked) return;
    let alive = true;
    void (async () => { if (alive) await refreshItems(); })();
    void (async () => { if (alive) await loadProjects({ silent: true }); })();
    return () => { alive = false; };
  }, [hydrated, unlocked, refreshItems, loadProjects]);

  /* --- Derived data (mémoïsés — pas de .filter() à chaque rendu) --- */
  const activeItems = useMemo(
    () => sent.filter((t) => t.status !== "idea" && t.status !== "archived"),
    [sent],
  );
  const ideaItems = useMemo(() => sent.filter((t) => t.status === "idea"), [sent]);
  const selectedTask = useMemo(
    () => (selectedTaskId ? sent.find((t) => t.id === selectedTaskId) ?? null : null),
    [selectedTaskId, sent],
  );
  const loading = (overviewLoading && sent.length === 0) || !todayAgendaLoaded;

  /* --- Callbacks stables pour éviter les re-rendus des composants memo --- */
  const toggleDoneSimple = useCallback((id: string) => void toggleDone(id), [toggleDone]);

  const onOpenAgenda = useCallback(() => setScreen("agenda"), []);
  const onOpenIdeas = useCallback(() => setScreen("ideas"), []);
  const goBackFromTask = useCallback(() => {
    setSelectedTaskId(null);
    setScreen(returnScreen);
  }, [returnScreen]);

  /* --- Render --- */
  if (!hydrated) {
    return (
      <PhoneFrame>
        <StatusBar />
        <div className="flex flex-1 items-center justify-center">
          <span className="block size-6 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
        </div>
      </PhoneFrame>
    );
  }

  if (!unlocked) {
    return (
      <PhoneFrame>
        <StatusBar />
        <PinGate onUnlocked={() => setUnlocked(true)} />
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <StatusBar />

      <div className="relative flex flex-1 min-h-0 flex-col">

        {screen === "home" && (
          <HomeScreen
            items={activeItems}
            todayAgenda={todayAgenda}
            ideaCount={ideaItems.length}
            projects={projects}
            overview={overview}
            loading={loading}
            onToggleDone={toggleDoneSimple}
            onOpenTask={openTask}
            onOpenAgenda={onOpenAgenda}
            onOpenIdeas={onOpenIdeas}
            onOpenAccount={openAccount}
            onCapture={openCapture}
            onAskAI={openCapture}
            onHelp={() => flash("Dicte ta note, Brief la range. Touche le micro ou écris, il découpe en tâches et rendez-vous.")}
            onNotifications={() => {
              void (async () => {
                try {
                  const pin = getPin();
                  const headers: HeadersInit = {};
                  if (pin) headers[PIN_HEADER] = pin;
                  const res = await fetch("/api/push/test", { method: "POST", headers });
                  if (res.ok) flash("Notification de test envoyée.");
                  else if (res.status === 409) flash("Active les notifications dans Réglages iOS pour les recevoir.", "err");
                  else flash("Notifications non configurées.", "err");
                } catch {
                  flash("Impossible d'envoyer la notification.", "err");
                }
              })();
            }}
          />
        )}

        {screen === "task" && (
          <TaskDetailScreen
            item={selectedTask}
            projects={projects}
            onBack={goBackFromTask}
            onDone={toggleDoneSimple}
            onPostpone={(id) => void postponeItem(id)}
            onDelete={(id) => void removeItem(id)}
            onOpenSibling={(id) => setSelectedTaskId(id)}
            onSave={saveItemEdit}
          />
        )}

        {screen === "agenda" && (
          <AgendaScreen
            onBack={() => setScreen("home")}
            onOpenTask={openTask}
            onUnauthorized={() => { clearPin(); setUnlocked(false); }}
          />
        )}

        {screen === "ideas" && (
          <IdeasScreen
            ideas={ideaItems}
            projects={projects}
            onConvert={(id) => {
              void (async () => {
                try {
                  const updated = await updateItem(id, { status: "active" });
                  setSent((s) => s.map((t) => (t.id === id ? updated : t)));
                  flash("Idée convertie en tâche.");
                } catch (e) {
                  flash("Conversion impossible.", "err");
                }
              })();
            }}
            onArchive={(id) => {
              void (async () => {
                try {
                  const updated = await updateItem(id, { status: "archived" });
                  setSent((s) => s.map((t) => (t.id === id ? updated : t)));
                  flash("Idée archivée.");
                } catch (e) {
                  flash("Archivage impossible.", "err");
                }
              })();
            }}
            onBack={() => setScreen("home")}
            onCapture={openCapture}
            loading={loading}
          />
        )}

        {screen === "search" && (
          <SearchScreen
            items={sent}
            projects={projects}
            onOpenItem={openTask}
            onBack={() => setScreen("home")}
            onOpenAccount={openAccount}
          />
        )}

      </div>

      {/* CaptureBar uniquement sur les écrans-listes */}
      {(screen === "home" || screen === "ideas" || screen === "search") && (
        <CaptureBar onClick={openCapture} />
      )}
      <BottomNav
        current={screen}
        onNavigate={(s) => setScreen(s)}
        onCapture={openCapture}
      />

      {captureOpen && (
        <CaptureSheet
          open={captureOpen}
          stage={captureStage}
          seconds={recorder.seconds}
          transcript={transcript}
          drafts={drafts}
          projects={projects}
          micError={recorder.error ? { title: "Micro refusé", description: "Autorise le micro dans les réglages pour dicter." } : null}
          onStartListen={toggleMic}
          onStopListen={() => recorder.stop()}
          onSubmitText={handleSubmitText}
          onUpdateDraft={updateDraft}
          onConfirm={() => void send()}
          onReplay={() => { setCaptureStage("idle"); setDrafts([]); }}
          onClose={closeCapture}
        />
      )}

      {accountOpen && (
        <AccountSheet
          open={accountOpen}
          calendarSyncAt={calendarSyncAt}
          onClose={() => setAccountOpen(false)}
          onToast={(msg) => flash(msg)}
        />
      )}

      {toast && <Toast message={toast.msg} kind={toast.kind} />}
    </PhoneFrame>
  );
}