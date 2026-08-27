"use client";

import { CloseIcon } from "./icons";
import type { ReactNode } from "react";

/**
 * InfoSheet — feuille modale réutilisable (bottom sheet).
 *
 * Reprend exactement le motif d'AccountSheet : voile rgba(16,16,16,.34),
 * feuille surface rounded-t-[30px], poignée 5×42, bouton fermer en haut à
 * droite, titre 20/700 tracking-[-0.02em], zone de contenu défilable.
 */

export function InfoSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-90 flex flex-col justify-end"
      style={{ background: "rgba(16,16,16,.34)", animation: "fade .22s both" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex max-h-[85vh] flex-col rounded-t-[30px] bg-surface px-5 pt-3 pb-8.5"
        style={{ animation: "sheet .3s cubic-bezier(.2,.9,.3,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mb-4 flex justify-center">
          <span className="h-[5px] w-[42px] rounded-full bg-ink/[.14]" />
        </div>

        {/* Title + close */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-bold tracking-[-0.02em]">{title}</h2>
          <button
            aria-label="Fermer"
            onClick={onClose}
            className="flex size-11 flex-none items-center justify-center rounded-full bg-bg"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}