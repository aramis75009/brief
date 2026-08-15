"use client";

import { useEffect, useRef } from "react";
import { ArrowRightIcon, CloseIcon, MicIcon, StopIcon } from "./icons";
import { type RecorderError } from "@/lib/useRecorder";
import type { Overview, Phase } from "@/lib/types";

const fmtClock = (s: number) =>
  Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);

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
  onTranscriptChange: (text: string) => void;
  onStructure: () => void;
  overview: Overview | null;
  onOpenOverview: () => void;
  onDismissError: () => void;
};

/**
 * Relevé du jour Bento — Carte haute lisibilité avec compteurs forts et jauge d'urgence
 */
function DaySummary({
  overview,
  onOpenOverview,
}: {
  overview: Overview;
  onOpenOverview: () => void;
}) {
  const { totals, byProject } = overview;
  const top = [...byProject].sort((a, b) => b.overdue - a.overdue)[0];

  const sentence =
    totals.overdue > 0 && top && top.overdue > 0
      ? `Priorité : apurer ${top.name} (${top.overdue} retard${top.overdue > 1 ? "s" : ""})`
      : totals.today > 0
        ? `Tout est fluide · ${totals.today} tâche${totals.today > 1 ? "s" : ""} pour aujourd'hui`
        : "À jour · Aucune urgence en attente";

  const open = Math.max(1, totals.open);
  const pct = (n: number) => `${(n / open) * 100}%`;
  const rest = totals.open - totals.overdue - totals.today - totals.week;

  return (
    <div className="animate-br-in w-full pb-1">
      <div
        className="rounded-tile border bg-tile p-4.5 shadow-[var(--e1)]"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <span className="block text-11 font-semibold tracking-wider text-ink-3 uppercase">
                En retard
              </span>
              <span
                className="tnum text-32 leading-[1] font-bold tracking-tight"
                style={{ color: totals.overdue > 0 ? "var(--color-error)" : "var(--color-ink-3)" }}
              >
                {totals.overdue}
              </span>
            </div>

            <span className="block h-8 w-px bg-page" />

            <div>
              <span className="block text-11 font-semibold tracking-wider text-ink-3 uppercase">
                Aujourd&apos;hui
              </span>
              <span
                className="tnum text-32 leading-[1] font-bold tracking-tight"
                style={{ color: totals.today > 0 ? "var(--color-action)" : "var(--color-ink)" }}
              >
                {totals.today}
              </span>
            </div>

            <span className="block h-8 w-px bg-page" />

            <div>
              <span className="block text-11 font-semibold tracking-wider text-ink-3 uppercase">
                Total
              </span>
              <span className="tnum text-32 leading-[1] font-bold tracking-tight text-ink">
                {totals.open}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenOverview}
            className="flex h-8 items-center gap-1.5 rounded-chip border border-[var(--line-2)] bg-page px-3 text-11 font-semibold text-ink transition-transform active:scale-95"
          >
            Vision
            <ArrowRightIcon size={12} />
          </button>
        </div>

        <p className="mt-3.5 mb-2.5 text-13 font-medium text-ink-2">{sentence}</p>

        {/* Jauge d'avancement globale */}
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-page gap-0.5">
          {totals.overdue > 0 && (
            <span
              className="block rounded-full"
              style={{ width: pct(totals.overdue), background: "var(--color-error)" }}
            />
          )}
          {totals.today > 0 && (
            <span
              className="block rounded-full"
              style={{ width: pct(totals.today), background: "var(--color-action)" }}
            />
          )}
          {totals.week > 0 && (
            <span
              className="block rounded-full opacity-50"
              style={{ width: pct(totals.week), background: "var(--color-ink)" }}
            />
          )}
          {rest > 0 && (
            <span className="block flex-1 rounded-full opacity-20" style={{ background: "var(--color-ink)" }} />
          )}
        </div>
      </div>
    </div>
  );
}

