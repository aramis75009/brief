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
        className="animate-br-in flex max-w-full items-center gap-[9px] rounded-2xl px-[18px] py-[13px] text-[13.5px] leading-[1.35] font-semibold text-surface shadow-[0_12px_30px_-12px_rgba(28,26,24,0.6)]"
        style={{ background: kind === "err" ? "#8E3B22" : "#1C1A18" }}
      >
        <ToastIcon kind={kind} />
        {message}
      </div>
    </div>
  );
}
