"use client";

import { WaveformActive, WaveformCollapsed } from "./Waveform";
import { VoiceBadge } from "./VoiceBadge";
import { CloseIcon, MicIcon, ArrowRightIcon, StopIcon } from "./icons";
import type { DraftItem, Project } from "@/lib/types";

/**
 * CaptureSheet — sheet modal de capture vocale, 4 stages.
 * idle → listening → transcribing → done
 */

export type CaptureStage = "idle" | "listening" | "transcribing" | "done";

const fmtClock = (s: number) =>
  Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);

export function CaptureSheet({
  open,
  stage,
  seconds,
  transcript,
  drafts,
  projects,
  micError,
  onStartListen,
  onStopListen,
  onSubmitText,
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
  onStartListen: () => void;
  onStopListen: () => void;
  onSubmitText: (text: string) => void;
  onConfirm: () => void;
  onReplay: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-80 flex flex-col justify-end"
      style={{ background: "rgba(16,16,16,.34)", animation: "fade .22s both" }}
      onClick={onClose}
    >
      <div
        className="rounded-t-[30px] bg-surface px-5 pt-3 pb-8"
        style={{ animation: "sheet .3s cubic-bezier(.2,.9,.3,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mb-3.5 flex justify-center">
          <span className="h-[5px] w-[42px] rounded-full bg-ink/[.14]" />
        </div>

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

/* --- Stage 4: Done --- */
function DoneStage({
  transcript,
  drafts,
  projects,
  onReplay,
  onConfirm,
}: {
  transcript: string;
  drafts: DraftItem[];
  projects: Project[];
  onReplay: () => void;
  onConfirm: () => void;
}) {
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

      {/* Items */}
      <div className="flex flex-col gap-2">
        {drafts.map((draft, i) => {
          const proj = projects.find((p) => p.id === draft.projectId);
          const isTask = draft.kind === "task";
          const isIdea = draft.status === "idea";
          const dotColor = isTask ? "var(--color-task-700)" : isIdea ? "var(--color-idea-700)" : "var(--color-meet-700)";
          const label = isTask
            ? `Tâche${draft.due ? ` · ${formatDraftDate(draft.due)}` : ""}`
            : isIdea
            ? "Idée · à trier"
            : `RDV${draft.due ? ` · ${formatDraftDate(draft.due)}` : ""}`;

          return (
            <div
              key={draft.id}
              className="flex items-center gap-3 rounded-18 border border-ink/[.09] bg-surface px-3.5 py-3.25"
              style={{
                animation: "pop .45s cubic-bezier(.2,.9,.3,1) both",
                animationDelay: `${0.1 + i * 0.15}s`,
              }}
            >
              {isIdea ? (
                <span className="flex size-6 flex-none items-center justify-center rounded-8 bg-idea-100">
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--color-idea-700)" strokeWidth={2.6} strokeLinecap="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
                  </svg>
                </span>
              ) : (
                <span className="size-6 flex-none rounded-full border-2 border-ink/[.2]" />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="text-[14.5px] font-bold tracking-[-0.01em]">{draft.title}</span>
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: dotColor }}>
                  <span className="size-[6px] rounded-full" style={{ background: dotColor }} />
                  {label}
                </span>
              </span>
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

function formatDraftDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `aujourd'hui ${time}`;
  if (isTomorrow) return `demain ${time}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + ` ${time}`;
}