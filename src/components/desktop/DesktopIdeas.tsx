"use client";

/**
 * Écran Idées desktop — grille de cartes, une par idée. « Planifier demain »
 * fixe une échéance (demain 09:00, priorité 2) ; « Reranger » fait tourner le
 * projet destinataire ; l'abandon archive (même sémantique que mobile).
 */

import { skinFor, shapeFor } from "@/lib/projects";
import { CloseIcon } from "../icons";
import type { Item, Project } from "@/lib/types";

const C = {
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  idea100: "var(--color-idea-100)",
  idea700: "var(--color-idea-700)",
} as const;

function relativeAgo(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "aujourd’hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

export function DesktopIdeas({
  ideas,
  projects,
  onPromote,
  onReroute,
  onArchive,
}: {
  ideas: Item[];
  projects: Project[];
  onPromote: (id: string) => void;
  onReroute: (id: string, nextProjectId: string) => void;
  onArchive: (id: string) => void;
}) {
  const now = new Date();
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  return (
    <div className="flex h-full flex-col gap-3" style={{ animation: "fade .3s both" }}>
      <div className="flex flex-none items-end justify-between gap-6" style={{ padding: "18px 22px", background: C.idea100, borderRadius: 24 }}>
        <div>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: C.idea700 }}>Rien ne se perd</div>
          <h1 className="font-extrabold tracking-[-0.03em]" style={{ margin: "6px 0 0", fontSize: 26, lineHeight: 1.08 }}>Boîte à idées</h1>
          <p style={{ margin: "6px 0 0", maxWidth: 520, fontSize: 12, fontWeight: 500, lineHeight: 1.4, color: C.idea700 }}>
            Une idée dictée n’a ni date ni urgence. Elle attend ici jusqu’à ce que tu la transformes en tâche, ou que tu l’abandonnes — sans culpabilité.
          </p>
        </div>
        <div className="flex flex-col">
          <span className="tnum font-extrabold tracking-[-0.03em]" style={{ fontSize: 28, lineHeight: 1 }}>{ideas.length}</span>
          <span className="text-[12px] font-semibold" style={{ color: C.idea700 }}>en attente</span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto" style={{ gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "min-content" }}>
        {ideas.length === 0 && (
          <span className="text-[13px] font-medium" style={{ color: C.inkMuted }}>Aucune idée en attente.</span>
        )}
        {ideas.map((it) => {
          const project = projectMap.get(it.projectId);
          const skin = project ? skinFor(project) : null;
          const shape = project ? shapeFor(project) : "disc";
          const nextProjectId = (() => {
            const i = projects.findIndex((p) => p.id === it.projectId);
            return projects[(i + 1) % projects.length]?.id ?? it.projectId;
          })();
          return (
            <div key={it.id} className="flex flex-col gap-3.5" style={{ padding: 20, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)", animation: "pop .45s cubic-bezier(.2,.9,.3,1) both" }}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.75">
                  {skin && <span style={{ width: 8, height: 8, borderRadius: shape === "square" ? 2 : 99, background: skin.bg }} />}
                  <span className="font-mono" style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkMuted }}>{project?.name ?? "—"}</span>
                </span>
                <button
                  onClick={() => onArchive(it.id)}
                  aria-label="Abandonner"
                  style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)", border: "none", borderRadius: 99, cursor: "pointer" }}
                >
                  <CloseIcon size={12} className="text-ink-muted" />
                </button>
              </div>
              <span className="text-[15px] font-semibold tracking-[-0.01em]" style={{ lineHeight: 1.4 }}>{it.title}</span>
              <span className="text-[11px] font-medium" style={{ color: C.inkFaint }}>Dictée {relativeAgo(it.createdAt, now)}</span>
              <div className="mt-auto flex gap-2">
                <button
                  onClick={() => onPromote(it.id)}
                  className="flex-1"
                  style={{ padding: 11, background: C.ink, color: "#fff", border: "none", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}
                >
                  Planifier demain
                </button>
                <button
                  onClick={() => onReroute(it.id, nextProjectId)}
                  style={{ flex: "none", padding: "11px 13px", background: "var(--color-bg)", border: "none", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}
                >
                  Reranger
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
