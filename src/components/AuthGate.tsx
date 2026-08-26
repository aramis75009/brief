"use client";

import { useCallback, useState } from "react";

type Step = "login" | "forgot" | "success";

function Mark() {
  const bars = [
    { fill: "var(--color-task-100, #CFE0FF)", w: 100 },
    { fill: "var(--color-meet-100, #CBE9D6)", w: 76 },
    { fill: "var(--color-idea-100, #FBE2AE)", w: 52 },
  ];
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {bars.map((bar, i) => (
        <span
          key={i}
          className="block h-[19px] rounded-full"
          style={{
            width: `${bar.w}px`,
            background: bar.fill,
            transformOrigin: "left center",
            animation: "pop .45s cubic-bezier(.2,.9,.3,1) both",
            animationDelay: `${0.05 + i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

export function AuthGate({
  onUnlocked,
  desktop = false,
}: {
  onUnlocked: () => void;
  desktop?: boolean;
}) {
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!email.trim() || !password) {
      setError("Renseigne ton email et ton mot de passe.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res.ok) {
        setStep("success");
        onUnlocked();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Email ou mot de passe incorrect.");
    } catch {
      setError("Serveur injoignable. Réessaie.");
    } finally {
      setBusy(false);
    }
  }, [email, password, onUnlocked]);

  const requestReset = useCallback(async () => {
    if (!email.trim()) {
      setError("Entre ton email d'abord.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setForgotMessage(data.message ?? "Si ce compte existe, un lien de réinitialisation vient d'être envoyé.");
      setStep("forgot");
    } finally {
      setBusy(false);
    }
  }, [email]);

  return (
    <div className={desktop ? "flex min-h-dvh" : "flex min-h-0 flex-1 flex-col"}>
      <div
        className={
          desktop
            ? "flex w-[42%] max-w-[560px] flex-col items-center justify-center gap-6 border-r border-white/[.06] px-8 text-center"
            : "flex flex-col items-center gap-3.5 px-6 pt-10 pb-6 text-center"
        }
        style={{ background: "var(--color-ink)" }}
      >
        <Mark />
        <p className="text-20 font-extrabold tracking-tight text-white">Brief</p>
        {desktop && (
          <p className="max-w-[220px] text-13 font-medium leading-relaxed" style={{ color: "rgba(255,255,255,.6)" }}>
            Une tâche, un rendez-vous, une idée — jamais perdus.
          </p>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10 safe-bottom">
        <div className="w-full max-w-[380px]">
          {step !== "forgot" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <p className="mb-2.5 font-mono text-10 uppercase tracking-[.09em] text-ink-muted">
                Connexion
              </p>
              <h1 className="mb-2 text-20 font-extrabold tracking-tight">Connecte-toi</h1>
              <p className="mb-6 text-13 font-medium text-ink-muted">
                Accès réservé aux comptes autorisés.
              </p>

              <label htmlFor="auth-email" className="mb-2 block text-13 font-semibold">
                Adresse email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                className="h-13 w-full rounded-full border border-ink/[.08] bg-surface px-5 text-15 font-semibold text-ink outline-none focus:outline-2 focus:outline-ink"
              />

              <label htmlFor="auth-password" className="mt-4.5 mb-2 block text-13 font-semibold">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-13 w-full rounded-full border border-ink/[.08] bg-surface px-5 pr-13 text-15 font-semibold text-ink outline-none focus:outline-2 focus:outline-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>

              <p className="mt-3.5 min-h-[18px] text-13 font-semibold text-danger" role="alert">
                {error}
              </p>

              <button
                type="submit"
                disabled={busy}
                className="mt-5 h-13 w-full rounded-full text-15 font-bold text-white disabled:opacity-60"
                style={{ background: "var(--color-ink)" }}
              >
                Se connecter
              </button>

              <div className="mt-3.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => void requestReset()}
                  className="text-13 font-semibold text-ink-muted"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
          ) : (
            <div>
              <p className="mb-2.5 font-mono text-10 uppercase tracking-[.09em] text-ink-muted">
                Mot de passe oublié
              </p>
              <h1 className="mb-2 text-20 font-extrabold tracking-tight">Réinitialise ton mot de passe</h1>
              <p className="mb-6 text-13 font-medium leading-relaxed text-ink-muted">{forgotMessage}</p>
              <button
                type="button"
                onClick={() => setStep("login")}
                className="text-13 font-semibold text-ink underline"
              >
                ← Retour à la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
