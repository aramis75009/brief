"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CaptureScreen, type AppError } from "./CaptureScreen";
import { PhoneFrame, StatusBar } from "./PhoneFrame";
import { PinGate } from "./PinGate";
import { ReviewScreen } from "./ReviewScreen";
import { SettingsScreen } from "./SettingsScreen";
import { TabBar } from "./TabBar";
import { TaskSheet } from "./TaskSheet";
import { TasksScreen, type FilterKey } from "./TasksScreen";
import { Toast } from "./Toast";
import {
  ApiError,
  fetchProjects,
  parseNote,
  pushTasks,
  transcribeAudio,
  type ProjectsSource,
} from "@/lib/api";
import { uid } from "@/lib/demo";
import { UnauthorizedError, clearPin, getPin, readStoredTranscript } from "@/lib/pin";
import { FALLBACK_PROJECTS, inboxIdOf } from "@/lib/todoist";
import { useRecorder, type Recording } from "@/lib/useRecorder";
import type { Draft, Phase, Project, SentTask, ToastKind, TodoistTask, View } from "@/lib/types";

/** La transcription brute survit au rechargement — elle ne doit jamais être perdue. */
const TRANSCRIPT_KEY = "brief:transcript";

const subscribeNoop = () => () => {};
const useHydrated = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

