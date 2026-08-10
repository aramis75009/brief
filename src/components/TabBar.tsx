"use client";

import { MicIcon, OverviewIcon, SettingsIcon, TasksIcon } from "./icons";
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

/**
 * Quatre onglets, pas cinq. À 372 px de large, un libellé de 11 px tient encore
 * à quatre ; à cinq il faut tronquer ou passer aux icônes seules, et une icône
 * seule n'est pas une affordance sur mobile (pas de survol pour la révéler).
 */
const TABS: Tab[] = [
  { key: "capture", label: "Capture", Icon: MicIcon, matches: ["capture", "review"] },
  { key: "tasks", label: "Tâches", Icon: TasksIcon, matches: ["tasks"] },
  { key: "overview", label: "Vision", Icon: OverviewIcon, matches: ["overview"] },
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
    <div className="safe-bottom flex flex-none items-start border-t border-[var(--line)] bg-[var(--bar)] px-[18px] pt-2 pb-2 backdrop-blur-[12px] sm:h-[78px] sm:pb-0">
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
