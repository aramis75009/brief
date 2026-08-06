"use client";

import { useEffect, useRef, useState } from "react";
import { MicIcon } from "./icons";
import { setPin, verifyPin } from "@/lib/pin";

const LENGTH = 6;

/**
 * Écran de saisie du PIN. Il ne "déverrouille" rien localement : il valide le
 * code auprès du serveur (/api/session) puis le range en sessionStorage pour
 * que les appels /api/* suivants portent le header x-brief-pin.
 */
export function PinGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (code: string) => {
    setChecking(true);
    setError(null);
    try {
      const ok = await verifyPin(code);
      if (ok) {
        setPin(code);
        onUnlocked();
        return;
      }
      setError("Code incorrect.");
    } catch {
      setError("Serveur injoignable. Réessaie.");
    }
    setChecking(false);
    setValue("");
    setShake(true);
    setTimeout(() => setShake(false), 420);
    inputRef.current?.focus();
  };

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, LENGTH);
    setValue(digits);
    setError(null);
    if (digits.length === LENGTH) void submit(digits);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8">
      <div
        className="flex h-[72px] w-[72px] items-center justify-center rounded-[26px] text-[#FFF3EE] shadow-[0_10px_26px_-10px_rgba(192,96,60,0.65)]"
        style={{ background: "#C0603C" }}
      >
        <MicIcon size={32} />
      </div>

      <h1 className="mt-6 mb-0 text-[27px] font-semibold tracking-[-0.5px] text-ink">Brief</h1>
      <p className="mt-1.5 mb-0 text-center text-[13.5px] leading-[1.45] font-normal text-muted">
        Saisis ton code pour accéder à l&apos;app.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        aria-label="Saisir le code"
        className="mt-8 flex cursor-pointer gap-2.5 border-none bg-transparent p-0"
        style={{ transform: shake ? "translateX(0)" : undefined }}
      >
        {Array.from({ length: LENGTH }).map((_, i) => {
          const filled = i < value.length;
          return (
            <span
              key={i}
              className="h-[15px] w-[15px] rounded-full transition-all duration-150"
              style={{
                background: filled ? "#C0603C" : "transparent",
                border: filled ? "none" : "1.5px solid #D8CFC9",
                transform: shake ? `translateX(${i % 2 ? 3 : -3}px)` : "none",
              }}
            />
          );
        })}
      </button>

      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="Code d'accès"
        disabled={checking}
        // Champ réel mais invisible : le clavier numérique iOS s'ouvre au tap
        // sur les pastilles, sans qu'on ait à reconstruire un pavé maison.
        className="absolute h-px w-px opacity-0"
      />

      <div className="mt-6 flex h-6 items-center">
        {checking && (
          <span className="animate-br-spin block h-4 w-4 rounded-full border-2 border-[rgba(28,26,24,0.15)] border-t-accent" />
        )}
        {!checking && error && (
          <span className="animate-br-in text-[13px] font-semibold text-accent-deep">{error}</span>
        )}
      </div>
    </div>
  );
}