export function BriefApp() {
  const hydrated = useHydrated();
  const [unlocked, setUnlocked] = useState(() => !!getPin());

  const [view, setView] = useState<View>("capture");
  // Phase du travail en cours. L'enregistrement n'en fait pas partie : il est
  // dérivé du recorder juste avant le rendu, ce qui évite un effet de synchro.
  const [workPhase, setWorkPhase] = useState<Phase>("idle");
  const [appError, setAppError] = useState<AppError | null>(null);

  const [transcript, setTranscript] = useState(readStoredTranscript);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sent, setSent] = useState<SentTask[]>([]);

  const [projects, setProjects] = useState<Project[]>(FALLBACK_PROJECTS);
  const [projectsSource, setProjectsSource] = useState<ProjectsSource | null>(null);
  const [reloading, setReloading] = useState(false);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (transcript) window.localStorage.setItem(TRANSCRIPT_KEY, transcript);
      else window.localStorage.removeItem(TRANSCRIPT_KEY);
    } catch {
      /* stockage indisponible */
    }
  }, [transcript, hydrated]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const flash = useCallback((msg: string, kind: ToastKind = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, kind });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  /** Toute erreur passe par ici : message français + sortie de secours. */
  const fail = useCallback((e: unknown, fallbackTitle: string, retry?: () => void) => {
    if (e instanceof UnauthorizedError) {
      clearPin();
      setUnlocked(false);
      setWorkPhase("idle");
      setAppError(null);
      return;
    }
    const title = e instanceof ApiError ? e.message : fallbackTitle;
    setWorkPhase("error");
    setAppError({
      title,
      steps: [],
      retryLabel: "Réessayer",
      onRetry: retry,
    });
  }, []);

  const dismissError = useCallback(() => {
    setAppError(null);
    setWorkPhase("idle");
  }, []);

  /* --- Projets ------------------------------------------------------------ */
  const loadProjects = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setReloading(true);
      try {
        const { projects: list, source } = await fetchProjects();
        if (list.length) {
          setProjects(list);
          setProjectsSource(source);
        }
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          clearPin();
          setUnlocked(false);
        } else {
          // Non bloquant : on garde la liste de repli déjà en place.
          setProjectsSource("fallback");
          if (!opts.silent) flash("Projets Todoist injoignables — liste de repli.", "err");
        }
      } finally {
        setReloading(false);
      }
    },
    [flash],
  );

  /* --- Structuration ------------------------------------------------------ */
  // Le bouton « Réessayer » doit rappeler structure() : on passe par une ref
  // pour ne pas référencer la callback avant sa déclaration.
  const structureRef = useRef<(text: string) => void>(() => {});
  const loadedRef = useRef(false);

  const structure = useCallback(
    async (text: string) => {
      const source = text.trim();
      if (!source) return;
      setAppError(null);
      setWorkPhase("parsing");
      try {
        // Liste à jour juste avant l'appel : le LLM doit voir les vrais projets.
        if (!loadedRef.current) {
          loadedRef.current = true;
          await loadProjects({ silent: true });
        }
        const tasks = await parseNote(source, projectsRef.current);
        setDrafts(tasks.map((t) => ({ ...t, id: uid() })));
        setWorkPhase("idle");
        setView("review");
      } catch (e) {
        // La transcription reste intacte : on ne perd jamais le texte.
        fail(e, "La structuration a échoué.", () => structureRef.current(source));
      }
    },
    [fail, loadProjects],
  );

  /* --- Transcription ------------------------------------------------------ */
  const onRecorded = useCallback(
    async (rec: Recording) => {
      setAppError(null);
      setWorkPhase("uploading");
      try {
        const text = await transcribeAudio(rec.blob, rec.mimeType, () => setWorkPhase("transcribing"));
        if (!text) {
          setWorkPhase("idle");
          flash("Rien n'a été entendu.", "err");
          return;
        }
        // On AJOUTE à l'existant : une nouvelle dictée n'écrase jamais la précédente.
        const merged = transcript.trim() ? `${transcript.trim()} ${text}` : text;
        setTranscript(merged);
        setWorkPhase("idle");
      } catch (e) {
        fail(e, "La transcription a échoué.");
      }
    },
    [transcript, flash, fail],
  );

  const recorder = useRecorder(onRecorded);

  // Un seul état visible, dérivé : pas de synchronisation à maintenir.
  const phase: Phase = recorder.recording ? "recording" : workPhase;

  useEffect(() => {
    structureRef.current = (text: string) => void structure(text);
  }, [structure]);

  const toggleMic = useCallback(() => {
    if (recorder.recording) recorder.stop();
    else void recorder.start();
  }, [recorder]);

  /* --- Revue -------------------------------------------------------------- */
  const patchDraft = useCallback((id: string, patch: Partial<Draft>) => {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const removeDraft = useCallback((id: string) => {
    setDrafts((ds) => ds.filter((d) => d.id !== id));
  }, []);

  const addDraft = useCallback(() => {
    setDrafts((ds) => [
      ...ds,
      {
        id: uid(),
        content: "",
        due_lang: "fr",
        priority: 1,
        project_id: inboxIdOf(projectsRef.current),
      },
    ]);
  }, []);

  /* --- Envoi vers Todoist ------------------------------------------------- */
  const payloadOf = (d: Draft): TodoistTask => ({
    content: d.content.trim(),
    ...(d.due_string ? { due_string: d.due_string } : {}),
    due_lang: "fr",
    priority: d.priority,
    project_id: d.project_id,
  });

  const sendRef = useRef<() => void>(() => {});

  const send = useCallback(async () => {
    const ready = drafts.filter((d) => d.content.trim());
    if (!ready.length) {
      flash("Aucune tâche à envoyer.", "err");
      return;
    }
    setAppError(null);
    setWorkPhase("pushing");
    try {
      const { results, created } = await pushTasks(ready.map(payloadOf));

      const next: SentTask[] = ready.map((d, i) => {
        const r = results[i];
        return r?.ok
          ? { ...d, content: d.content.trim(), status: "sent", todoistId: r.id }
          : { ...d, content: d.content.trim(), status: "failed", error: r?.error ?? "Échec inconnu." };
      });

      setSent((s) => [...next, ...s]);
      // Seules les tâches créées quittent la revue : les échecs restent
      // éditables ici ET consultables dans l'onglet Tâches.
      setDrafts((ds) => ds.filter((d) => !next.some((n) => n.id === d.id && n.status === "sent")));

      const failed = next.length - created;
      if (failed === 0) {
        setTranscript("");
        setWorkPhase("success");
        setView("capture");
        flash(`${created} tâche${created > 1 ? "s" : ""} envoyée${created > 1 ? "s" : ""} vers Todoist`);
      } else {
        setWorkPhase("idle");
        setView("tasks");
        setFilter("failed");
        flash(
          `${created} envoyée${created > 1 ? "s" : ""}, ${failed} en échec — réessayable`,
          "err",
        );
      }
    } catch (e) {
      fail(e, "L'envoi vers Todoist a échoué.", () => sendRef.current());
      setWorkPhase("idle");
    }
  }, [drafts, flash, fail]);

  useEffect(() => {
    sendRef.current = () => void send();
  }, [send]);

  /** Réessaie uniquement les tâches indiquées — jamais celles déjà créées. */
  const retry = useCallback(
    async (ids: string[]) => {
      const targets = sent.filter((t) => ids.includes(t.id) && t.status === "failed");
      if (!targets.length) return;

      setRetryingIds(new Set(ids));
      try {
        const { results, created } = await pushTasks(targets.map(payloadOf));
        setSent((s) =>
          s.map((t) => {
            const i = targets.findIndex((x) => x.id === t.id);
            if (i === -1) return t;
            const r = results[i];
            return r?.ok
              ? { ...t, status: "sent", todoistId: r.id, error: undefined }
              : { ...t, status: "failed", error: r?.error ?? "Échec inconnu." };
          }),
        );
        const failed = targets.length - created;
        flash(
          failed === 0
            ? `${created} tâche${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""}`
            : `${created} créée${created > 1 ? "s" : ""}, ${failed} encore en échec`,
          failed === 0 ? "ok" : "err",
        );
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          clearPin();
          setUnlocked(false);
        } else {
          flash(e instanceof ApiError ? e.message : "Nouvel envoi impossible.", "err");
        }
      } finally {
        setRetryingIds(new Set());
      }
    },
    [sent, flash],
  );

  /* --- Rendu -------------------------------------------------------------- */
  if (!hydrated) {
    return (
      <PhoneFrame>
        <StatusBar />
        <div className="flex flex-1 items-center justify-center">
          <span className="animate-br-spin block h-6 w-6 rounded-full border-2 border-[rgba(28,26,24,0.12)] border-t-accent" />
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

  const sheetTask = sheetId ? (sent.find((t) => t.id === sheetId) ?? null) : null;

  return (
    <PhoneFrame>
      <StatusBar />

      {view === "capture" && (
        <CaptureScreen
          phase={phase}
          transcript={transcript}
          levels={recorder.levels}
          seconds={recorder.seconds}
          micError={recorder.error}
          appError={appError}
          onToggleMic={toggleMic}
          onClear={() => setTranscript("")}
          onStructure={() => void structure(transcript)}
          onLoadDemo={setTranscript}
          onDismissError={() => {
            recorder.dismissError();
            dismissError();
          }}
        />
      )}

      {view === "review" && (
        <ReviewScreen
          drafts={drafts}
          projects={projects}
          transcript={transcript}
          pushing={phase === "pushing"}
          onBack={() => setView("capture")}
          onPatch={patchDraft}
          onRemove={removeDraft}
          onAdd={addDraft}
          onSend={() => void send()}
        />
      )}

      {view === "tasks" && (
        <TasksScreen
          sent={sent}
          projects={projects}
          filter={filter}
          onFilter={setFilter}
          onOpen={setSheetId}
          retrying={retryingIds.size > 0}
          onRetryAll={() =>
            void retry(sent.filter((t) => t.status === "failed").map((t) => t.id))
          }
        />
      )}

      {view === "settings" && (
        <SettingsScreen
          projects={projects}
          projectsSource={projectsSource}
          reloading={reloading}
          onReloadProjects={() => void loadProjects()}
          onClearSession={() => {
            setTranscript("");
            setDrafts([]);
            setSent([]);
            setFilter("all");
            flash("Session vidée");
          }}
          onLock={() => {
            clearPin();
            setUnlocked(false);
          }}
        />
      )}

      <TabBar view={view} onNavigate={setView} />

      {sheetTask && (
        <TaskSheet
          task={sheetTask}
          projects={projects}
          retrying={retryingIds.has(sheetTask.id)}
          onClose={() => setSheetId(null)}
          onDelete={() => {
            setSent((s) => s.filter((t) => t.id !== sheetTask.id));
            setSheetId(null);
          }}
          onRetry={() => void retry([sheetTask.id])}
        />
      )}

      {toast && <Toast message={toast.msg} kind={toast.kind} />}
    </PhoneFrame>
  );
}
