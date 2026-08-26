"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/**
 * Page de réinitialisation du mot de passe — destination du lien reçu par
 * email (« Mot de passe oublié »). Le proxy a déjà échangé le code de
 * récupération contre une session (et nettoyé l'URL) ; cette page vérifie
 * la session via GET /api/auth/session puis pose le nouveau mot de passe
 * via POST /api/auth/reset-password.
 *
 * Sans session valide (lien expiré, ou page ouverte directement), la page
 * invite à relancer « Mot de passe oublié ».
 */
function ResetPasswordForm() {
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Vérifie la session de récupération au montage (le code a déjà été
  // échangé par le proxy, l'URL est propre).
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (alive) setSessionOk(res.ok);
      } catch {
        if (alive) setSessionOk(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (password.length < 8) {
        setError("Le mot de passe doit contenir au moins 8 caractères.");
        return;
      }
      if (password !== confirm) {
        setError("Les deux mots de passe ne correspondent pas.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (res.ok) {
          setDone(true);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          data.error ||
            "Impossible de réinitialiser le mot de passe. Le lien a peut-être expiré.",
        );
      } catch {
        setError("Serveur injoignable. Réessaie.");
      } finally {
        setBusy(false);
      }
    },
    [password, confirm],
  );

  if (done) {
    return (
      <div className="w-full max-w-[380px] text-center">
        <p className="mb-2.5 font-mono text-10 uppercase tracking-[.09em] text-ink-muted">
          Mot de passe
        </p>
        <h1 className="mb-2 text-20 font-extrabold tracking-tight">C&apos;est enregistré</h1>
        <p className="mb-6 text-13 font-medium leading-relaxed text-ink-muted">
          Ton mot de passe est à jour. Tu peux te connecter avec
          ton email et ce nouveau mot de passe.
        </p>
        <Link
          href="/"
          className="inline-flex h-13 w-full items-center justify-center rounded-full text-15 font-bold text-white"
          style={{ background: "var(--color-ink)" }}
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-[380px]">
      <p className="mb-2.5 font-mono text-10 uppercase tracking-[.09em] text-ink-muted">
        Mot de passe oublié
      </p>
      <h1 className="mb-2 text-20 font-extrabold tracking-tight">Choisis un nouveau mot de passe</h1>
      <p className="mb-6 text-13 font-medium leading-relaxed text-ink-muted">
        {sessionOk === false
          ? "Ce lien est invalide ou a expiré. Relance « Mot de passe oublié » depuis l'écran de connexion pour en recevoir un nouveau."
          : "8 caractères minimum. Tu pourras te connecter avec ton email et ce mot de passe."}
      </p>

      {sessionOk !== false && (
        <>
          <label htmlFor="reset-password" className="mb-2 block text-13 font-semibold">
            Nouveau mot de passe
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-13 w-full rounded-full border border-ink/[.08] bg-surface px-5 text-15 font-semibold text-ink"
          />

          <label htmlFor="reset-confirm" className="mt-4.5 mb-2 block text-13 font-semibold">
            Confirme le mot de passe
          </label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="h-13 w-full rounded-full border border-ink/[.08] bg-surface px-5 text-15 font-semibold text-ink"
          />

          <p className="mt-3.5 min-h-[18px] text-13 font-semibold text-danger" role="alert">
            {error}
          </p>

          <button
            type="submit"
            disabled={busy}
            className="mt-5 h-13 w-full rounded-full text-15 font-bold text-white disabled:opacity-60"
            style={{ background: "var(--color-ink)" }}
          >
            Enregistrer le mot de passe
          </button>
        </>
      )}

      <div className="mt-3.5 flex justify-end">
        <Link href="/" className="text-13 font-semibold text-ink-muted">
          ← Retour à la connexion
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div
        className="safe-top flex flex-col items-center gap-3.5 px-6 pb-6 text-center"
        style={{ background: "var(--color-ink)" }}
      >
        <p className="text-20 font-extrabold tracking-tight text-white">Brief</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-10 safe-bottom">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
