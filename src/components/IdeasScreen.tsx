"use client";

import { EmptyState } from "./EmptyState";
import { SkeletonCard } from "./Skeleton";
import { VoiceBadge } from "./VoiceBadge";
import { CheckIcon, ChevronLeftIcon, CloseIcon } from "./icons";
import type { IdeaIcon as IdeaIconType } from "./icons";
import { IdeaIcon } from "./icons";
import type { Item, Project } from "@/lib/types";

/**
 * IdeasScreen — boîte à idées.
 * Cartes idée avec marqueur vocal, bouton "Convertir en tâche", archiver.
 */

export function IdeasScreen({
  ideas,
  projects,
  onConvert,
  onArchive,
  onBack,
  onCapture,
  loading,
}: {
  ideas: Item[];
  projects: Project[];
  onConvert: (id: string) => void;
  onArchive: (id: string) => void;
  onBack: () => void;
  onCapture: () => void;
  loading: boolean;
}) {
  const ideaCount = ideas.length;

  return (
    <div className="flex-1 min-h-0 overflow-auto px-5 pb-2" style={{ animation: "fade .25s both" }}>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <button
          aria-label="Retour"
          onClick={onBack}
          className="flex size-11 items-center justify-center rounded-full border border-ink/[.08] bg-surface"
        >
          <ChevronLeftIcon size={18} />
        </button>
        {ideaCount > 0 && (
          <span className="rounded-full bg-idea-100 px-3.5 py-2 text-[12px] font-bold text-idea-700">
            {ideaCount} à trier
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="mb-1 text-[30px] font-extrabold tracking-[-0.035em]">Idées</h2>
      <p className="mb-5 text-[13.5px] font-medium leading-[1.45] text-ink-muted">
        Tout ce que tu as capturé sans le ranger. Convertis en tâche d'un geste.
      </p>

      {/* States */}
      {loading ? (
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : ideas.length === 0 ? (
        <EmptyState
          icon={<IdeaIcon size={20} className="text-ink-faint" />}
          title="Boîte à idées vide"
          description="Une pensée en passant ? Appuie sur le micro, on la range plus tard."
          actionLabel="Dicter une idée"
          onAction={onCapture}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {ideas.map((idea, i) => {
            const isOld = i >= 2;
            return (
              <div
                key={idea.id}
                className="rounded-20 border border-ink/[.06] bg-surface p-4"
                style={{ opacity: isOld ? 0.55 : 1 }}
              >
                {/* Meta */}
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="size-[7px] rounded-full bg-idea-700" />
                  <span className="text-[11.5px] font-bold text-ink-faint">
                    {idea.audioOrigin ? `Vocal ${idea.audioOrigin.durationSec} s` : "Texte"}
                    {" · "}
                    {idea.createdAt
                      ? relativeTime(idea.createdAt)
                      : "récemment"}
                  </span>
                </div>

                {/* Text */}
                <p className="mb-3.5 text-[15px] font-semibold leading-[1.42] tracking-[-0.01em]">
                  {idea.title}
                </p>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onConvert(idea.id)}
                    className="flex h-11 items-center gap-[7px] rounded-full bg-ink px-4 text-[13px] font-bold text-white"
                  >
                    <CheckIcon size={14} />
                    Convertir en tâche
                  </button>
                  <button
                    aria-label="Archiver"
                    onClick={() => onArchive(idea.id)}
                    className="flex size-11 items-center justify-center rounded-full border border-ink/[.1] bg-surface"
                  >
                    <CloseIcon size={15} className="text-ink-muted" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000);
  if (diffH < 1) return "à l'instant";
  if (diffH < 24) return `il y a ${diffH} h`;
  if (diffH < 48) return "hier";
  const days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  return days[d.getDay()] || "récemment";
}