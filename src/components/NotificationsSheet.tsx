"use client";

import { InfoSheet } from "./InfoSheet";

/**
 * NotificationsSheet — contenu du bouton cloche.
 * Statut d'abonnement push, test, activation, info de fonctionnement.
 */

export function NotificationsSheet({
  open,
  subscribed,
  onTestPush,
  onEnablePush,
  onClose,
}: {
  open: boolean;
  subscribed: boolean;
  onTestPush: () => void;
  onEnablePush: () => void;
  onClose: () => void;
}) {
  return (
    <InfoSheet open={open} title="Notifications" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Status */}
        <div className="flex items-center justify-between rounded-20 border border-ink/[.06] bg-surface p-4">
          <span className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-ink-faint">
              Statut
            </span>
            <span className="text-[15px] font-bold">
              {subscribed ? "Activées" : "Désactivées"}
            </span>
          </span>
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{
              background: subscribed ? "var(--color-meet-100)" : "var(--color-bg)",
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{
                background: subscribed ? "var(--color-meet-700)" : "var(--color-ink-faint)",
              }}
            />
            <span
              className="text-[12px] font-bold"
              style={{
                color: subscribed ? "var(--color-meet-700)" : "var(--color-ink-muted)",
              }}
            >
              {subscribed ? "Abonné" : "Non abonné"}
            </span>
          </span>
        </div>

        {/* Info text */}
        <p className="text-[13px] font-medium text-ink-muted">
          Les rappels partent du serveur toutes les 60 secondes. Pour les recevoir,
          Brief doit être installé sur ton écran d&apos;accueil (PWA).
        </p>

        {/* Test button */}
        <button
          onClick={onTestPush}
          className="flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[15px] font-bold text-white"
        >
          Tester la notification
        </button>

        {/* Enable button (only if not subscribed) */}
        {!subscribed && (
          <button
            onClick={onEnablePush}
            className="flex h-[52px] w-full items-center justify-center rounded-full border border-ink/[.12] bg-surface text-[15px] font-bold"
          >
            Activer les notifications
          </button>
        )}
      </div>
    </InfoSheet>
  );
}