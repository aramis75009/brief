"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CaptureScreen } from "./CaptureScreen";
import { PhoneFrame, StatusBar } from "./PhoneFrame";
import { PinGate } from "./PinGate";
import { ReviewScreen } from "./ReviewScreen";
import { SettingsScreen } from "./SettingsScreen";
import { TabBar } from "./TabBar";
import { TaskSheet } from "./TaskSheet";
import { TasksScreen, type FilterKey } from "./TasksScreen";
import { Toast } from "./Toast";
import { LANGS, demoSent, dueISOFor, uid } from "@/lib/mock";
import { parseNote } from "@/lib/parse";
import { UnauthorizedError, apiFetch, getPin, readStoredTranscript } from "@/lib/pin";
import { useRecorder, type Recording } from "@/lib/useRecorder";
import type { Draft, SentTask, ToastKind, View } from "@/lib/types";

/** La transcription brute survit au rechargement — elle ne doit jamais être perdue. */
const TRANSCRIPT_KEY = "brief:transcript";

/**
 * `false` au rendu serveur, `true` sur le client : c'est le signal officiel React
 * pour du contenu client-only, sans écart d'hydratation ni setState dans un effet.
 */
const subscribeNoop = () => () => {};
const useHydrated = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

export function BriefApp() {
  const hydrated = useHydrated();
  const [unlocked, setUnlocked] = useState(() => !!getPin());

  const [view, setView] = useState<View>("capture");
  const [transcript, setTranscript] = useState(readStoredTranscript);
  const [transcribing, setTranscribing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sent, setSent] = useState<SentTask[]>(demoSent);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  const [todoist, setTodoist] = useState(true);
  const [defaultProject, setDefaultProject] = useState("flip");
  const [lang, setLang] = useState("fr-FR");
  const [auto, setAuto] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lu depuis un callback asynchrone, jamais pendant le rendu.
  const autoRef = useRef(auto);
  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (transcript) window.localStorage.setItem(TRANSCRIPT_KEY, transcript);
      else window.localStorage.removeItem(TRANSCRIPT_KEY);
    } catch {
      /* idem */
    }
  }, [transcript, hydrated]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (syncTimer.current) clearTimeout(syncTimer.current);
    },
    [],
  );

  const flash = useCallback((msg: string, kind: ToastKind = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, kind });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const structure = useCallback(
    (text: string) => {
      const parsed = parseNote(text, defaultProject).map<Draft>((t) => ({
        ...t,
        id: uid(),
        dueISO: dueISOFor(t.dueKey),
      }));
      setDrafts(parsed);
      setView("review");
    },
    [defaultProject],
  );

  /* --- Transcription ------------------------------------------------------ */
  const onRecorded = useCallback(
    async (rec: Recording) => {
      setTranscribing(true);
      try {
        const form = new FormData();
        // Le mimeType réel accompagne le blob : le serveur ne le devine jamais.
        const ext = rec.mimeType.includes("mp4") ? "m4a" : "webm";
        form.append("file", rec.blob, `note.${ext}`);
        form.append("mimeType", rec.mimeType);

        const res = await apiFetch("/api/transcribe", { method: "POST", body: form });
        const data = (await res.json()) as { text?: string; error?: string };

        if (!res.ok) {
          flash(data.error || "La transcription a échoué.", "err");
          return;
        }

        const text = (data.text || "").trim();
        if (!text) {
          flash("Rien n'a été entendu.", "err");
          return;
        }

        // On AJOUTE à l'existant : une nouvelle dictée n'écrase jamais la précédente.
        let merged = "";
        setTranscript((prev) => {
          merged = prev.trim() ? `${prev.trim()} ${text}` : text;
          return merged;
        });
        if (autoRef.current) structure(merged);
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          setUnlocked(false);
          flash("Session expirée — ressaisis ton code.", "err");
        } else {
          flash("Réseau indisponible. Réessaie.", "err");
        }
      } finally {
        setTranscribing(false);
      }
    },
    [flash, structure],
  );

  const recorder = useRecorder(onRecorded);

  const toggleMic = useCallback(() => {
    if (recorder.recording) recorder.stop();
    else void recorder.start();
  }, [recorder]);

  /* --- Revue -------------------------------------------------------------- */
  const patchDraft = useCallback((id: string, patch: Partial<Draft>) => {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const removeDraft = useCallback(
    (id: string) => {
      setDrafts((ds) => ds.filter((d) => d.id !== id));
      flash("Tâche supprimée");
    },
    [flash],
  );

  const addDraft = useCallback(() => {
    setDrafts((ds) => [
      ...ds,
      { id: uid(), title: "", projectId: defaultProject, dueKey: "none", dueText: "", dueISO: null, prio: "p4" },
    ]);
  }, [defaultProject]);

  const send = useCallback(() => {
    if (sending || !drafts.length) return;
    if (!todoist) {
      flash("Connecte Todoist dans Réglages", "err");
      return;
    }
    setSending(true);
    // Envoi simulé : la route Todoist n'existe pas encore (étape suivante).
    setTimeout(() => {
      const added: SentTask[] = drafts
        .filter((d) => d.title.trim())
        .map((d) => ({ ...d, title: d.title.trim(), sync: "pending" }));
      setSent((s) => [...added, ...s]);
      setDrafts([]);
      setTranscript("");
      setSending(false);
      setView("capture");
      flash(`${added.length} ${added.length > 1 ? "tâches envoyées" : "tâche envoyée"} vers Todoist`);
      const ids = new Set(added.map((a) => a.id));
      syncTimer.current = setTimeout(() => {
        setSent((s) => s.map((t) => (ids.has(t.id) ? { ...t, sync: "synced" } : t)));
      }, 1700);
    }, 1200);
  }, [drafts, sending, todoist, flash]);

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
  const langShort = (LANGS.find((l) => l.code === lang) ?? LANGS[0]).short;

  return (
    <PhoneFrame>
      <StatusBar />

      {view === "capture" && (
        <CaptureScreen
          langShort={langShort}
          transcript={transcript}
          recording={recorder.recording}
          busy={recorder.busy}
          transcribing={transcribing}
          seconds={recorder.seconds}
          levels={recorder.levels}
          error={recorder.error}
          onToggleMic={toggleMic}
          onClear={() => setTranscript("")}
          onStructure={() => structure(transcript)}
          onLoadDemo={setTranscript}
          onDismissError={recorder.dismissError}
        />
      )}

      {view === "review" && (
        <ReviewScreen
          drafts={drafts}
          sending={sending}
          onBack={() => setView("capture")}
          onPatch={patchDraft}
          onRemove={removeDraft}
          onAdd={addDraft}
          onSend={send}
        />
      )}

      {view === "tasks" && (
        <TasksScreen sent={sent} filter={filter} onFilter={setFilter} onOpen={setSheetId} />
      )}

      {view === "settings" && (
        <SettingsScreen
          todoist={todoist}
          onToggleTodoist={() => setTodoist((v) => !v)}
          defaultProject={defaultProject}
          onDefaultProject={setDefaultProject}
          lang={lang}
          onLang={setLang}
          auto={auto}
          onToggleAuto={() => setAuto((v) => !v)}
          onResetDemo={() => {
            setSent(demoSent());
            setDrafts([]);
            setFilter("all");
            flash("Démo réinitialisée");
          }}
        />
      )}

      <TabBar view={view} onNavigate={setView} />

      {sheetTask && (
        <TaskSheet
          task={sheetTask}
          onClose={() => setSheetId(null)}
          onDelete={() => {
            setSent((s) => s.filter((t) => t.id !== sheetTask.id));
            setSheetId(null);
            flash("Tâche supprimée");
          }}
        />
      )}

      {toast && <Toast message={toast.msg} kind={toast.kind} />}
    </PhoneFrame>
  );
}
