"use client";

import { InfoSheet } from "./InfoSheet";

/**
 * VoiceSettingsSheet — contenu du NavRow « Voix, langue & transcription ».
 * Lignes d'information en lecture seule.
 */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-12 bg-bg px-4 py-3.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-ink-faint">
        {label}
      </span>
      <span className="text-[13px] font-bold">{value}</span>
    </div>
  );
}

export function VoiceSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <InfoSheet open={open} title="Voix, langue & transcription" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <InfoRow label="Langue de reconnaissance" value="Français" />
        <InfoRow label="Modèle de transcription" value="Whisper Large v3" />

        <div className="flex flex-col gap-1 rounded-20 border border-ink/[.06] bg-surface p-4">
          <h3 className="text-[15px] font-bold">Structuration automatique</h3>
          <p className="text-[13px] font-medium text-ink-muted">
            L&apos;IA (gpt-oss-20b) structure tes notes en tâches et rendez-vous. Chaque
            dictée est découpée, datée et classée automatiquement.
          </p>
        </div>
      </div>
    </InfoSheet>
  );
}