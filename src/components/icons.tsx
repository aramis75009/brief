/**
 * Icônes reprises du design system Claude Design v1 — mêmes tracés, mêmes
 * épaisseurs. Ne pas substituer une librairie d'icônes : le design fait foi.
 */

type IconProps = {
  size?: number;
  className?: string;
};

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* --- Micro --- */
export function MicIcon({ size = 34, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.9} className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="none" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function MicSmallIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.2} className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="none" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

/* --- Coche --- */
export function CheckIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={3.4} className={className}>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

/* --- Flèches --- */
export function ChevronLeftIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.4} className={className}>
      <path d="M14.5 5L8 12l6.5 7" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.4} className={className}>
      <path d="M9.5 5L16 12l-6.5 7" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.6} className={className}>
      <path d="M5 12h13M12 5l7 7-7 7" />
    </svg>
  );
}

/* --- Navigation --- */
export function HomeIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.1} className={className}>
      <path d="M4 10.5L12 4l8 6.5V20h-5v-5.5H9V20H4z" />
    </svg>
  );
}

export function SearchIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.1} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

export function SearchSmallIcon({ size = 17, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.2} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

export function IdeaIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.1} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

export function PlusIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.6} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/* --- Actions --- */
export function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.6} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function PlayIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 5l11 7-11 7z" />
    </svg>
  );
}

export function StopIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

export function TrashIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.4} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/* --- Statut / meta --- */
export function BellIcon({ size = 19, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.9} className={className}>
      <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
      <path d="M10.5 20a2 2 0 0 0 3 0" />
    </svg>
  );
}

export function HelpIcon({ size = 17, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className={className}>
      <text x="12" y="18" textAnchor="middle" fontSize="17" fontWeight="700" fill="currentColor" stroke="none">?</text>
    </svg>
  );
}

export function ClockIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.4} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function CalendarIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.1} className={className}>
      <rect x="3.5" y="5" width="17" height="15" rx="4" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17" />
    </svg>
  );
}

export function DotsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle cx="5" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

export function StarIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.6l1.7 6.7 6.7 1.7-6.7 1.7L12 19.4l-1.7-6.7L3.6 11l6.7-1.7z" />
    </svg>
  );
}

/* --- Tâches (coche liste) --- */
export function TaskCheckIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.1} className={className}>
      <path d="M4 7l2.5 2.5L11 5" />
      <path d="M4 17l2.5 2.5L11 15" />
      <path d="M14 7h6M14 17h6" />
    </svg>
  );
}

/* --- Legacy icons (temporaire — supprimés avec les anciens composants) --- */
import type { Shape } from "@/lib/types";

export function ProjectDot({ size = 10, className, shape }: IconProps & { shape?: Shape }) {
  return (
    <span
      className={className}
      style={{ display: "inline-block", width: size, height: size, borderRadius: shape === "square" ? 2 : 99, background: "currentColor" }}
    />
  );
}

export function OverviewIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.7} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

export function SettingsIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.7} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function TasksIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.7} className={className}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.4} className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 18, className }: IconProps) {
  return <ChevronLeftIcon size={size} className={className} />;
}

export function ToastIcon({ kind }: { kind: "ok" | "err" }) {
  if (kind === "ok") return <CheckIcon size={16} />;
  return <CloseIcon size={16} />;
}