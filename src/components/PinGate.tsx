"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./icons";
import { setPin, verifyPin } from "@/lib/pin";

const LENGTH = 6;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

/** Retour haptique quand la plateforme le propose. iOS Safari ne l'expose pas. */
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
      width={26}
      height={26}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 5.5H9.6a2 2 0 0 0-1.5.7l-4.3 5a1.2 1.2 0 0 0 0 1.6l4.3 5a2 2 0 0 0 1.5.7H20a1.5 1.5 0 0 0 1.5-1.5V7A1.5 1.5 0 0 0 20 5.5z" />
      <path d="M12.5 9.8l4.7 4.4M17.2 9.8l-4.7 4.4" />
    </svg>
  );
}

/**
 * Écran de saisie du PIN — pavé numérique dessiné, à la manière du
 * déverrouillage iOS.
 *
 * ⚠️ Aucun élément de saisie natif (`<input>`) : le clavier système ne doit
 * jamais s'ouvrir. Ne pas « simplifier » en réintroduisant un champ masqué.
 *
 * L'écran ne déverrouille rien localement : il valide le code auprès de
 * /api/session puis le range en sessionStorage pour les appels suivants.
 */
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

  // Confort clavier physique (bureau). N'ouvre aucun clavier logiciel sur iOS.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    // Centré verticalement, et non collé en haut et en bas : l'espace restant
    // sous la barre d'état varie beaucoup entre un iPhone à encoche et un écran
    // sans. Centrer est la seule disposition où rien ne passe sous l'encoche.
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[52px] px-[30px] pb-6">
      <div className="flex flex-col items-center">
        <BrandMark size={72} />

        <h1 className="mt-5 mb-0 text-27 font-semibold tracking-[-0.5px] text-ink">Brief</h1>
        <p className="mt-1.5 mb-0 text-center text-13 leading-[1.45] font-normal text-ink-2">
          Saisis ton code pour ouvrir l&apos;app.
        </p>

        <div
          className="mt-7 flex gap-3.5"
          role="status"
          aria-label={`${value.length} chiffre(s) sur ${LENGTH}`}
        >
          {Array.from({ length: LENGTH }).map((_, i) => {
            const filled = i < value.length;
            return (
              <span
                key={i}
                className="h-[15px] w-[15px] rounded-full transition-all duration-150"
                style={{
                  background: filled ? "var(--color-action)" : "transparent",
                  // `--line-2` est défini dans les DEUX thèmes. L'ancien
                  // `#D8CFC9` en dur disparaissait sur la page sombre.
                  border: filled ? "none" : "1.5px solid var(--line-2)",
                  transform: shake ? `translateX(${i % 2 ? 5 : -5}px)` : "none",
                  transitionDuration: shake ? "60ms" : "150ms",
                }}
              />
            );
          })}
        </div>

        <div className="mt-4 flex h-5 items-center">
          {checking && (
            <span className="animate-br-spin block h-[17px] w-[17px] rounded-full border-2 border-[var(--line-2)] border-t-action" />
          )}
          {!checking && error && (
            <span className="animate-br-in text-13 font-semibold text-error">
              {error}
            </span>
          )}
        </div>
      </div>

      <div
        className="grid w-full max-w-[280px] grid-cols-3 gap-x-5 gap-y-4 transition-opacity duration-200"
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
              // Contour, pas surface. Une tuile `--tile` (#1C1A19) sur une page
              // `--page` (#0F0E0D) donne 1,1:1 de contraste : les touches
              // étaient littéralement invisibles en mode sombre. Le cercle vide
              // se lit dans les deux thèmes, et le remplissage à l'appui rend le
              // retour visuel que la tuile assurait.
              // 72px : très au-dessus des 44px minimum d'iOS.
              className={
                "flex h-[72px] w-full cursor-pointer items-center justify-center rounded-full " +
                "transition-all duration-150 select-none disabled:cursor-default " +
                (isDel
                  ? "border-none bg-transparent text-ink-2"
                  : "border-[1.5px] border-[var(--line-2)] bg-transparent text-27 font-medium text-ink active:scale-95 active:bg-tile")
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
