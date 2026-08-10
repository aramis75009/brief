"use client";

import { useCallback, useEffect, useState } from "react";
import { ProjectDot } from "./icons";
import {
  disablePush,
  enablePush,
  readPushState,
  sendTestPush,
  type PushState,
} from "@/lib/push-client";
import { shapeFor, skinFor } from "@/lib/projects";
import type { Project } from "@/lib/types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-1 mt-0 mb-[9px] text-11 font-semibold tracking-[1.1px] text-ink-3 uppercase">
      {children}
    </p>
  );
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/**
 * Notifications — le chemin par lequel un rappel sonnera.
 *
 * iOS ne fournit aucune API de notification programmée à une PWA : ni
 * Notification Triggers, ni Background Sync. La notification vient donc du
 * serveur, à la seconde voulue. Cet écran sert à prouver que cette chaîne
 * fonctionne bout en bout avant qu'on construise l'ordonnanceur.
 */
function NotificationsSection() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "ko"; text: string } | null>(null);

  const refresh = useCallback(() => {
    void readPushState().then(setState);
  }, []);

  useEffect(refresh, [refresh]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ kind: "ok", text: ok });
      refresh();
    } catch (e) {
      setMessage({ kind: "ko", text: e instanceof Error ? e.message : "Échec." });
    } finally {
      setBusy(false);
    }
  };

  const on = state?.status === "on";

  const subtitle = (): string => {
    switch (state?.status) {
      case "on":
        return "Actives sur cet appareil";
      case "off":
        return "Inactives — aucun rappel ne sonnera";
      case "denied":
        return "Refusées — à réactiver dans les réglages du navigateur";
      case "needs-install":
        return "Ajoute Brief à l'écran d'accueil : iOS ne notifie pas depuis un onglet";
      case "unsupported":
        return state.reason;
      default:
        return "Vérification…";
    }
  };

  const canToggle = state?.status === "on" || state?.status === "off";

  return (
    <div>
      <SectionLabel>Notifications</SectionLabel>
      <div className="overflow-hidden rounded-row border border-[var(--line)] bg-tile">
        <div className="flex min-h-14 items-center gap-3 px-4 py-[15px]">
          <div className="flex-1">
            <p className="m-0 text-15 font-semibold text-ink">Rappels</p>
            <p className="mt-0.5 mb-0 text-11 leading-[1.4] font-normal text-ink-2">{subtitle()}</p>
          </div>
          <span
            className="flex-none rounded-chip px-2.5 py-1 text-11 font-semibold"
            style={{
              background: on ? "var(--color-p3)" : "var(--color-p4)",
              color: on ? "var(--color-p3-ink)" : "var(--color-p4-ink)",
            }}
          >
            {on ? "actives" : "inactives"}
          </span>
        </div>

        {canToggle && (
          <>
            <div className="mx-4 h-px bg-[var(--line)]" />
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  on ? disablePush : () => enablePush(VAPID_PUBLIC_KEY),
                  on ? "Notifications désactivées." : "Notifications activées.",
                )
              }
              className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-none bg-transparent px-4 py-[15px] text-left transition-colors duration-200 hover:bg-page disabled:opacity-60"
            >
              <p className="m-0 flex-1 text-15 font-semibold text-ink">
                {on ? "Désactiver sur cet appareil" : "Activer sur cet appareil"}
              </p>
              {busy && (
                <span className="animate-br-spin block h-4 w-4 flex-none rounded-full border-2 border-[var(--line-2)] border-t-action" />
              )}
            </button>
          </>
        )}

        {on && (
          <>
            <div className="mx-4 h-px bg-[var(--line)]" />
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const { sent, total } = await sendTestPush();
                  if (sent === 0) throw new Error("Aucune notification n'est partie.");
                  if (sent < total) throw new Error(`${sent} envoyée(s) sur ${total}.`);
                }, "Envoyée. Verrouille le téléphone et attends.")
              }
              className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-none bg-transparent px-4 py-[15px] text-left transition-colors duration-200 hover:bg-page disabled:opacity-60"
            >
              <div className="flex-1">
                <p className="m-0 text-15 font-semibold text-ink">Tester une notification</p>
                <p className="mt-0.5 mb-0 text-11 font-normal text-ink-2">
                  Envoi immédiat sur cet appareil
                </p>
              </div>
            </button>
          </>
        )}
      </div>

      {message && (
        <p
          className="mx-1 mt-2.5 mb-0 text-11 leading-[1.5]"
          style={{ color: message.kind === "ok" ? "var(--color-ok)" : "var(--color-error)" }}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

export function SettingsScreen({
  projects,
  reloading,
  onReloadProjects,
  onClearSession,
  onLock,
}: {
  projects: Project[];
  reloading: boolean;
  onReloadProjects: () => void;
  onClearSession: () => void;
  onLock: () => void;
}) {

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-[26px] pt-2.5 pb-2">
        <h1 className="m-0 text-27 font-semibold tracking-[-0.5px] text-ink">Réglages</h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-[22px] pt-2.5 pb-5">
        <div>
          <SectionLabel>Stockage</SectionLabel>
          <div className="overflow-hidden rounded-row border border-[var(--line)] bg-tile">
            <div className="flex min-h-14 items-center gap-3 px-4 py-[15px]">
              <div className="flex-1">
                <p className="m-0 text-15 font-semibold text-ink">Brief</p>
                <p className="mt-0.5 mb-0 text-11 font-normal text-ink-2">
                  {projects.length} projet{projects.length > 1 ? "s" : ""} · aucun plafond
                </p>
              </div>
              <span
                className="flex-none rounded-chip px-2.5 py-1 text-11 font-semibold"
                style={{ background: "var(--color-p3)", color: "var(--color-p3-ink)" }}
              >
                autonome
              </span>
            </div>

            <div className="mx-4 h-px bg-[var(--line)]" />

            <button
              type="button"
              onClick={onReloadProjects}
              disabled={reloading}
              className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-none bg-transparent px-4 py-[15px] text-left transition-colors duration-200 hover:bg-page disabled:opacity-60"
            >
              <div className="flex-1">
                <p className="m-0 text-15 font-semibold text-ink">Recharger les projets</p>
                <p className="mt-0.5 mb-0 text-11 font-normal text-ink-2">Relit le stockage serveur</p>
              </div>
              {reloading && (
                <span className="animate-br-spin block h-4 w-4 flex-none rounded-full border-2 border-[var(--line-2)] border-t-action" />
              )}
            </button>
          </div>
        </div>

        <NotificationsSection />

        <div>
          <SectionLabel>Projets</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => {
              const skin = skinFor(p);
              return (
                <span
                  key={p.id}
                  className="inline-flex h-8 items-center gap-2 rounded-chip px-3 text-13 font-semibold"
                  style={{ background: skin.bg, color: skin.fg }}
                >
                  <ProjectDot shape={shapeFor(p)} />
                  {p.name}
                </span>
              );
            })}
          </div>
          <p className="mx-1 mt-2.5 mb-0 text-11 leading-[1.5] text-ink-3">
            Les projets appartiennent à Brief. Aucun plafond de nombre.
          </p>
        </div>

        <div>
          <SectionLabel>Session</SectionLabel>
          <div className="overflow-hidden rounded-row border border-[var(--line)] bg-tile">
            <button
              type="button"
              onClick={onClearSession}
              className="min-h-14 w-full cursor-pointer border-none bg-transparent px-4 py-[15px] text-left transition-colors duration-200 hover:bg-page"
            >
              <p className="m-0 text-15 font-semibold text-action">Vider la session</p>
              <p className="mt-0.5 mb-0 text-11 font-normal text-ink-2">
                Efface transcription et historique local
              </p>
            </button>

            <div className="mx-4 h-px bg-[var(--line)]" />

            <button
              type="button"
              onClick={onLock}
              className="min-h-14 w-full cursor-pointer border-none bg-transparent px-4 py-[15px] text-left transition-colors duration-200 hover:bg-page"
            >
              <p className="m-0 text-15 font-semibold text-ink">Verrouiller</p>
              <p className="mt-0.5 mb-0 text-11 font-normal text-ink-2">Redemande le code</p>
            </button>
          </div>
        </div>

        <p className="mx-1 my-0 text-11 text-ink-3">
          Brief · transcription Groq Whisper · structuration LLM · rappels Web Push
        </p>
      </div>
    </div>
  );
}
