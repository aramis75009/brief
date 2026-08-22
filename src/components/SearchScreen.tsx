"use client";

import { useState, useMemo, useCallback } from "react";
import { EmptyState } from "./EmptyState";
import { SkeletonCard } from "./Skeleton";
import { VoiceBadge } from "./VoiceBadge";
import { AccountAvatar } from "./AccountAvatar";
import { SearchSmallIcon, MicIcon, ChevronLeftIcon } from "./icons";
import { skinFor, shapeFor } from "@/lib/projects";
import { compareByDue } from "@/lib/due";
import { useRecorder, type Recording } from "@/lib/useRecorder";
import { transcribeAudio } from "@/lib/api";
import type { Item, Project } from "@/lib/types";

/**
 * SearchScreen — recherche dans tâches, RDV, idées et transcriptions.
 */

type FilterKey = "all" | "task" | "event" | "idea" | "dictated";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "task", label: "Tâches" },
  { key: "event", label: "RDV" },
  { key: "idea", label: "Idées" },
  { key: "dictated", label: "Dicté" },
];

export function SearchScreen({
  items,
  projects,
  onOpenItem,
  onBack,
  onOpenAccount,
}: {
  items: Item[];
  projects: Project[];
  onOpenItem: (id: string) => void;
  onBack: () => void;
  onOpenAccount: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [voiceActive, setVoiceActive] = useState(false);

  const onRecorded = useCallback(async (rec: Recording) => {
    setVoiceActive(false);
    try {
      const text = await transcribeAudio(rec.blob, rec.mimeType, () => {});
      if (text.trim()) setQuery(text.trim());
    } catch {
      /* non bloquant */
    }
  }, []);

  const recorder = useRecorder(onRecorded);

  const toggleVoiceSearch = useCallback(() => {
    if (recorder.recording) {
      recorder.stop();
    } else {
      setVoiceActive(true);
      void recorder.start();
    }
  }, [recorder]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => {
        // Filter by type
        if (filter === "task" && item.kind !== "task") return false;
        if (filter === "event" && item.kind !== "event") return false;
        if (filter === "idea" && item.status !== "idea") return false;
        if (filter === "dictated" && !item.audioOrigin) return false;

        // Navigation libre (pas de recherche tapée) : les tâches déjà
        // terminées n'ont rien à faire dans une liste qu'on parcourt pour
        // voir ce qui reste à faire. Elles restent trouvables par leur nom —
        // la recherche par texte, elle, cherche aussi dans l'historique.
        if (!q) return !item.doneAt;

        // Search in title, notes, audioOrigin
        const title = item.title.toLowerCase();
        const notes = (item.notes || "").toLowerCase();
        const audio = item.audioOrigin;
        const audioText = audio ? (audio.text + " " + audio.highlight).toLowerCase() : "";
        return title.includes(q) || notes.includes(q) || audioText.includes(q);
      })
      .sort(compareByDue);
  }, [items, query, filter]);

  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  return (
    <div className="flex-1 min-h-0 overflow-auto px-5 pb-2" style={{ animation: "fade .25s both" }}>
      {/* Header */}
      <div className="safe-top flex items-center justify-between" style={{ paddingBottom: 18 }}>
        <button
          aria-label="Retour"
          onClick={onBack}
          className="flex size-11 items-center justify-center rounded-full border border-ink/[.08] bg-surface"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <span className="text-[22px] font-extrabold tracking-[-0.03em]">Rechercher</span>
        <AccountAvatar initials="AM" size={46} onClick={onOpenAccount} />
      </div>

      {/* Search bar */}
      <div className="mb-4 flex h-[52px] items-center gap-2.5 rounded-full border border-ink/[.08] bg-surface pl-4 pr-1.5">
        <SearchSmallIcon size={17} className="text-ink-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher une tâche, un RDV, une idée…"
          className="min-w-0 flex-1 border-none bg-transparent text-[14.5px] font-semibold text-ink outline-none"
        />
        <button
          aria-label="Dicter la recherche"
          onClick={toggleVoiceSearch}
          className="flex size-10 flex-none items-center justify-center rounded-full bg-ink"
        >
          <MicIcon size={15} className="text-white" />
        </button>
      </div>

      {/* Filters */}
      <div className="mb-5 flex gap-[7px] overflow-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-none rounded-full px-3.5 text-[12.5px] font-bold h-9 ${
              filter === f.key
                ? "bg-ink text-white"
                : "border border-ink/[.1] bg-surface text-ink"
            }`}
          >
            {f.key === "dictated" && (
              <span className="mr-1.5 inline-flex items-end gap-[1.5px]" style={{ height: 11 }}>
                <span className="w-[2px] rounded-full bg-current" style={{ height: 5 }} />
                <span className="w-[2px] rounded-full bg-current" style={{ height: 10 }} />
                <span className="w-[2px] rounded-full bg-current" style={{ height: 7 }} />
              </span>
            )}
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <EmptyState
          icon={<SearchSmallIcon size={20} className="text-ink-faint" />}
          title={query.trim() ? "Rien trouvé" : "Aucun item"}
          description={query.trim() ? "Essaie un mot de la dictée d'origine : Brief cherche aussi dans les transcriptions." : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {query.trim() && (
            <span className="mb-1.5 font-mono text-[10px] tracking-[0.1em] text-ink-faint">
              {results.length} RÉSULTAT{results.length > 1 ? "S" : ""}{query.trim() ? ` · « ${query.toUpperCase()} »` : ""}
            </span>
          )}
          {results.map((item) => {
            const proj = projectMap.get(item.projectId);
            const isTask = item.kind === "task";
            const isIdea = item.status === "idea";
            const bgColor = isTask ? "var(--color-task-100)" : isIdea ? "var(--color-idea-100)" : "var(--color-meet-100)";
            const iconColor = isTask ? "var(--color-task-700)" : isIdea ? "var(--color-idea-700)" : "var(--color-meet-700)";
            const skin = proj ? skinFor(proj) : null;
            const shape = proj ? shapeFor(proj) : "disc";

            return (
              <button
                key={item.id}
                onClick={() => onOpenItem(item.id)}
                className="flex items-center gap-3.5 rounded-20 border border-ink/[.06] bg-surface px-5 py-4.5 text-left"
              >
                <span
                  className="flex size-9 flex-none items-center justify-center rounded-full"
                  style={{ background: bgColor }}
                >
                  {isTask ? (
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2.6} strokeLinecap="round">
                      <path d="M4 12.5l5 5L20 6.5" />
                    </svg>
                  ) : isIdea ? (
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2.4} strokeLinecap="round">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
                    </svg>
                  ) : (
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2.2} strokeLinecap="round">
                      <rect x="3.5" y="5" width="17" height="15" rx="4" />
                      <path d="M8 3v4M16 3v4" />
                    </svg>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
                  <span
                    className="truncate text-[16px] font-bold tracking-[-0.01em]"
                    style={item.doneAt ? { textDecoration: "line-through", color: "var(--color-ink-faint)" } : undefined}
                  >
                    {highlightQuery(item.title, query)}
                  </span>
                  <span className="flex items-center gap-[7px] text-[13px] font-semibold text-ink-faint">
                    {skin && (
                      <span
                        className="flex-none"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: shape === "square" ? 2 : shape === "diamond" ? 2 : 99,
                          background: skin.bg,
                          transform: shape === "diamond" ? "rotate(45deg)" : "none",
                        }}
                      />
                    )}
                    {item.doneAt && "Terminé · "}
                    {item.audioOrigin && <VoiceBadge size="small" />}
                    {item.audioOrigin ? "Dictée" : proj?.name || "Sans projet"}
                    {item.due && ` · ${formatDateShort(item.due)}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function highlightQuery(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const q = trimmed.toLowerCase();
  const parts = text.split(new RegExp(`(${escapeRegex(trimmed)})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === q ? (
      <span key={i} className="rounded bg-idea-100 px-[3px]">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}