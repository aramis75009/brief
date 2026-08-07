"use client";

import { ArrowRightIcon, CloseIcon, MicIcon, StopIcon } from "./icons";
import { DEMO_NOTES } from "@/lib/mock";
import { MAX_SECONDS, type RecorderError } from "@/lib/useRecorder";

const fmtClock = (s: number) =>
  Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);

export type CaptureProps = {
  langShort: string;
  transcript: string;
  recording: boolean;
  busy: boolean;
  transcribing: boolean;
  seconds: number;
  levels: number[];
  error: RecorderError | null;
  onToggleMic: () => void;
  onClear: () => void;
  onStructure: () => void;
  onLoadDemo: (text: string) => void;
  onDismissError: () => void;
};

export function CaptureScreen({
  langShort,
  transcript,
  recording,
  busy,
  transcribing,
  seconds,
  levels,
  error,
  onToggleMic,
  onClear,
  onStructure,
  onLoadDemo,
  onDismissError,
}: CaptureProps) {
  const hasTranscript = !!transcript.trim();
  const showEmptyHint = !hasTranscript && !error && !transcribing;

  // Un seul CTA, trois états : arrêter (pendant l'enregistrement), attendre
  // (pendant la transcription), structurer (dès qu'il y a du texte).
  const ctaDisabled = transcribing || busy || (!recording && !hasTranscript);
  const ctaAction = recording ? onToggleMic : onStructure;

  const micHint = error
    ? "Micro indisponible"
    : busy
      ? "Autorise le micro…"
      : transcribing
        ? "Transcription en cours…"
        : recording
          ? `${fmtClock(seconds)} · tape pour arrêter`
          : hasTranscript
            ? "Continuer la dictée"
            : "Appuyer pour dicter";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-[26px] pt-2.5 pb-1.5">
        <div className="flex items-baseline justify-between">
          <h1 className="m-0 text-[27px] font-semibold tracking-[-0.5px] text-ink">Brief</h1>
          <span className="text-xs font-medium text-muted">{langShort}</span>
        </div>
        <p className="mt-1 mb-0 text-[13.5px] leading-[1.45] font-normal text-muted">
          Dicte ta note, elle part en Quick Add Todoist.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-3.5 pb-1.5">
        {hasTranscript && (
          <div className="animate-br-in rounded-[22px] border border-[rgba(28,26,24,0.07)] bg-card px-[18px] pt-[18px] pb-4 shadow-[0_2px_10px_-6px_rgba(28,26,24,0.18)]">
            <div className="mb-[9px] flex items-center gap-[7px]">
              <span className="text-[10.5px] font-semibold tracking-[1.1px] text-muted-2 uppercase">
                Transcription
              </span>
              <button
                type="button"
                onClick={onClear}
                title="Effacer"
                aria-label="Effacer la transcription"
                className="-mt-1.5 -mr-1.5 -mb-1.5 ml-auto cursor-pointer border-none bg-transparent p-1.5 text-muted-2 transition-colors duration-200 hover:text-ink"
              >
                <CloseIcon />
              </button>
            </div>
            <p className="m-0 text-[16.5px] leading-[1.55] font-normal text-pretty text-ink whitespace-pre-wrap">
              {transcript}
            </p>
          </div>
        )}

        {transcribing && !hasTranscript && (
          <div className="animate-br-in flex items-center gap-3 rounded-[22px] border border-[rgba(28,26,24,0.07)] bg-card px-[18px] py-4">
            <span className="animate-br-spin block h-[17px] w-[17px] flex-none rounded-full border-2 border-[rgba(28,26,24,0.15)] border-t-accent" />
            <span className="text-[13.5px] font-medium text-muted">
              Transcription en cours…
            </span>
          </div>
        )}

        {error && (
          <div className="animate-br-in rounded-[22px] border border-[rgba(192,96,60,0.35)] bg-accent-soft px-[18px] pt-4 pb-[18px]">
            <div className="mb-2 flex items-center gap-[7px]">
              <span className="text-[10.5px] font-semibold tracking-[1.1px] text-accent-deep uppercase">
                Micro
              </span>
              <button
                type="button"
                onClick={onDismissError}
                title="Fermer"
                aria-label="Fermer l'avertissement"
                className="-mt-1.5 -mr-1.5 -mb-1.5 ml-auto cursor-pointer border-none bg-transparent p-1.5 text-accent-deep transition-colors duration-200 hover:text-ink"
              >
                <CloseIcon />
              </button>
            </div>
            <p className="m-0 text-[15px] leading-[1.45] font-semibold text-ink">{error.title}</p>
            <ul className="mt-2.5 mb-0 flex list-none flex-col gap-1.5 p-0">
              {error.steps.map((step) => (
                <li
                  key={step}
                  className="relative pl-3.5 text-[12.5px] leading-[1.5] font-normal text-ink-soft before:absolute before:top-[7px] before:left-0 before:h-[5px] before:w-[5px] before:rounded-full before:bg-accent before:content-['']"
                >
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showEmptyHint && (
          <div className="animate-br-in">
            <p className="mt-0.5 mb-3 text-[11px] font-semibold tracking-[1.1px] text-muted-2 uppercase">
              Notes de démo
            </p>
            <div className="flex flex-col gap-[9px]">
              {DEMO_NOTES.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => onLoadDemo(text)}
                  className="cursor-pointer rounded-[18px] border border-[rgba(28,26,24,0.08)] bg-card px-[15px] py-[13px] text-left text-[13.5px] leading-[1.5] text-ink-soft shadow-[0_1px_3px_-2px_rgba(28,26,24,0.2)] transition-all duration-200 hover:-translate-y-px hover:border-[rgba(192,96,60,0.4)] hover:text-ink"
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
              <span className="animate-br-ring absolute top-3 left-3 h-[88px] w-[88px] rounded-full bg-[rgba(192,96,60,0.22)]" />
              <span className="animate-br-ring absolute top-3 left-3 h-[88px] w-[88px] rounded-full bg-[rgba(192,96,60,0.18)] [animation-delay:0.63s]" />
              <span className="animate-br-ring absolute top-3 left-3 h-[88px] w-[88px] rounded-full bg-[rgba(192,96,60,0.14)] [animation-delay:1.26s]" />
            </>
          )}
          <button
            type="button"
            onClick={onToggleMic}
            disabled={busy || transcribing}
            title={recording ? "Arrêter" : "Dicter"}
            aria-label={recording ? "Arrêter l'enregistrement" : "Démarrer la dictée"}
            className="relative flex h-[88px] w-[88px] cursor-pointer items-center justify-center rounded-full border-none text-[#FFF3EE] shadow-[0_10px_26px_-10px_rgba(192,96,60,0.65)] transition-all duration-200 active:scale-95 disabled:cursor-default"
            style={{
              background: recording ? "#1C1A18" : busy || transcribing ? "#D8CFC9" : "#C0603C",
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
            ) : busy || transcribing ? (
              <span className="animate-br-spin block h-6 w-6 rounded-full border-[2.5px] border-[rgba(255,255,255,0.45)] border-t-[#FFF3EE]" />
            ) : (
              <MicIcon size={34} />
            )}
          </button>
        </div>

        <span className="h-4 text-[12.5px] font-medium tracking-[0.1px] text-muted tabular-nums">
          {recording ? `${micHint} · stop auto ${fmtClock(MAX_SECONDS)}` : micHint}
        </span>

        {/* CTA toujours monté : la hauteur du bloc bas ne varie pas, donc il ne
            peut plus être rogné par la tab bar quand une transcription arrive. */}
        <button
          type="button"
          onClick={ctaAction}
          disabled={ctaDisabled}
          aria-busy={transcribing}
          className={
            "flex h-[54px] w-full items-center justify-center gap-[9px] rounded-[18px] border-none " +
            "text-base font-semibold tracking-[0.1px] transition-all duration-200 " +
            (ctaDisabled
              ? "cursor-default bg-disabled text-ink-soft"
              : recording
                ? "cursor-pointer bg-card text-ink shadow-[inset_0_0_0_1px_rgba(28,26,24,0.1)] hover:bg-stone-1 active:scale-[0.985]"
                : "cursor-pointer bg-ink text-surface hover:bg-ink-hover active:scale-[0.985]")
          }
        >
          {transcribing ? (
            <>
              <span className="animate-br-spin block h-[17px] w-[17px] rounded-full border-2 border-[rgba(28,26,24,0.2)] border-t-ink-soft" />
              Transcription…
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
