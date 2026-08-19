"use client";

import { ToastIcon } from "./icons";
import type { ToastKind } from "@/lib/types";

export function Toast({ message, kind }: { message: string; kind: ToastKind }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute right-5 bottom-24 left-5 flex justify-center"
      style={{ animation: "fade .25s both" }}
    >
      <div
        className="flex max-w-full items-center gap-[9px] rounded-full bg-surface px-[18px] py-[13px] text-[13px] font-semibold leading-[1.35] text-ink shadow-card border border-ink/[.07]"
      >
        <ToastIcon kind={kind} />
        {message}
      </div>
    </div>
  );
}