export function CaptureScreen({
  phase,
  transcript,
  levels,
  seconds,
  micError,
  appError,
  onToggleMic,
  onClear,
  onTranscriptChange,
  onStructure,
  overview,
  onOpenOverview,
  onDismissError,
}: CaptureProps) {
  const hasTranscript = !!transcript.trim();
  const recording = phase === "recording";
  const working = phase === "uploading" || phase === "transcribing" || phase === "parsing";
  const error = micError ?? (appError ? { title: appError.title, steps: appError.steps } : null);

  const hint: Record<Phase, string> = {
    idle: hasTranscript ? "Note prête à structurer" : "Touche le micro ou écris ci-dessous",
    recording: `${fmtClock(seconds)} · Enregistrement en cours`,
    uploading: "Envoi de l'audio…",
    transcribing: "Transcription Whisper…",
    parsing: "Découpage & assignation IA…",
    saving: "Enregistrement sur Brief…",
    success: "Note enregistrée avec succès",
    error: "Micro indisponible",
  };

  const ctaDisabled = working || phase === "saving" || (!recording && !hasTranscript);
  const canStructure = !ctaDisabled && !recording;

  const noteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [transcript]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header épuré & statut */}
      <div className="flex-none px-[26px] pt-2 pb-1">
        <h1 className="m-0 text-27 font-bold tracking-tight text-ink">Capture</h1>
        <p className="mt-0.5 mb-0 text-13 font-normal text-ink-2">
          Dicte ou saisis ta note, l&apos;IA organise tout.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-2 pb-2">
        {/* Relevé du jour dynamique */}
        {overview && overview.totals.open > 0 && (
          <DaySummary overview={overview} onOpenOverview={onOpenOverview} />
        )}

        {/* Zone de note principale — Carte Bento Hero */}
        <div
          className="animate-br-in mt-2.5 rounded-tile border bg-tile p-4.5 shadow-[var(--e1)] transition-all"
          style={{ borderColor: recording ? "var(--color-action)" : "var(--line)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-11 font-semibold tracking-wider text-ink-3 uppercase">
              {recording ? "Transcription en direct..." : "Note à organiser"}
            </span>
            {hasTranscript && !recording && (
              <button
                type="button"
                onClick={onClear}
                title="Effacer la note"
                aria-label="Effacer la note"
                className="cursor-pointer border-none bg-transparent p-1 text-12 font-medium text-ink-3 hover:text-ink"
              >
                Effacer
              </button>
            )}
          </div>

          <textarea
            ref={noteRef}
            value={transcript}
            onChange={(e) => onTranscriptChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canStructure) {
                e.preventDefault();
                onStructure();
              }
            }}
            placeholder="Ex : Poster 10 polos pour Frip & Trend demain 14h, puis rdv dentiste mardi à 10h..."
            aria-label="Note à structurer"
            rows={3}
            className="m-0 max-h-[38vh] w-full resize-none overflow-y-auto border-none bg-transparent p-0 text-17 leading-[1.5] font-medium text-ink outline-none placeholder:text-ink-3 placeholder:font-normal"
          />
        </div>

        {/* Indicateur de traitement */}
        {working && (
          <div className="animate-br-in mt-3 flex items-center gap-3 rounded-tile border bg-tile p-4 shadow-[var(--e1)]" style={{ borderColor: "var(--line)" }}>
            <span className="animate-br-spin block h-4.5 w-4.5 flex-none rounded-full border-2 border-[var(--line-2)] border-t-action" />
            <span className="text-13 font-semibold text-ink">{hint[phase]}</span>
          </div>
        )}

        {/* Alerte Erreur */}
        {error && (
          <div className="animate-br-in mt-3 rounded-tile border bg-action-lo p-4" style={{ borderColor: "var(--color-action)" }}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-11 font-bold tracking-wider text-error uppercase">Erreur</span>
              <button
                type="button"
                onClick={onDismissError}
                aria-label="Fermer"
                className="cursor-pointer border-none bg-transparent p-1 text-error"
              >
                <CloseIcon size={14} />
              </button>
            </div>
            <p className="m-0 text-14 font-semibold text-ink">{error.title}</p>
            {error.steps.length > 0 && (
              <ul className="mt-2 mb-0 flex list-none flex-col gap-1 p-0">
                {error.steps.map((step, idx) => (
                  <li key={idx} className="text-12 font-normal text-ink-2">
                    • {step}
                  </li>
                ))}
              </ul>
            )}
            {appError?.onRetry && (
              <button
                type="button"
                onClick={appError.onRetry}
                className="mt-3 h-9 w-full cursor-pointer rounded-chip border-none bg-action text-13 font-semibold text-white active:scale-95"
              >
                {appError.retryLabel ?? "Réessayer"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Zone de contrôle Micro & Actions */}
      <div className="flex flex-none flex-col items-center gap-2.5 px-[26px] pt-1 pb-3">
        <div className="relative flex h-24 w-24 items-center justify-center">
          {recording && (
            <>
              <span className="animate-br-ring absolute h-[82px] w-[82px] rounded-full bg-[rgba(236,82,48,0.25)]" />
              <span className="animate-br-ring absolute h-[82px] w-[82px] rounded-full bg-[rgba(236,82,48,0.20)] [animation-delay:0.5s]" />
            </>
          )}

          <button
            type="button"
            onClick={onToggleMic}
            disabled={working || phase === "saving"}
            title={recording ? "Arrêter l'enregistrement" : "Démarrer la dictée"}
            aria-label={recording ? "Arrêter l'enregistrement" : "Démarrer la dictée"}
            className="relative flex h-[76px] w-[76px] cursor-pointer items-center justify-center rounded-full border-none text-white shadow-[var(--e-mic)] transition-all duration-200 active:scale-95 disabled:cursor-default"
            style={{
              background: recording
                ? "var(--color-ink)"
                : working || phase === "saving"
                  ? "var(--color-ink-3)"
                  : "var(--color-action)",
            }}
          >
            {recording ? (
              <span className="flex h-[26px] items-center gap-1" aria-hidden>
                {levels.map((level, i) => (
                  <span
                    key={i}
                    className="block w-1 rounded-[2px] bg-white transition-transform duration-75 ease-out"
                    style={{ height: 26, transform: `scaleY(${level})` }}
                  />
                ))}
              </span>
            ) : working || phase === "saving" ? (
              <span className="animate-br-spin block h-5 w-5 rounded-full border-[2.5px] border-[rgba(255,255,255,0.45)] border-t-white" />
            ) : (
              <MicIcon size={32} />
            )}
          </button>
        </div>

        <span className="text-12 font-medium text-ink-2 tabular-nums">
          {hint[phase]}
        </span>

        {/* Bouton d'action plein format */}
        {(recording || working || phase === "saving" || hasTranscript) && (
          <button
            type="button"
            onClick={recording ? onToggleMic : onStructure}
            disabled={ctaDisabled}
            aria-busy={working}
            className={
              "flex h-[50px] w-full items-center justify-center gap-2 rounded-row border-none " +
              "text-15 font-semibold transition-all duration-200 " +
              (ctaDisabled
                ? "cursor-default bg-page text-ink-3"
                : recording
                  ? "cursor-pointer bg-tile text-ink shadow-[var(--e1)] border border-[var(--line-2)] hover:bg-page active:scale-95"
                  : "cursor-pointer bg-ink text-page shadow-[var(--e2)] active:scale-95")
            }
          >
            {working ? (
              <>
                <span className="animate-br-spin block h-4 w-4 rounded-full border-2 border-[var(--line-2)] border-t-white" />
                <span>{phase === "uploading" ? "Envoi audio..." : phase === "parsing" ? "Organisation IA..." : "Transcription..."}</span>
              </>
            ) : recording ? (
              <>
                <StopIcon size={16} />
                <span>Arrêter l&apos;enregistrement</span>
              </>
            ) : (
              <>
                <span>Organiser avec l&apos;IA</span>
                <ArrowRightIcon size={16} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
