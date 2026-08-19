"use client";

import type { ReactNode } from "react";

/**
 * EmptyState — encart état vide.
 * Cercle dashed + icône + titre + description + bouton optionnel.
 */

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-20 border border-ink/[.06] bg-surface px-[22px] py-[30px] text-center">
      <span className="flex size-[52px] items-center justify-center rounded-full border-2 border-dashed border-ink/[.18]">
        {icon}
      </span>
      <span className="text-[17px] font-bold tracking-[-0.02em]">{title}</span>
      {description && (
        <span className="max-w-[210px] text-[13px] font-medium leading-[1.45] text-ink-muted">
          {description}
        </span>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 min-h-[44px] rounded-full bg-ink px-5 py-[11px] text-[14px] font-bold text-white hover:bg-[#2C2C29]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}