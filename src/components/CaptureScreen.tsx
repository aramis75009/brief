"use client";

import { ArrowRightIcon, CloseIcon, MicIcon, StopIcon } from "./icons";
import { MAX_SECONDS, type RecorderError } from "@/lib/useRecorder";
import type { Overview, Phase } from "@/lib/types";

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
  onTranscriptChange: (text: string) => void;
  onStructure: () => void;
  /** Relevé du jour — le MÊME `GET /api/overview` que l'onglet Vision. */
  overview: Overview | null;
  onOpenOverview: () => void;
  onDismissError: () => void;
};

/**
 * Le relevé du jour, à la place des anciennes notes de démo.
 *
 * Les notes de démo disaient « ceci est une démo » : elles occupaient le seul
 * espace où l'on regarde avant de parler, pour ne rien apprendre. À leur place,
 * les deux chiffres qui décident de ce qu'on va dicter.
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
      ? `${top.name} concentre ${top.overdue} des ${totals.overdue} retards.`
      : totals.today > 0
        ? `Rien en retard. ${totals.today} item${totals.today > 1 ? "s" : ""} pour aujourd'hui.`
        : "Rien en retard, rien pour aujourd'hui.";

  const open = Math.max(1, totals.open);
  const pct = (n: number) => `${(n / open) * 100}%`;
  const events = byProject.reduce((n, p) => n + p.events, 0);
  const rest = totals.open - totals.overdue - totals.today - totals.week;

  return (
    <div className="animate-br-in w-full pb-2">
      <div
        className="rounded-tile px-5 pt-[18px] pb-5"
        style={{ background: "var(--color-ink)", color: "var(--color-page)" }}
      >
        <div className="flex items-end gap-5">
          <div>
            <div
              className="tnum text-40 leading-[0.95] font-semibold tracking-[-1.1px]"
              // `--color-error` (#b23a22) sur ce bloc donne 1,9:1 — illisible.
              // `--color-error-on-ink` existe pour ce cas précis.
              style={{ color: "var(--color-error-on-ink)" }}
            >
              {totals.overdue}
            </div>
            <div className="mt-1 text-11 font-semibold tracking-[1.2px] uppercase opacity-60">
              en retard
            </div>
          </div>
          <span
            className="block h-11 w-px"
            style={{ background: "currentColor", opacity: 0.18 }}
          />
          <div>
            <div className="tnum text-40 leading-[0.95] font-semibold tracking-[-1.1px]">
              {totals.today}
            </div>
            <div className="mt-1 text-11 font-semibold tracking-[1.2px] uppercase opacity-60">
              aujourd&apos;hui
            </div>
          </div>
        </div>

        <p className="mt-4 mb-0 text-15 leading-[1.4] font-medium">{sentence}</p>

        <div className="mt-4 flex h-2 gap-[3px]">
          {totals.overdue > 0 && (
            <span
              className="block rounded-full"
              style={{ width: pct(totals.overdue), background: "var(--color-error-on-ink)" }}
            />
          )}
          {totals.today > 0 && (
            <span
              className="block rounded-full"
              style={{ width: pct(totals.today), background: "var(--color-page)" }}
            />
          )}
          {totals.week > 0 && (
            <span
              className="block rounded-full"
              style={{ width: pct(totals.week), background: "currentColor", opacity: 0.34 }}
            />
          )}
          {rest > 0 && (
            <span
              className="block flex-1 rounded-full"
              style={{ background: "currentColor", opacity: 0.14 }}
            />
          )}
        </div>

        <button
          type="button"
          onClick={onOpenOverview}
          className="mt-[18px] flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-field border-none text-13 font-semibold transition-all duration-200 active:scale-[0.985]"
          style={{ background: "var(--on-ink-soft)", color: "currentColor" }}
        >
          Ouvrir la vision globale
          <ArrowRightIcon size={15} />
        </button>
      </div>

      <p className="mx-1 mt-3.5 mb-0 text-13 leading-[1.5] font-normal text-ink-2">
        {totals.open} item{totals.open > 1 ? "s" : ""} ouvert{totals.open > 1 ? "s" : ""} ·{" "}
        {events} rendez-vous · {byProject.length} projet{byProject.length > 1 ? "s" : ""}
      </p>
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
          Écris ta note ou dicte-la, Brief la range.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-3.5 pb-1.5">
        {/* Le relevé du jour d'abord : c'est ce qu'on regarde avant de savoir
            quoi écrire ou dicter. Il s'affiche dès que la charge existe,
            qu'il y ait déjà une note ou non. */}
        {overview && overview.totals.open > 0 && (
          <DaySummary overview={overview} onOpenOverview={onOpenOverview} />
        )}

        {showEmptyHint && overview && overview.totals.open === 0 && (
          <div className="animate-br-in px-1 pt-2">
            <p className="m-0 text-17 leading-[1.45] font-medium text-ink">Rien en cours.</p>
            <p className="mt-1.5 mb-0 text-13 leading-[1.5] font-normal text-ink-2">
              Écris ta note ci-dessous, ou appuie sur le micro et dis ce que tu as à faire.
            </p>
          </div>
        )}

        {/* Zone de note : éditable au clavier, qu'il y ait ou non une dictée.
            Juste sous le relevé du jour : on voit la charge, on écrit, on
            structure. L'état « en attente » (pointillé) n'existe qu'en revue,
            pas ici. */}
        <div className="animate-br-in mt-3 rounded-tile border border-[var(--line)] bg-tile px-[18px] pt-[18px] pb-4 shadow-[var(--e1)]">
          <div className="mb-[9px] flex items-center gap-[7px]">
            <span className="text-11 font-semibold tracking-[1.1px] text-ink-3 uppercase">
              Note
            </span>
            {hasTranscript && (
              <button
                type="button"
                onClick={onClear}
                title="Effacer"
                aria-label="Effacer la note"
                className="-mt-1.5 -mr-1.5 -mb-1.5 ml-auto cursor-pointer border-none bg-transparent p-1.5 text-ink-3 transition-colors duration-200 hover:text-ink"
              >
                <CloseIcon />
              </button>
            )}
          </div>
          <textarea
            value={transcript}
            onChange={(e) => onTranscriptChange(e.target.value)}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Entrée structure directement depuis le clavier.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && transcript.trim()) {
                e.preventDefault();
                onStructure();
              }
            }}
            placeholder="Dicte ta note, ou écris-la ici…"
            aria-label="Note à structurer"
            rows={hasTranscript ? Math.min(6, Math.max(2, transcript.split("\n").length)) : 2}
            className="m-0 w-full resize-none border-none bg-transparent p-0 text-17 leading-[1.55] font-normal text-ink outline-none placeholder:text-ink-3"
          />
        </div>

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
              // Filet intérieur OBLIGATOIRE : le bouton est en `bg-page`, donc
              // de la même couleur que la coque depuis qu'elle est passée en
              // `page`. Sans ce trait, il disparaît purement et simplement.
              ? "cursor-default bg-page text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]"
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
          ) : hasTranscript ? (
            <>
              Structurer la note
              <ArrowRightIcon />
            </>
          ) : (
            // Le libellé dit l'état réel. « Structurer la note » sur un bouton
            // inerte promet une action qui ne peut pas avoir lieu.
            "Rien à structurer"
          )}
        </button>
      </div>
    </div>
  );
}
