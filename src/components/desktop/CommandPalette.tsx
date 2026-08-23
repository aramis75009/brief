"use client";

/**
 * Palette de commandes ⌘K — recherche dans les items + quelques actions.
 * Le raccourci global (⌘K pour ouvrir, Esc pour fermer) est géré par
 * `DesktopShell`, un seul listener pour tout l'écran.
 */

import { useMemo, useRef, useEffect } from "react";
import { SearchIcon } from "../icons";
import { skinFor } from "@/lib/projects";
import type { Item, Project } from "@/lib/types";

const C = {
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  bg: "var(--color-bg)",
} as const;

type Result = { id: string; title: string; meta: string; iconLabel: string; iconBg: string; iconFg: string; hint: string; onClick: () => void };

export function CommandPalette({
  open,
  query,
  onQueryChange,
  onClose,
  items,
  projects,
  onOpenItem,
  onDictate,
  onGoCalendar,
  onGoIdeas,
  onLighten,
}: {
  open: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  items: Item[];
  projects: Project[];
  onOpenItem: (id: string) => void;
  onDictate: () => void;
  onGoCalendar: () => void;
  onGoIdeas: () => void;
  onLighten: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const results: Result[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [
        { id: "cmd-dictate", title: "Dicter une note", meta: "Capture vocale", iconLabel: "▮", iconBg: C.ink, iconFg: "#fff", hint: "ACTION", onClick: () => { onClose(); onDictate(); } },
        { id: "cmd-cal", title: "Ouvrir le calendrier", meta: "Semaine en cours", iconLabel: "◧", iconBg: "var(--color-meet-100)", iconFg: "var(--color-meet-700)", hint: "ÉCRAN", onClick: () => { onClose(); onGoCalendar(); } },
        { id: "cmd-ideas", title: "Trier la boîte à idées", meta: "", iconLabel: "◇", iconBg: "var(--color-idea-100)", iconFg: "var(--color-idea-700)", hint: "ÉCRAN", onClick: () => { onClose(); onGoIdeas(); } },
        { id: "cmd-lighten", title: "Alléger mon mur", meta: "Repousser la moins urgente", iconLabel: "↓", iconBg: "var(--color-task-100)", iconFg: "var(--color-task-700)", hint: "ACTION", onClick: () => { onClose(); onLighten(); } },
      ];
    }
    const hits = items
      .filter((it) => it.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map((it) => {
        const project = projectMap.get(it.projectId);
        const skin = project ? skinFor(project) : { bg: C.bg, fg: C.inkMuted };
        const status = it.status === "idea" ? "idée" : it.kind === "event" ? "RDV" : "tâche";
        return {
          id: it.id,
          title: it.title,
          meta: `${project?.name ?? "—"} · ${status}`,
          iconLabel: (project?.name ?? "?").slice(0, 1),
          iconBg: skin.bg,
          iconFg: skin.fg,
          hint: "OUVRIR",
          onClick: () => { onClose(); onOpenItem(it.id); },
        };
      });
    if (hits.length) return hits;
    return [{ id: "none", title: "Aucun résultat", meta: "Essaie un autre mot-clé", iconLabel: "?", iconBg: C.bg, iconFg: C.inkMuted, hint: "", onClick: () => {} }];
  }, [query, items, projectMap, onClose, onDictate, onGoCalendar, onGoIdeas, onLighten, onOpenItem]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-70 flex items-start justify-center"
      style={{ padding: "100px 40px 40px", background: "rgba(16,16,16,.4)", backdropFilter: "blur(3px)", animation: "fade .3s both" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
    >
      <div
        className="flex w-full flex-col overflow-hidden"
        style={{ maxWidth: 640, background: C.surface, borderRadius: 24, boxShadow: "0 12px 30px rgba(16,16,16,.26)", animation: "sheet .3s cubic-bezier(.2,.9,.3,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3" style={{ padding: "18px 20px", borderBottom: "1px solid rgba(16,16,16,.06)" }}>
          <SearchIcon size={18} className="text-ink-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Chercher un item, un projet, une commande…"
            className="min-w-0 flex-1 border-none bg-transparent outline-none"
            style={{ fontFamily: "inherit", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: C.ink }}
          />
          <button
            onClick={onClose}
            className="font-mono"
            style={{ padding: "5px 9px", background: C.bg, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 10, color: C.inkMuted }}
          >
            ESC
          </button>
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto", padding: 8 }}>
          {results.map((r) => (
            <button
              key={r.id}
              onClick={r.onClick}
              className="flex w-full items-center gap-3 text-left"
              style={{ padding: "12px 14px", background: "none", border: "none", borderRadius: 18, cursor: "pointer", fontFamily: "inherit" }}
            >
              <span className="flex flex-none items-center justify-center font-extrabold" style={{ width: 30, height: 30, borderRadius: 10, background: r.iconBg, color: r.iconFg, fontSize: 11 }}>
                {r.iconLabel}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[14px] font-semibold tracking-[-0.01em]">{r.title}</span>
                {r.meta && <span className="text-[11px] font-semibold" style={{ color: C.inkMuted }}>{r.meta}</span>}
              </span>
              <span className="font-mono" style={{ fontSize: 9, letterSpacing: "0.06em", color: C.inkFaint }}>{r.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
