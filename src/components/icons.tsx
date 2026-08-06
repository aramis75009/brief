/**
 * Icônes reprises trait pour trait de Brief.dc.html — mêmes tracés, mêmes
 * épaisseurs. Ne pas substituer une librairie d'icônes : la maquette fait foi.
 */

type IconProps = {
  size?: number;
  className?: string;
};

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function MicIcon({ size = 34, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.7} className={className}>
      <path d="M12 3.5a2.9 2.9 0 0 1 2.9 2.9v5.2a2.9 2.9 0 0 1-5.8 0V6.4A2.9 2.9 0 0 1 12 3.5z" />
      <path d="M5.4 11.2a6.6 6.6 0 0 0 13.2 0" />
      <path d="M12 17.8v2.7" />
    </svg>
  );
}

export function CloseIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 19, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.9} className={className}>
      <path d="M5 12h13M13 7l5 5-5 5" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.9} className={className}>
      <path d="M19 12H6M11 7l-5 5 5 5" />
    </svg>
  );
}

export function PlusIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.1} className={className}>
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}

export function TrashIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8} className={className}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.4} className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ClockIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function TasksIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.7} className={className}>
      <path d="M4 7l2 2 3-3" />
      <path d="M12 8h8" />
      <path d="M4 16l2 2 3-3" />
      <path d="M12 17h8" />
    </svg>
  );
}

export function SettingsIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.7} className={className}>
      <path d="M4 8h10M18 8h2" />
      <circle cx="16" cy="8" r="2.2" />
      <path d="M4 16h4M12 16h8" />
      <circle cx="10" cy="16" r="2.2" />
    </svg>
  );
}

export function ToastIcon({ kind, size = 17 }: { kind: "ok" | "err"; size?: number }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.2} className="flex-none">
      <path
        d={
          kind === "err"
            ? "M12 8v5M12 16.5v.5M12 3.5L2.5 20h19L12 3.5z"
            : "M4 12.5l5 5L20 6.5"
        }
      />
    </svg>
  );
}

export function StopIcon({ size = 26, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
      <rect x="7" y="7" width="10" height="10" rx="2.4" />
    </svg>
  );
}
