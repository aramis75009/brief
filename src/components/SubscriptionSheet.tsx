"use client";

import { InfoSheet } from "./InfoSheet";

/**
 * SubscriptionSheet — contenu du NavRow « Abonnement ».
 * Plan actuel + informations sur la gratuité.
 */

export function SubscriptionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <InfoSheet open={open} title="Abonnement" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Current plan */}
        <div className="flex items-center justify-between rounded-20 border border-ink/[.06] bg-surface p-4">
          <span className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-ink-faint">
              Plan actuel
            </span>
            <span className="text-[15px] font-bold">Plus</span>
          </span>
          <span className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-white">
            Plus
          </span>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-ink-muted">
            Brief est gratuit pour l'instant.
          </p>
          <p className="text-[13px] font-medium text-ink-muted">
            Tu profites de toutes les fonctionnalités sans limite.
          </p>
        </div>
      </div>
    </InfoSheet>
  );
}