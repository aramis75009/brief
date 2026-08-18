"use client";

import { WaveformIdle } from "./Waveform";
import { MicIcon } from "./icons";

/**
 * CaptureBar — barre de capture fixe.
 * Pill blanche avec ombre card, waveform idle à gauche,
 * placeholder, bouton micro à droite.
 */

export function CaptureBar({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex-none px-5 pt-2.5">
      <button
        onClick={onClick}
        className="flex h-14 w-full items-center gap-3 rounded-full border border-ink/[.07] bg-surface px-[18px] py-1.5 shadow-card"
      >
        <WaveformIdle />
        <span className="flex-1 text-left text-[14.5px] font-semibold text-ink-faint">
          Dis-moi ce que tu as en tête…
        </span>
        <span className="flex size-[44px] flex-none items-center justify-center rounded-full bg-ink">
          <MicIcon size={18} className="text-white" />
        </span>
      </button>
    </div>
  );
}