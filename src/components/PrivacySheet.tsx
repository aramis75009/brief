"use client";

import { InfoSheet } from "./InfoSheet";

/**
 * PrivacySheet — contenu du NavRow « Confidentialité des notes vocales ».
 * Quatre points sur le traitement des données.
 */

function PrivacyItem({ children }: { children: string }) {
  return (
    <div className="flex items-start gap-3 rounded-20 border border-ink/[.06] bg-surface p-4">
      <span
        className="mt-[5px] size-1.5 flex-none rounded-full bg-ink"
      />
      <p className="text-[13px] font-medium text-ink-muted">{children}</p>
    </div>
  );
}

export function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <InfoSheet open={open} title="Confidentialité des notes vocales" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <PrivacyItem>
          Tes enregistrements vocaux sont envoyés au serveur pour transcription, puis
          supprimés.
        </PrivacyItem>
        <PrivacyItem>
          Les données (tâches, rendez-vous) sont stockées sur le serveur, en France.
        </PrivacyItem>
        <PrivacyItem>Aucune donnée n&apos;est envoyée à un tiers.</PrivacyItem>
        <PrivacyItem>
          Tu peux supprimer ton compte et toutes tes données à tout temps.
        </PrivacyItem>
      </div>
    </InfoSheet>
  );
}