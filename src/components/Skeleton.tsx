"use client";

/**
 * Skeleton — état de chargement.
 * Barres shimmer avec délais alternés, reprises du design system.
 */

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span
        className="size-[26px] shrink-0 rounded-full"
        style={{
          background:
            "linear-gradient(90deg,#EFEEEA 8%,#E2E1DC 18%,#EFEEEA 33%)",
          backgroundSize: "220px 100%",
          animation: "shimmer 1.1s linear infinite",
        }}
      />
      <span className="flex flex-1 flex-col gap-[7px]">
        <span
          className="h-[11px] w-[72%] rounded-full"
          style={{
            background:
              "linear-gradient(90deg,#EFEEEA 8%,#E2E1DC 18%,#EFEEEA 33%)",
            backgroundSize: "220px 100%",
            animation: "shimmer 1.1s linear infinite",
          }}
        />
        <span
          className="h-[9px] w-[38%] rounded-full"
          style={{
            background:
              "linear-gradient(90deg,#EFEEEA 8%,#E2E1DC 18%,#EFEEEA 33%)",
            backgroundSize: "220px 100%",
            animation: "shimmer 1.1s linear infinite",
            animationDelay: "-.2s",
          }}
        />
      </span>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <span
      className="block rounded-20 border border-ink/[.05]"
      style={{
        height: 72,
        background:
          "linear-gradient(90deg,#fff 8%,#F1F0EC 18%,#fff 33%)",
        backgroundSize: "220px 100%",
        animation: "shimmer 1.1s linear infinite",
      }}
    />
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="rounded-20 border border-ink/[.06] bg-surface px-1 py-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <SkeletonRow />
          {i < count - 1 && (
            <div className="mx-3.5 h-px bg-ink/[.06]" />
          )}
        </div>
      ))}
    </div>
  );
}