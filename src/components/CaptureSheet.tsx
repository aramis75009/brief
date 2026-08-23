"use client";

import { WaveformActive, WaveformCollapsed } from "./Waveform";
import { VoiceBadge } from "./VoiceBadge";
import { TypeSegmented } from "./TypeSegmented";
import { ProjectSelector } from "./ProjectSelector";
import { skinFor, shapeFor } from "@/lib/projects";
import { CloseIcon, MicIcon, ArrowRightIcon, StopIcon } from "./icons";
import { isoToLocalInputValue, localInputToIso, toIsoWithOffset } from "@/lib/due";
import { itemType, type ItemType } from "@/lib/item-type";
import { shiftDays, zonedParts, zonedTime } from "@/lib/zoned";
import type { DraftItem, Project } from "@/lib/types";

/**
 * CaptureSheet — sheet modal de capture vocale, 4 stages.
 * idle → listening → transcribing → done
 */

export type CaptureStage = "idle" | "listening" | "transcribing" | "done";

const fmtClock = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
};

export function CaptureSheet({
  open,
  stage,
  seconds,
  transcript,
  drafts,
  projects,
  micError,
  variant = "sheet",
  onStartListen,
  onStopListen,
  onSubmitText,
  onUpdateDraft,
  onConfirm,
  onReplay,
  onClose,
}: {
  open: boolean;
  stage: CaptureStage;
  seconds: number;
  transcript: string;
  drafts: DraftItem[];
  projects: Project[];
  micError: { title: string; description: string } | null;
  /** "sheet" (mobile, par défaut) monte du bas ; "modal" (desktop) est centrée. */
  variant?: "sheet" | "modal";
  onStartListen: () => void;
  onStopListen: () => void;
  onSubmitText: (text: string) => void;
  onUpdateDraft: (id: string, patch: Partial<DraftItem>) => void;
  onConfirm: () => void;
  onReplay: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const isModal = variant === "modal";

  return (
    <div
      className={isModal ? "fixed inset-0 z-60 flex items-center justify-center p-10" : "absolute inset-0 z-80 flex flex-col justify-end"}
      style={{ background: "rgba(16,16,16,.34)", backdropFilter: isModal ? "blur(3px)" : undefined, animation: "fade .22s both" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Capturer"
    >
      <div
        className={isModal ? "w-full overflow-y-auto rounded-24 bg-surface p-7" : "rounded-t-[30px] bg-surface px-5 pt-3 pb-8"}
        style={{ maxWidth: isModal ? 720 : undefined, maxHeight: isModal ? "88vh" : undefined, animation: "sheet .3s cubic-bezier(.2,.9,.3,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        {!isModal && (
          <div className="mb-3.5 flex justify-center">
            <span className="h-[5px] w-[42px] rounded-full bg-ink/[.14]" />
          </div>
        )}

        {/* Header */}
        <div className="mb-4.5 flex items-center justify-between">
          <span className="text-[20px] font-extrabold tracking-[-0.025em]">Capturer</span>
          <button
            aria-label="Fermer"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-full bg-bg"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Stages */}
        {stage === "idle" && (
          <IdleStage
            micError={micError}
            onStart={onStartListen}
            onSubmitText={onSubmitText}
          />
        )}

        {stage === "listening" && (
          <ListeningStage
            seconds={seconds}
            onStop={onStopListen}
          />
        )}

        {stage === "transcribing" && <TranscribingStage />}

        {stage === "done" && (
          <DoneStage
            transcript={transcript}
            drafts={drafts}
            projects={projects}
            onUpdateDraft={onUpdateDraft}
            onReplay={onReplay}
            onConfirm={onConfirm}
          />
        )}
      </div>
    </div>
  );
}

/* --- Stage 1: Idle --- */
function IdleStage({
  micError,
  onStart,
  onSubmitText,
}: {
  micError: { title: string; description: string } | null;
  onStart: () => void;
  onSubmitText: (text: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 pb-1.5 pt-4.5">
      {micError ? (
        <div className="w-full rounded-18 bg-bg p-3.5 text-center">
          <p className="text-[14px] font-bold">{micError.title}</p>
          <p className="mt-1 text-[13px] text-ink-muted">{micError.description}</p>
          <button
            className="mt-3 min-h-[44px] rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-white"
            onClick={() => { /* deep link to settings */ }}
          >
            Autoriser dans les réglages
          </button>
        </div>
      ) : (
        <button
          aria-label="Démarrer la dictée"
          onClick={onStart}
          className="flex size-[104px] items-center justify-center rounded-full bg-ink shadow-mic"
        >
          <MicIcon size={34} className="text-white" />
        </button>
      )}
      <span className="text-[16px] font-bold">Appuie pour parler</span>
      <span className="max-w-[250px] text-center text-[13px] font-medium leading-[1.45] text-ink-muted">
        Brief écoute, transcrit, puis découpe en tâches, RDV ou idées.
      </span>

      {/* Divider */}
      <div className="mt-1.5 flex w-full items-center gap-2.5">
        <span className="h-px flex-1 bg-ink/[.08]" />
        <span className="text-[11px] font-bold text-ink-faint">OU</span>
        <span className="h-px flex-1 bg-ink/[.08]" />
      </div>

      {/* Text input */}
      <form
        className="flex w-full items-center gap-2.5 rounded-full bg-bg h-[52px] pl-[18px] pr-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const input = (e.currentTarget.querySelector("input") as HTMLInputElement);
          if (input.value.trim()) {
            onSubmitText(input.value);
            input.value = "";
          }
        }}
      >
        <input
          placeholder="Écrire à la place…"
          className="min-w-0 flex-1 border-none bg-transparent text-[14.5px] font-semibold text-ink outline-none"
        />
        <button
          type="submit"
          aria-label="Valider"
          className="flex size-10 flex-none items-center justify-center rounded-full bg-ink"
        >
          <ArrowRightIcon size={16} className="text-white" />
        </button>
      </form>
    </div>
  );
}

/* --- Stage 2: Listening --- */
function ListeningStage({ seconds, onStop }: { seconds: number; onStop: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 pb-1.5 pt-2.5" style={{ animation: "fade .2s both" }}>
      {/* Status */}
      <div className="flex items-center gap-2.25">
        <span className="relative flex size-[9px] items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-danger" style={{ animation: "ping 1.4s ease-out infinite" }} />
          <span className="absolute inset-0 rounded-full bg-danger" />
        </span>
        <span className="text-[14px] font-bold">J&apos;écoute…</span>
        <span className="font-mono text-[13px] font-medium text-ink-faint">{fmtClock(seconds)}</span>
      </div>

      {/* Waveform */}
      <WaveformActive />

      {/* Stop button */}
      <button
        onClick={onStop}
        className="h-[52px] w-full rounded-full bg-ink text-[15.5px] font-bold text-white"
      >
        Terminer
      </button>
    </div>
  );
}

/* --- Stage 3: Transcribing --- */
function TranscribingStage() {
  return (
    <div className="flex flex-col items-center gap-5 pb-1.5 pt-2.5" style={{ animation: "fade .2s both" }}>
      <span className="text-[14px] font-bold text-ink-muted">Transcription…</span>
      <WaveformCollapsed />
      <div className="flex w-full flex-col gap-2">
        <span
          className="h-[12px] w-[92%] rounded-full"
          style={{
            background: "linear-gradient(90deg,#F4F4F2 8%,#E4E3DE 18%,#F4F4F2 33%)",
            backgroundSize: "220px 100%",
            animation: "shimmer 1.1s linear infinite",
          }}
        />
        <span
          className="h-[12px] w-[74%] rounded-full"
          style={{
            background: "linear-gradient(90deg,#F4F4F2 8%,#E4E3DE 18%,#F4F4F2 33%)",
            backgroundSize: "220px 100%",
            animation: "shimmer 1.1s linear infinite",
            animationDelay: "-.2s",
          }}
        />
        <span
          className="h-[12px] w-[48%] rounded-full"
          style={{
            background: "linear-gradient(90deg,#F4F4F2 8%,#E4E3DE 18%,#F4F4F2 33%)",
            backgroundSize: "220px 100%",
            animation: "shimmer 1.1s linear infinite",
            animationDelay: "-.4s",
          }}
        />
      </div>
    </div>
  );
}

/** Prochaine heure ronde raisonnable, pour préremplir une date de RDV sans bloquer. */
function defaultEventDue(now: Date): string {
  const p = zonedParts(now);
  if (p.hour >= 20) {
    const tomorrow = shiftDays(p, 1);
    return toIsoWithOffset(zonedTime(tomorrow.y, tomorrow.m, tomorrow.d, 9, 0));
  }
  const nextHour = p.minute === 0 ? p.hour : p.hour + 1;
  return toIsoWithOffset(zonedTime(p.y, p.m, p.d, Math.min(nextHour, 23), 0));
}

/* --- Stage 4: Done --- */
function DoneStage({
  transcript,
  drafts,
  projects,
  onUpdateDraft,
  onReplay,
  onConfirm,
}: {
  transcript: string;
  drafts: DraftItem[];
  projects: Project[];
  onUpdateDraft: (id: string, patch: Partial<DraftItem>) => void;
  onReplay: () => void;
  onConfirm: () => void;
}) {
  const handleTypeChange = (draft: DraftItem, next: ItemType) => {
    if (next === "idea") {
      onUpdateDraft(draft.id, { status: "idea" });
      return;
    }
    const patch: Partial<DraftItem> = { kind: next, status: undefined };
    if (next === "event" && !draft.due) {
      patch.due = defaultEventDue(new Date());
      patch.allDay = false;
    }
    onUpdateDraft(draft.id, patch);
  };
  return (
    <div className="flex flex-col gap-3.5 pt-0.5" style={{ animation: "fade .2s both" }}>
      {/* Citation */}
      <div className="flex gap-2.75 items-start rounded-18 bg-bg p-3.5">
        <span className="flex items-end gap-[2px] h-4 flex-none mt-0.5">
          <span className="w-[2.5px] h-[6px] rounded-full bg-ink-faint" />
          <span className="w-[2.5px] h-[12px] rounded-full bg-ink-faint" />
          <span className="w-[2.5px] h-[8px] rounded-full bg-ink-faint" />
          <span className="w-[2.5px] h-[15px] rounded-full bg-ink-faint" />
          <span className="w-[2.5px] h-[7px] rounded-full bg-ink-faint" />
        </span>
        <span className="text-[13px] font-semibold leading-[1.45] text-ink-muted">
          « {transcript} »
        </span>
      </div>

      {/* Rail */}
      <div className="flex items-center gap-2.25">
        <span
          className="h-[2px] flex-1 bg-ink"
          style={{ transformOrigin: "left", animation: "rail .5s cubic-bezier(.4,0,.2,1) both" }}
        />
        <span className="font-mono text-[10px] tracking-[0.09em] text-ink-faint">
          {drafts.length} ÉLÉMENT{drafts.length > 1 ? "S" : ""} STRUCTURÉ{drafts.length > 1 ? "S" : ""}
        </span>
      </div>

      {/* Items — type explicite, modifiable avant envoi (jamais deviné seul) */}
      <div className="flex flex-col gap-2">
        {drafts.map((draft, i) => {
          const type = itemType(draft);
          const needsDue = type !== "idea";

          return (
            <div
              key={draft.id}
              className="flex flex-col gap-2.5 rounded-18 border border-ink/[.09] bg-surface px-3.5 py-3.25"
              style={{
                animation: "pop .45s cubic-bezier(.2,.9,.3,1) both",
                animationDelay: `${0.1 + i * 0.15}s`,
              }}
            >
              <span className="text-[14.5px] font-bold tracking-[-0.01em]">{draft.title}</span>
              <TypeSegmented value={type} onChange={(next) => handleTypeChange(draft, next)} />

              {/* Sélecteur de projet — compact, scrollable horizontalement */}
              <ProjectSelector
                projects={projects}
                selectedId={draft.projectId}
                onSelect={(pid) => onUpdateDraft(draft.id, { projectId: pid })}
              />

              {needsDue && (
                <input
                  type="datetime-local"
                  value={isoToLocalInputValue(draft.due)}
                  onChange={(e) => {
                    const iso = localInputToIso(e.target.value);
                    onUpdateDraft(draft.id, { due: iso, allDay: iso ? false : draft.allDay });
                  }}
                  aria-label={type === "event" ? "Date et heure du rendez-vous" : "Échéance de la tâche"}
                  className="h-11 rounded-full bg-bg px-4 text-[13.5px] font-semibold text-ink outline-none"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Buttons */}
      <div className="mt-0.5 flex gap-2.5">
        <button
          onClick={onReplay}
          className="h-[52px] flex-none rounded-full border border-ink/[.12] bg-surface px-5 text-[14.5px] font-bold"
        >
          Rejouer
        </button>
        <button
          onClick={onConfirm}
          className="h-[52px] flex-1 rounded-full bg-ink text-[15.5px] font-bold text-white"
        >
          Ajouter {drafts.length > 1 ? `les ${drafts.length}` : "l'item"}
        </button>
      </div>
    </div>
  );
}