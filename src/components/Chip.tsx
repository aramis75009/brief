"use client";

import type { ReactNode } from "react";

/**
 * Chip — pill d'étiquette.
 * Variantes : task (bleu), meet (vert), idea (jaune), neutral (border).
 */

type Variant = "task" | "meet" | "idea" | "neutral";

const VARIANTS: Record<Variant, string> = {
  task: "bg-task-100 text-task-700",
  meet: "bg-meet-100 text-meet-700",
  idea: "bg-idea-100 text-idea-700",
  neutral: "border border-ink/[.08] bg-surface text-ink",
};

export function Chip({
  children,
  variant = "neutral",
  className = "",
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-[7px] text-[12px] font-bold ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}