"use client";

import { skinFor } from "@/lib/todoist";
import type { Project } from "@/lib/types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-1 mt-0 mb-[9px] text-[10.5px] font-semibold tracking-[1.1px] text-muted-2 uppercase">
      {children}
    </p>
  );
}

export function SettingsScreen({
  projects,
  projectsSource,
  reloading,
  onReloadProjects,
  onClearSession,
  onLock,
}: {
  projects: Project[];
  projectsSource: "todoist" | "fallback" | "cache" | null;
  reloading: boolean;
  onReloadProjects: () => void;
  onClearSession: () => void;
  onLock: () => void;
}) {
  const live = projectsSource === "todoist" || projectsSource === "cache";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-[26px] pt-2.5 pb-2">
        <h1 className="m-0 text-[27px] font-semibold tracking-[-0.5px] text-ink">Réglages</h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-[22px] pt-2.5 pb-5">
        <div>
          <SectionLabel>Intégration</SectionLabel>
          <div className="overflow-hidden rounded-[20px] border border-[rgba(28,26,24,0.07)] bg-card">
            <div className="flex min-h-14 items-center gap-3 px-4 py-[15px]">
              <div className="flex-1">
                <p className="m-0 text-[15px] font-semibold text-ink">Todoist</p>
                <p className="mt-0.5 mb-0 text-xs font-normal text-muted">
                  {live
                    ? `Connecté · ${projects.length} projet${projects.length > 1 ? "s" : ""}`
                    : "Liste de repli — projets en dur"}
                </p>
              </div>
              <span
                className="flex-none rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: live ? "#E6EAE4" : "#F4EBDD",
                  color: live ? "#3F5145" : "#8A6A2E",
                }}
              >
                {live ? "en ligne" : "repli"}
              </span>
            </div>

            <div className="mx-4 h-px bg-[rgba(28,26,24,0.06)]" />

            <button
              type="button"
              onClick={onReloadProjects}
              disabled={reloading}
              className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-none bg-transparent px-4 py-[15px] text-left transition-colors duration-200 hover:bg-stone-2 disabled:opacity-60"
            >
              <div className="flex-1">
                <p className="m-0 text-[15px] font-semibold text-ink">Recharger les projets</p>
                <p className="mt-0.5 mb-0 text-xs font-normal text-muted">
                  Le cache serveur dure 1 h
                </p>
              </div>
              {reloading && (
                <span className="animate-br-spin block h-4 w-4 flex-none rounded-full border-2 border-[rgba(28,26,24,0.15)] border-t-accent" />
              )}
            </button>
          </div>
        </div>

        <div>
          <SectionLabel>Projets</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => {
              const skin = skinFor(p);
              return (
                <span
                  key={p.id}
                  className="inline-flex h-8 items-center rounded-[11px] px-3 text-[12.5px] font-semibold"
                  style={{ background: skin.bg, color: skin.fg }}
                >
                  {p.name}
                </span>
              );
            })}
          </div>
          <p className="mx-1 mt-2.5 mb-0 text-[11px] leading-[1.5] text-faint">
            Brief n&apos;en crée aucun : le plan gratuit Todoist est limité à 5 projets.
          </p>
        </div>

        <div>
          <SectionLabel>Session</SectionLabel>
          <div className="overflow-hidden rounded-[20px] border border-[rgba(28,26,24,0.07)] bg-card">
            <button
              type="button"
              onClick={onClearSession}
              className="min-h-14 w-full cursor-pointer border-none bg-transparent px-4 py-[15px] text-left transition-colors duration-200 hover:bg-stone-2"
            >
              <p className="m-0 text-[15px] font-semibold text-accent">Vider la session</p>
              <p className="mt-0.5 mb-0 text-xs font-normal text-muted">
                Efface transcription et historique local
              </p>
            </button>

            <div className="mx-4 h-px bg-[rgba(28,26,24,0.06)]" />

            <button
              type="button"
              onClick={onLock}
              className="min-h-14 w-full cursor-pointer border-none bg-transparent px-4 py-[15px] text-left transition-colors duration-200 hover:bg-stone-2"
            >
              <p className="m-0 text-[15px] font-semibold text-ink">Verrouiller</p>
              <p className="mt-0.5 mb-0 text-xs font-normal text-muted">Redemande le code</p>
            </button>
          </div>
        </div>

        <p className="mx-1 my-0 text-[11px] text-faint">
          Brief · transcription Groq Whisper · structuration LLM · envoi Todoist
        </p>
      </div>
    </div>
  );
}
