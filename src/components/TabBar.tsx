"use client";

import { MicIcon, SettingsIcon, TasksIcon } from "./icons";
import type { View } from "@/lib/types";

const ACTIVE = "var(--color-action)";
const IDLE = "var(--color-ink-3)";

type Tab = {
  key: View;
  label: string;
  Icon: typeof MicIcon;
  /** La vue Revue reste rattachée à l'onglet Capture. */
  matches: View[];
};

const TABS: Tab[] = [
  { key: "capture", label: "Capture", Icon: MicIcon, matches: ["capture", "review"] },
  { key: "tasks", label: "Tâches", Icon: TasksIcon, matches: ["tasks"] },
  { key: "settings", label: "Réglages", Icon: SettingsIcon, matches: ["settings"] },
];

export function TabBar({
  view,
  onNavigate,
}: {
  view: View;
  onNavigate: (v: View) => void;
}) {
  return (
    <div className="safe-bottom flex flex-none items-start border-t border-[var(--line)] bg-[rgba(250,248,245,0.94)] px-[18px] pt-2 pb-2 backdrop-blur-[12px] sm:h-[78px] sm:pb-0">
      {TABS.map(({ key, label, Icon, matches }) => {
        const on = matches.includes(view);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            aria-current={on ? "page" : undefined}
            className="flex h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-field border-none bg-transparent transition-all duration-200"
            style={{ color: on ? ACTIVE : IDLE }}
          >
            <Icon size={22} />
            <span className="text-11 font-semibold tracking-[0.2px]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
