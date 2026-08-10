"use client";

import { ArrowRightIcon, CloseIcon, MicIcon, StopIcon } from "./icons";
import { DEMO_NOTES } from "@/lib/demo";
import { MAX_SECONDS, type RecorderError } from "@/lib/useRecorder";
import type { Phase } from "@/lib/types";

const fmtClock = (s: number) =>
  Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);

/** Message d'erreur toujours accompagné d'une sortie : réessayer ou agir. */
export type AppError = {
  title: string;
  steps: string[];
  retryLabel?: string;
  onRetry?: () => void;
};

export type CaptureProps = {
  phase: Phase;
  transcript: string;
  levels: number[];
  seconds: number;
  micError: RecorderError | null;
  appError: AppError | null;
  onToggleMic: () => void;
  onClear: () => void;
  onStructure: () => void;
  onLoadDemo: (text: string) => void;
  onDismissError: () => void;
};

export function CaptureScreen({
  phase,
  transcript,
  levels,
  seconds,
  micError,
  appError,
  onToggleMic,
  onClear,
  onStructure,
  onLoadDemo,
  onDismissError,
}: CaptureProps) {
  const hasTranscript = !!transcript.trim();
  const recording = phase === "recording";
  const working = phase === "uploading" || phase === "transcribing" || phase === "parsing";
  const error = micError ?? (appError ? { title: appError.title, steps: appError.steps } : null);
  const showEmptyHint = !hasTranscript && !error && !working;

  const hint: Record<Phase, string> = {
    idle: hasTranscript ? "Continuer la dictée" : "Appuyer pour dicter",
    recording: `${fmtClock(seconds)} · tape pour arrêter · stop auto ${fmtClock(MAX_SECONDS)}`,
    uploading: "Envoi de l'audio…",
    transcribing: "Transcription en cours…",
    parsing: "Structuration en cours…",
    saving: "Enregistrement…",
    success: hasTranscript ? "Continuer la dictée" : "Appuyer pour dicter",
    error: "Micro indisponible",
  };

  const ctaDisabled = working || phase === "saving" || (!recording && !hasTranscript);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-[26px] pt-2.5 pb-1.5">
        <div className="flex items-baseline justify-between">
          <h1 className="m-0 text-27 font-semibold tracking-[-0.5px] text-ink">Brief</h1>
          <span className="text-11 font-medium text-ink-2">FR</span>
        </div>
        <p className="mt-1 mb-0 text-13 leading-[1.45] font-normal text-ink-2">
          Dicte ta note, Brief la range.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-3.5 pb-1.5">
        {hasTranscript && (
          <div className="animate-br-in rounded-tile border border-[var(--line)] bg-tile px-[18px] pt-[18px] pb-4 shadow-[var(--e1)]">
            <div className="mb-[9px] flex items-center gap-[7px]">
              <span className="text-11 font-semibold tracking-[1.1px] text-ink-3 uppercase">
                Transcription
              </span>
              <button
                type="button"
                onClick={onClear}
                title="Effacer"
                aria-label="Effacer la transcription"
                className="-mt-1.5 -mr-1.5 -mb-1.5 ml-auto cursor-pointer border-none bg-transparent p-1.5 text-ink-3 transition-colors duration-200 hover:text-ink"
              >
                <CloseIcon />
              </button>
            </div>
            <p className="m-0 text-17 leading-[1.55] font-normal text-pretty text-ink whitespace-pre-wrap">
              {transcript}
            </p>
          </div>
        )}

        {working && !hasTranscript && (
          <div className="animate-br-in flex items-center gap-3 rounded-tile border border-[var(--line)] bg-tile px-[18px] py-4">
            <span className="animate-br-spin block h-[17px] w-[17px] flex-none rounded-full border-2 border-[var(--line-2)] border-t-action" />
            <span className="text-13 font-medium text-ink-2">{hint[phase]}</span>
          </div>
        )}

        {error && (
          <div className="animate-br-in mt-3 rounded-tile border border-[var(--color-action)] bg-action-lo px-[18px] pt-4 pb-[18px]">
            <div className="mb-2 flex items-center gap-[7px]">
              <span className="text-11 font-semibold tracking-[1.1px] text-error uppercase">
                Problème
              </span>
              <button
                type="button"
                onClick={onDismissError}
                title="Fermer"
                aria-label="Fermer l'avertissement"
                className="-mt-1.5 -mr-1.5 -mb-1.5 ml-auto cursor-pointer border-none bg-transparent p-1.5 text-error transition-colors duration-200 hover:text-ink"
              >
                <CloseIcon />
              </button>
            </div>
            <p className="m-0 text-15 leading-[1.45] font-semibold text-ink">{error.title}</p>
            {error.steps.length > 0 && (
              <ul className="mt-2.5 mb-0 flex list-none flex-col gap-1.5 p-0">
                {error.steps.map((step) => (
                  <li
                    key={step}
                    className="relative pl-3.5 text-13 leading-[1.5] font-normal text-ink-2 before:absolute before:top-[7px] before:left-0 before:h-[5px] before:w-[5px] before:rounded-full before:bg-action before:content-['']"
                  >
                    {step}
                  </li>
                ))}
              </ul>
            )}
            {appError?.onRetry && (
              <button
                type="button"
                onClick={appError.onRetry}
                className="mt-3.5 h-11 w-full cursor-pointer rounded-field border-none bg-action text-15 font-semibold text-white transition-all duration-200 active:scale-[0.985]"
              >
                {appError.retryLabel ?? "Réessayer"}
              </button>
            )}
          </div>
        )}

        {showEmptyHint && (
          <div className="animate-br-in">
            <p className="mt-0.5 mb-3 text-11 font-semibold tracking-[1.1px] text-ink-3 uppercase">
              Notes de démo
            </p>
            <div className="flex flex-col gap-[9px]">
              {DEMO_NOTES.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => onLoadDemo(text)}
                  className="cursor-pointer rounded-row border border-[var(--line)] bg-tile px-[15px] py-[13px] text-left text-13 leading-[1.5] text-ink-2 shadow-[var(--e1)] transition-all duration-200 hover:-translate-y-px hover:border-[var(--color-action)] hover:text-ink"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-none flex-col items-center gap-3 px-[26px] pt-1.5 pb-3">
        <div className="relative flex h-28 w-28 items-center justify-center">
          {recording && (
            <>
              <span className="animate-br-ring absolute top-3 left-3 h-[88px] w-[88px] rounded-full bg-[rgba(236,82,48,0.22)]" />
              <span className="animate-br-ring absolute top-3 left-3 h-[88px] w-[88px] rounded-full bg-[rgba(236,82,48,0.18)] [animation-delay:0.63s]" />
              <span className="animate-br-ring absolute top-3 left-3 h-[88px] w-[88px] rounded-full bg-[rgba(236,82,48,0.14)] [animation-delay:1.26s]" />
            </>
          )}
          <button
            type="button"
            onClick={onToggleMic}
            disabled={working || phase === "saving"}
            title={recording ? "Arrêter" : "Dicter"}
            aria-label={recording ? "Arrêter l'enregistrement" : "Démarrer la dictée"}
            className="relative flex h-[88px] w-[88px] cursor-pointer items-center justify-center rounded-full border-none text-[#FFF3EE] shadow-[var(--e-mic)] transition-all duration-200 active:scale-95 disabled:cursor-default"
            style={{
              background: recording ? "var(--color-ink)" : working || phase === "saving" ? "var(--color-ink-3)" : "var(--color-action)",
            }}
          >
            {recording ? (
              <span className="flex h-[30px] items-center gap-1" aria-hidden>
                {levels.map((level, i) => (
                  <span
                    key={i}
                    className="block w-1 rounded-[2px] bg-current transition-transform duration-75 ease-out"
                    style={{ height: 30, transform: `scaleY(${level})` }}
                  />
                ))}
              </span>
            ) : working || phase === "saving" ? (
              <span className="animate-br-spin block h-6 w-6 rounded-full border-[2.5px] border-[rgba(255,255,255,0.45)] border-t-[#FFF3EE]" />
            ) : (
              <MicIcon size={34} />
            )}
          </button>
        </div>

        <span className="h-4 text-13 font-medium tracking-[0.1px] text-ink-2 tabular-nums">
          {hint[phase]}
        </span>

        {/* CTA toujours monté : hauteur de bloc constante, jamais rogné. */}
        <button
          type="button"
          onClick={recording ? onToggleMic : onStructure}
          disabled={ctaDisabled}
          aria-busy={working}
          className={
            "flex h-[54px] w-full items-center justify-center gap-[9px] rounded-row border-none " +
            "text-15 font-semibold tracking-[0.1px] transition-all duration-200 " +
            (ctaDisabled
              ? "cursor-default bg-page text-ink-2"
              : recording
                ? "cursor-pointer bg-tile text-ink shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-page active:scale-[0.985]"
                : "cursor-pointer bg-ink text-page hover:bg-ink active:scale-[0.985]")
          }
        >
          {working ? (
            <>
              <span className="animate-br-spin block h-[17px] w-[17px] rounded-full border-2 border-[var(--line-2)] border-t-ink-soft" />
              {phase === "uploading" ? "Envoi…" : phase === "parsing" ? "Structuration…" : "Transcription…"}
            </>
          ) : recording ? (
            <>
              <StopIcon size={18} />
              Arrêter l&apos;enregistrement
            </>
          ) : (
            <>
              Structurer la note
              <ArrowRightIcon />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
