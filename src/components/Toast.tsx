"use client";

import { ToastIcon } from "./icons";
import type { ToastKind } from "@/lib/types";

export function Toast({ message, kind }: { message: string; kind: ToastKind }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute right-5 bottom-24 left-5 flex justify-center"
    >
      <div
        className="animate-br-in flex max-w-full items-center gap-[9px] rounded-row px-[18px] py-[13px] text-13 leading-[1.35] font-semibold text-page shadow-[var(--e2)]"
        style={{ background: kind === "err" ? "var(--color-error)" : "var(--color-ink)" }}
      >
        <ToastIcon kind={kind} />
        {message}
      </div>
    </div>
  );
}
