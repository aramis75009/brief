"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setPin, verifyPin } from "@/lib/pin";

const LENGTH = 6;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignoré */
    }
  }
}

function BackspaceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 5.5H9.6a2 2 0 0 0-1.5.7l-4.3 5a1.2 1.2 0 0 0 0 1.6l4.3 5a2 2 0 0 0 1.5.7H20a1.5 1.5 0 0 0 1.5-1.5V7A1.5 1.5 0 0 0 20 5.5z" />
      <path d="M12.5 9.8l4.7 4.4M17.2 9.8l-4.7 4.4" />
    </svg>
  );
}

export function PinGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const busyRef = useRef(false);

  const submit = useCallback(
    async (code: string) => {
      busyRef.current = true;
      setChecking(true);
      setError(null);
      try {
        if (await verifyPin(code)) {
          buzz(12);
          setPin(code);
          onUnlocked();
          return;
        }
        setError("Code incorrect.");
      } catch {
        setError("Serveur injoignable. Réessaie.");
      }
      buzz([28, 60, 28]);
      setChecking(false);
      setValue("");
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      busyRef.current = false;
    },
    [onUnlocked],
  );

  const press = useCallback(
    (key: string) => {
      if (busyRef.current || !key) return;
      buzz(8);
      setError(null);

      if (key === "del") {
        setValue((v) => v.slice(0, -1));
        return;
      }

      setValue((v) => {
        if (v.length >= LENGTH) return v;
        const next = v + key;
        if (next.length === LENGTH) void submit(next);
        return next;
      });
    },
    [submit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-between px-6 py-10 safe-top safe-bottom">
      {/* Header Bento & Pastilles de sécurité */}
      <div className="flex flex-col items-center mt-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-[var(--e2)]"
          style={{ background: "var(--color-ink)", color: "var(--color-page)" }}
        >
          <span className="text-24 font-bold tracking-tight text-white">B</span>
        </div>

        <h1 className="mt-4 mb-0 text-27 font-bold tracking-tight text-ink">Brief</h1>
        <p className="mt-1 mb-0 text-center text-13 font-normal text-ink-2">
          Une seule fois sur cet appareil — ensuite Brief s&apos;ouvre direct
        </p>

        {/* Indicateurs de saisie PIN */}
        <div
          className="mt-6 flex gap-3.5"
          role="status"
          aria-label={`${value.length} chiffre(s) sur ${LENGTH}`}
        >
          {Array.from({ length: LENGTH }).map((_, i) => {
            const filled = i < value.length;
            return (
              <span
                key={i}
                className="h-3.5 w-3.5 rounded-full transition-all duration-150"
                style={{
                  background: filled ? "var(--color-action)" : "transparent",
                  border: filled ? "none" : "1.5px solid var(--line-2)",
                  transform: shake ? `translateX(${i % 2 ? 6 : -6}px)` : "none",
                  transitionDuration: shake ? "60ms" : "150ms",
                }}
              />
            );
          })}
        </div>

        {/* Zone de feedback */}
        <div className="mt-3.5 flex h-5 items-center">
          {checking && (
            <span className="animate-br-spin block h-4 w-4 rounded-full border-2 border-[var(--line-2)] border-t-action" />
          )}
          {!checking && error && (
            <span className="animate-br-in text-12 font-semibold text-error">
              {error}
            </span>
          )}
        </div>
      </div>

      {/* Pavé numérique tactile Bento */}
      <div
        className="grid w-full max-w-[280px] grid-cols-3 gap-x-4 gap-y-3.5 mb-2 transition-opacity duration-200"
        style={{ opacity: checking ? 0.4 : 1 }}
      >
        {KEYS.map((key, i) => {
          if (!key) return <span key={`gap-${i}`} />;
          const isDel = key === "del";
          return (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              disabled={checking}
              aria-label={isDel ? "Effacer le dernier chiffre" : key}
              className={
                "flex h-[66px] w-full cursor-pointer items-center justify-center rounded-2xl " +
                "transition-all duration-150 select-none disabled:cursor-default " +
                (isDel
                  ? "border-none bg-transparent text-ink-2 active:scale-90"
                  : "border border-[var(--line)] bg-tile text-24 font-bold text-ink shadow-[var(--e1)] active:scale-95 active:bg-page")
              }
            >
              {isDel ? <BackspaceIcon /> : key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
