"use client";

/**
 * Waveform — trois variantes du design system.
 *
 * - Active : 21 barres, animate-wave, hauteurs 14-74px
 * - Idle : 5 barres, animate-idle, hauteurs 6-17px
 * - Collapsed : 21 barres, animate-collapse, délais séquentiels
 */

const ACTIVE_BARS = [
  16, 30, 48, 26, 62, 38, 20, 52, 74, 34, 18, 44, 66, 28, 14, 40, 56, 24, 36, 15,
];
const ACTIVE_DELAYS = [
  "-.05s", "-.15s", "-.3s", "-.45s", "-.6s", "-.75s", "-.9s", "-1.05s",
  "-1.2s", "-1.35s", "-1.5s", "-1.65s", "-1.8s", "-1.95s", "-2.1s",
  "-2.25s", "-2.4s", "-2.55s", "-2.7s", "-2.85s",
];

export function WaveformActive({ bars = ACTIVE_BARS }: { bars?: number[] }) {
  return (
    <div className="flex h-[88px] w-full items-center justify-center gap-1">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[5px] rounded-full bg-ink"
          style={{
            height: h,
            animation: "wave .95s ease-in-out infinite",
            animationDelay: ACTIVE_DELAYS[i % ACTIVE_DELAYS.length],
          }}
        />
      ))}
    </div>
  );
}

const IDLE_BARS = [6, 14, 10, 17, 8];
const IDLE_DELAYS = ["0s", "-.2s", "-.4s", "-.6s", "-.8s"];

export function WaveformIdle() {
  return (
    <span className="flex h-[18px] items-end gap-[2.5px]">
      {IDLE_BARS.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-ink"
          style={{
            height: h,
            animation: "idle 1.6s ease-in-out infinite",
            animationDelay: IDLE_DELAYS[i],
          }}
        />
      ))}
    </span>
  );
}

export function WaveformCollapsed({ bars = ACTIVE_BARS }: { bars?: number[] }) {
  return (
    <div className="flex h-[88px] w-full items-center justify-center gap-1">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[5px] rounded-full bg-ink"
          style={{
            height: h,
            transformOrigin: "center",
            animation: "collapse .7s cubic-bezier(.4,0,.2,1) both",
            animationDelay: `${i * 0.03}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Waveform statique pour le fil d'origine (non animée).
 * Barres avant le segment actif en gris, pendant en ink.
 */
export function WaveformStatic({
  totalBars = 24,
  activeStart = 6,
  activeEnd = 12,
}: {
  totalBars?: number;
  activeStart?: number;
  activeEnd?: number;
}) {
  const heights = [
    9, 16, 12, 22, 8, 14, 18, 30, 24, 34, 20, 28, 15, 11, 19, 26, 13, 8, 21, 15,
    10, 17, 9, 23, 12, 7,
  ];
  return (
    <div className="flex h-[34px] items-end gap-[2.5px]">
      {Array.from({ length: totalBars }).map((_, i) => {
        const isActive = i >= activeStart && i < activeEnd;
        return (
          <span
            key={i}
            className="w-[3px] rounded-full"
            style={{
              height: heights[i % heights.length],
              background: isActive ? "#101010" : "#DCDBD5",
            }}
          />
        );
      })}
    </div>
  );
}