"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CaptureScreen, type AppError } from "./CaptureScreen";
import { OverviewScreen } from "./OverviewScreen";
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
  createProject,
  deleteItem,
  deleteProject,
  fetchProjects,
  fetchItems,
  fetchOverview,
  parseNote,
  saveItems,
  setItemDone,
  transcribeAudio,
  updateItem,
} from "@/lib/api";
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
import { UnauthorizedError, clearPin, getPin, readStoredTranscript } from "@/lib/pin";
import { SEED_PROJECTS, fallbackProjectId } from "@/lib/projects";
import { useRecorder, type Recording } from "@/lib/useRecorder";
import type { DraftItem, Item, Overview, Phase, Project, ToastKind, View } from "@/lib/types";

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
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  /** Les items enregistrés, relus depuis le serveur : Brief en est la source. */
  const [sent, setSent] = useState<Item[]>([]);
  /** Item dont la coche attend le serveur — empêche le double appui. */
  const [doneBusyId, setDoneBusyId] = useState<string | null>(null);
  /**
   * Les items encore EN FILE, dictés sans réseau. Ils ne viennent pas du serveur
   * et ne doivent jamais être comptés comme enregistrés — d'où une liste
   * séparée plutôt qu'un mélange dans `sent`.
   *
   * Branchés directement sur le stockage local : toute écriture de la file
   * rafraîchit l'écran, sans resynchronisation manuelle à ne pas oublier.
   */
  const pending = useSyncExternalStore(subscribeQueue, queueSnapshot, queueServerSnapshot);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>(SEED_PROJECTS);
  const [reloading, setReloading] = useState(false);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [sheetId, setSheetId] = useState<string | null>(null);
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

  /* --- Vision globale ------------------------------------------------------ */
  const refreshOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      setOverview(await fetchOverview());
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        clearPin();
        setUnlocked(false);
      } else {
        setOverviewError(
          e instanceof ApiError ? e.message : "La charge n'a pas pu être calculée.",
        );
      }
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  /* --- Coche « fait » ------------------------------------------------------ */

  /**
   * La coche répond au doigt, pas au réseau : on peint l'état tout de suite et
   * on le remplace par la réponse du serveur, qui fait foi. Sur une tâche
   * récurrente c'est LUI qui recalcule l'échéance — la reconstruire ici
   * dupliquerait la règle et les deux finiraient par diverger.
   *
   * En cas d'échec on remet exactement l'état d'avant. Une coche qui reste
   * peinte alors que rien n'est enregistré est le pire des deux mondes : la
   * tâche paraît faite et ressuscite au prochain chargement.
   */
  const toggleDone = useCallback(
    async (id: string, done: boolean) => {
      const before = sent.find((t) => t.id === id);
      if (!before) return;

      setDoneBusyId(id);
      setSent((s) =>
        s.map((t) => (t.id === id ? { ...t, doneAt: done ? new Date().toISOString() : null } : t)),
      );

      try {
        const { item, outcome } = await setItemDone(id, done);
        setSent((s) => s.map((t) => (t.id === id ? item : t)));
        // Sans ce message, cocher une récurrence donnerait l'impression de
        // n'avoir rien fait : la tâche reste dans la liste, à une autre date.
        if (outcome === "advanced") {
          flash(`Repoussé au ${formatDue(item.due, item.allDay)}.`);
        }
        void refreshOverview();
      } catch (e) {
        setSent((s) => s.map((t) => (t.id === id ? before : t)));
        // Pas d'écran d'erreur qui prend toute l'app : la case redevient vide
        // sous le doigt et la retenter coûte un appui. Un toast suffit à dire
        // pourquoi. La déconnexion, elle, reste du ressort de `fail`.
        if (e instanceof UnauthorizedError) {
          fail(e, "");
          return;
        }
        flash(e instanceof ApiError ? e.message : "La coche n'a pas été enregistrée.", "err");
      } finally {
        setDoneBusyId(null);
      }
    },
    [sent, flash, refreshOverview, fail],
  );

  /**
   * Suppression définitive d'un item.
   *
   * ⚠️ Jusqu'au 2026-08-13 ce geste ne filtrait QUE l'état React : la ligne
   * disparaissait, la fiche se refermait, et l'item revenait au rechargement
   * suivant sans un mot. On remet la ligne en place si le serveur refuse —
   * mieux vaut une suppression qui échoue visiblement qu'une qui ment.
   */
  const removeItem = useCallback(
    async (id: string) => {
      const before = sent;
      setSheetId(null);
      setSent((s) => s.filter((t) => t.id !== id));
      try {
        await deleteItem(id);
        void refreshOverview();
      } catch (e) {
        setSent(before);
        if (e instanceof UnauthorizedError) {
          fail(e, "");
          return;
        }
        flash(e instanceof ApiError ? e.message : "La suppression n'a pas été enregistrée.", "err");
      }
    },
    [sent, flash, refreshOverview, fail],
  );

  /* --- Items enregistrés --------------------------------------------------- */
  const refreshItems = useCallback(async () => {
    try {
      // La file part en premier : sinon l'écran Tâches afficherait un état
      // incomplet en donnant l'impression que des dictées ont disparu.
      if (queueDepth() > 0) {
        const { saved, remaining } = await flushQueue();
        if (saved) flash(`${saved} item(s) en attente enregistré(s).`);
        if (remaining) flash(`${remaining} toujours en attente.`, "err");
      }
      setSent(await fetchItems());
      // La vision se recalcule sur le serveur : la relire ici évite un écran
      // Vision qui contredit l'écran Tâches d'un item.
      void refreshOverview();
    } catch {
      // Une lecture qui échoue ne casse pas la capture : l'écran Tâches
      // affichera simplement ce qu'il avait, la dictée reste possible.
    }
  }, [flash, refreshOverview]);

  /* --- Projets ------------------------------------------------------------ */
  const loadProjects = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setReloading(true);
      try {
        const list = await fetchProjects();
        if (list.length) setProjects(list);
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          clearPin();
          setUnlocked(false);
        } else {
          // Non bloquant : on garde la liste d'amorçage déjà en place.
          if (!opts.silent) flash("Projets illisibles — liste par défaut.", "err");
        }
      } finally {
        setReloading(false);
      }
    },
    [flash],
  );

  /* --- Gestion des projets ------------------------------------------------- */
  // Renvoient un message d'erreur à afficher SUR PLACE, ou null si c'est passé.
  // Une erreur de formulaire doit se lire à côté du champ, pas dans un toast qui
  // s'efface au bout de trois secondes.
  const addProject = useCallback(
    async (name: string): Promise<string | null> => {
      try {
        const created = await createProject(name);
        setProjects((ps) => [...ps, created]);
        flash(`Projet « ${created.name} » créé.`);
        return null;
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          clearPin();
          setUnlocked(false);
          return null;
        }
        return e instanceof ApiError ? e.message : "Création impossible.";
      }
    },
    [flash],
  );

  const removeProject = useCallback(
    async (id: string): Promise<string | null> => {
      try {
        const { orphaned } = await deleteProject(id);
        setProjects((ps) => ps.filter((p) => p.id !== id));
        // On NOMME les orphelins. Supprimer un projet sans le dire donnerait
        // l'impression que ses tâches sont parties avec lui.
        flash(
          orphaned
            ? `Projet supprimé — ${orphaned} item${orphaned > 1 ? "s" : ""} sous « Autre ».`
            : "Projet supprimé.",
        );
        void refreshOverview();
        return null;
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          clearPin();
          setUnlocked(false);
          return null;
        }
        return e instanceof ApiError ? e.message : "Suppression impossible.";
      }
    },
    [flash, refreshOverview],
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
        const items = await parseNote(source);
        setDrafts(items);
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
        // On AJOUTE à l'existant : une nouvelle dictée n'écrase jamais la
        // précédente.
        //
        // ⚠️ Forme fonctionnelle obligatoire. Lire `transcript` depuis la
        // closure donnerait sa valeur au moment où l'enregistrement s'arrête,
        // alors que `transcribeAudio` peut mettre jusqu'à 90 s à répondre.
        // Depuis que la note est un `<textarea>` éditable en permanence, tout
        // ce qui est tapé pendant « Transcription en cours… » serait effacé au
        // retour. `setTranscript((prev) => …)` lit l'état au moment de
        // l'écriture, pas au moment de la capture.
        setTranscript((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
        setWorkPhase("idle");
      } catch (e) {
        fail(e, "La transcription a échoué.");
      }
    },
    [flash, fail],
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
  const patchDraft = useCallback((id: string, patch: Partial<DraftItem>) => {
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
        kind: "task",
        title: "",
        projectId: fallbackProjectId(projectsRef.current),
        due: null,
        allDay: true,
        priority: 4,
        rrule: null,
      },
    ]);
  }, []);

  /* --- Enregistrement ------------------------------------------------------ */
  const sendRef = useRef<() => void>(() => {});

  const send = useCallback(async () => {
    const ready = drafts.filter((d) => d.title.trim());
    if (!ready.length) {
      flash("Rien à enregistrer.", "err");
      return;
    }
    setAppError(null);
    setWorkPhase("saving");
    try {
      // Le brouillon EST la charge utile : plus de conversion vers un format
      // tiers, donc plus de champ qui se perd au passage.
      const { saved, total } = await saveItems(ready.map((d) => ({ ...d, title: d.title.trim() })));

      if (saved < total) {
        setWorkPhase("idle");
        flash(`${saved} enregistré(s) sur ${total}.`, "err");
        return;
      }

      await refreshItems();
      setDrafts([]);
      setTranscript("");
      setWorkPhase("success");
      setView("capture");
      flash(`${saved} item${saved > 1 ? "s" : ""} enregistré${saved > 1 ? "s" : ""}`);
    } catch (e) {
      // Serveur injoignable : la note ne doit pas disparaître. On met en file
      // et on le DIT — un item en file n'est jamais compté comme enregistré.
      const queued = enqueue(ready.map((d) => ({ ...d, title: d.title.trim() })));
      setWorkPhase("idle");
      if (queued) {
        setDrafts([]);
        setTranscript("");
        setView("capture");
        flash(`Hors ligne — ${ready.length} en attente, ça partira à la réouverture.`, "err");
      } else {
        fail(e, "L'enregistrement a échoué et la mise en attente aussi.", () => sendRef.current());
      }
    }
  }, [drafts, flash, fail, refreshItems]);

  useEffect(() => {
    sendRef.current = () => void send();
  }, [send]);

  /**
   * Premier chargement, une fois déverrouillé.
   *
   * Sans ça, Tâches et Vision restaient vides jusqu'au premier enregistrement de
   * la session : l'app donnait l'impression d'avoir tout perdu à chaque
   * ouverture, alors que le serveur avait bien les items.
   */
  useEffect(() => {
    if (!hydrated || !unlocked) return;
    // Drapeau d'abandon : un verrouillage puis déverrouillage rapide lancerait
    // deux chargements, et le plus lent écraserait le plus récent.
    let alive = true;
    void (async () => {
      if (alive) await refreshItems();
    })();
    // Les projets aussi. Sans cet appel, la liste reste celle d'amorçage
    // (SEED_PROJECTS) et les projets créés depuis — Perso, Sport — n'apparaissent
    // qu'après un « Recharger les projets » manuel ou une structuration. C'était
    // le même trou que pour les items : vidés au premier chargement, ils ne
    // revenaient qu'à la première écriture.
    void (async () => {
      if (alive) await loadProjects({ silent: true });
    })();
    return () => {
      alive = false;
    };
  }, [hydrated, unlocked, refreshItems, loadProjects]);

  /* --- Rendu -------------------------------------------------------------- */
  if (!hydrated) {
    return (
      <PhoneFrame>
        <StatusBar />
        <div className="flex flex-1 items-center justify-center">
          <span className="animate-br-spin block h-6 w-6 rounded-full border-2 border-[var(--line-2)] border-t-action" />
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
          onTranscriptChange={setTranscript}
          onStructure={() => void structure(transcript)}
          overview={overview}
          onOpenOverview={() => setView("overview")}
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
          saving={phase === "saving"}
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
          pending={pending}
          projects={projects}
          filter={filter}
          onFilter={setFilter}
          onOpen={setSheetId}
          onToggleDone={(id, done) => void toggleDone(id, done)}
          onQuickAdd={(item) => {
            void (async () => {
              setWorkPhase("saving");
              try {
                const draft: DraftItem = {
                  id: uid(),
                  kind: "task",
                  title: item.title,
                  projectId: item.projectId,
                  due: item.due,
                  allDay: item.allDay,
                  priority: item.priority,
                  rrule: null,
                };
                const res = await saveItems([draft]);
                if (res.saved > 0) {
                  flash("Tâche ajoutée.");
                  void refreshItems();
                  void refreshOverview();
                }
                setWorkPhase("idle");
              } catch (e) {
                setWorkPhase("idle");
                if (e instanceof UnauthorizedError) {
                  clearPin();
                  setUnlocked(false);
                  return;
                }
                flash(e instanceof ApiError ? e.message : "Erreur lors de l'ajout.", "err");
              }
            })();
          }}
          onPostponeTomorrow={(id) => {
            void (async () => {
              const target = sent.find((t) => t.id === id);
              if (!target) return;
              const res = resolveDue("demain", new Date());
              if (!res) return;
              try {
                const updated = await updateItem(id, { due: res.due, allDay: res.allDay });
                setSent((s) => s.map((t) => (t.id === id ? updated : t)));
                flash("Reporté à demain.");
                void refreshOverview();
              } catch {
                flash("Impossible de reporter la tâche.", "err");
              }
            })();
          }}
          busyId={doneBusyId}
        />
      )}

      {view === "overview" && (
        <OverviewScreen
          overview={overview}
          loading={overviewLoading}
          error={overviewError}
          onRetry={() => void refreshOverview()}
        />
      )}

      {view === "settings" && (
        <SettingsScreen
          projects={projects}
          items={sent}
          reloading={reloading}
          onReloadProjects={() => void loadProjects()}
          onCreateProject={addProject}
          onDeleteProject={removeProject}
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
          saving={phase === "saving"}
          onClose={() => setSheetId(null)}
          onToggleDone={(done) => void toggleDone(sheetTask.id, done)}
          busy={doneBusyId === sheetTask.id}
          onDelete={() => void removeItem(sheetTask.id)}
          onSave={(patch) => {
            void (async () => {
              setWorkPhase("saving");
              try {
                const updated = await updateItem(sheetTask.id, patch);
                setSent((s) => s.map((t) => (t.id === sheetTask.id ? updated : t)));
                setSheetId(null);
                setWorkPhase("idle");
                flash("Item modifié.");
                void refreshOverview();
              } catch (e) {
                setWorkPhase("idle");
                if (e instanceof UnauthorizedError) {
                  clearPin();
                  setUnlocked(false);
                  return;
                }
                flash(
                  e instanceof ApiError ? e.message : "Modification impossible.",
                  "err",
                );
              }
            })();
          }}
        />
      )}

      {toast && <Toast message={toast.msg} kind={toast.kind} />}
    </PhoneFrame>
  );
}
