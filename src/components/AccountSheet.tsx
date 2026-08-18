"use client";

import { AccountAvatar } from "./AccountAvatar";
import { CloseIcon, ChevronRightIcon, CalendarIcon, MicIcon, BellIcon } from "./icons";
import type { ReactNode } from "react";

/**
 * AccountSheet — compte & réglages (sheet modal).
 */

export function AccountSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-90 flex flex-col justify-end"
      style={{ background: "rgba(16,16,16,.34)", animation: "fade .22s both" }}
      onClick={onClose}
    >
      <div
        className="rounded-t-[30px] bg-surface px-5 pt-3 pb-8.5"
        style={{ animation: "sheet .3s cubic-bezier(.2,.9,.3,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mb-4 flex justify-center">
          <span className="h-[5px] w-[42px] rounded-full bg-ink/[.14]" />
        </div>

        {/* Profile */}
        <div className="mb-5 flex items-center gap-3.5">
          <AccountAvatar initials="AM" size={56} />
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="text-[19px] font-extrabold tracking-[-0.025em]">Aramis</span>
            <span className="text-[13px] font-semibold text-ink-muted">Brief</span>
          </span>
          <button
            aria-label="Fermer"
            onClick={onClose}
            className="flex size-11 flex-none items-center justify-center rounded-full bg-bg"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Settings section */}
        <div className="mb-3 rounded-20 bg-bg p-1">
          <SettingRow
            icon={<SettingIcon bg="var(--color-meet-100)"><CalendarIcon size={15} className="text-meet-700" /></SettingIcon>}
            title="Calendrier Apple"
            subtitle="Synchronisé il y a 4 min"
            toggleOn={true}
          />
          <div className="mx-3.5 h-px bg-ink/[.06]" />
          <SettingRow
            icon={<SettingIcon bg="var(--color-ink)"><MicIcon size={15} className="text-white" /></SettingIcon>}
            title="Structuration auto"
            subtitle="Découper la dictée sans confirmation"
            toggleOn={false}
          />
          <div className="mx-3.5 h-px bg-ink/[.06]" />
          <SettingRow
            icon={<SettingIcon bg="var(--color-idea-100)"><BellIcon size={15} className="text-idea-700" /></SettingIcon>}
            title="Rappels du matin"
            subtitle="Tous les jours à 8:00"
            toggleOn={true}
          />
        </div>

        {/* Navigation rows */}
        <div className="mb-4 flex flex-col gap-0.5">
          <NavRow label="Voix, langue & transcription" />
          <NavRow label="Confidentialité des notes vocales" />
          <NavRow label="Abonnement" value="Plus" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="h-[52px] w-full rounded-full border border-ink/[.12] bg-surface text-[15px] font-bold"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

function SettingIcon({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <span className="flex size-8 flex-none items-center justify-center rounded-[10px]" style={{ background: bg }}>
      {children}
    </span>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  toggleOn,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  toggleOn: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-[13px]">
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14.5px] font-bold">{title}</span>
        <span className="text-[12px] font-semibold text-ink-muted">{subtitle}</span>
      </span>
      <Toggle on={toggleOn} />
    </div>
  );
}

function NavRow({ label, value }: { label: string; value?: string }) {
  return (
    <button className="flex min-h-[44px] items-center justify-between gap-2 rounded-[14px] px-3.5 py-[13px] text-left">
      <span className="text-[14.5px] font-bold">{label}</span>
      <span className="flex items-center gap-2">
        {value && <span className="text-[12.5px] font-bold text-ink-muted">{value}</span>}
        <ChevronRightIcon size={16} className="text-ink-faint" />
      </span>
    </button>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className="flex flex-none items-center rounded-full p-[3px]"
      style={{
        width: 48,
        height: 29,
        background: on ? "var(--color-ink)" : "rgba(16,16,16,.14)",
        justifyContent: on ? "flex-end" : "flex-start",
      }}
    >
      <span className="size-[23px] rounded-full bg-white" />
    </span>
  );
}