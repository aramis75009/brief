"use client";

import type { ReactNode } from "react";

/**
 * Card — wrapper de carte.
 * bg-surface, border hairline, radius-20, padding-4.
 */

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`border border-ink/[.06] bg-surface rounded-20 p-4 ${onClick ? "text-left cursor-pointer" : ""} ${className}`}
    >
      {children}
    </Comp>
  );
}