"use client";

/**
 * La colonne de gauche — ce qui remplace la nav horizontale à sept onglets.
 *
 * Le changement n'est pas cosmétique : les projets ne tenaient nulle part
 * dans un bandeau horizontal, et c'est ce qui obligeait « Calendrier »,
 * « Kanban » et « Idées » à être des destinations plutôt que des VUES du même
 * contenu. La sidebar donne une place permanente aux projets, donc un endroit
 * où poser les onglets de vue au-dessus du contenu.
 */

import { useEffect, useRef, useState } from "react";
import { shapeFor, skinFor } from "@/lib/projects";
import { ProjectDot } from "@/components/icons";
import { AccountAvatar } from "../AccountAvatar";
import { C, R, SHADOW } from "./tokens";
import type { NavKey } from "./types";
import type { Project } from "@/lib/types";

const NAV: { key: NavKey; label: string; glyph: string }[] = [
  { key: "accueil", label: "Accueil", glyph: "⌂" },
  { key: "inbox", label: "Boîte de réception", glyph: "✉" },
  { key: "mytasks", label: "Mes tâches", glyph: "☑" },
  { key: "portfolios", label: "Portefeuilles", glyph: "◫" },
  { key: "graphe", label: "Graphe", glyph: "⌘" },
];

export type CreateKind = "task" | "project" | "portfolio" | "objective" | "dictee";

const CREATE: { kind: CreateKind; label: string; glyph: string; pastel: "task" | "meet" | "idea" | "neutral" }[] = [
  { kind: "task", label: "Tâche", glyph: "T", pastel: "task" },
  { kind: "project", label: "Projet", glyph: "P", pastel: "meet" },
  { kind: "portfolio", label: "Portefeuille", glyph: "◫", pastel: "idea" },
  { kind: "objective", label: "Objectif", glyph: "◎", pastel: "neutral" },
  { kind: "dictee", label: "Dictée", glyph: "●", pastel: "neutral" },
];

const PASTEL_STYLE: Record<string, { background: string; color: string }> = {
  task: { background: "var(--color-task-100)", color: "var(--color-task-700)" },
  meet: { background: "var(--color-meet-100)", color: "var(--color-meet-700)" },
  idea: { background: "var(--color-idea-100)", color: "var(--color-idea-700)" },
  neutral: { background: "var(--color-bg)", color: "var(--color-ink-muted)" },
};

export function Sidebar({
  nav,
  activeProjectId,
  projects,
  counts,
  inboxUnread,
  syncLabel,
  onNavigate,
  onOpenProject,
  onCreate,
  onOpenAccount,
}: {
  nav: NavKey;
  activeProjectId: string | null;
  projects: Project[];
  /** Nombre de tâches ouvertes par projet — le petit compteur de droite. */
  counts: Map<string, number>;
  inboxUnread: number;
  /** « il y a 4 min », ou `null` quand la synchro n'a jamais tourné. */
  syncLabel: string | null;
  onNavigate: (key: NavKey) => void;
  onOpenProject: (id: string) => void;
  onCreate: (kind: CreateKind) => void;
  onOpenAccount: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  // Un menu qui ne se ferme qu'en re-cliquant son bouton reste ouvert sous le
  // contenu qu'on essaie d'atteindre. Échap ET clic extérieur, comme partout.
  useEffect(() => {
    if (!createOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCreateOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!createRef.current?.contains(e.target as Node)) setCreateOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [createOpen]);

  const visibleProjects = projects.filter((p) => !p.archived);

  return (
    <aside
      className="flex flex-none flex-col gap-4"
      style={{
        width: 256,
        background: C.surface,
        borderRight: `1px solid ${C.hairline2}`,
        padding: "16px 12px 12px",
      }}
    >
      <div className="flex items-center gap-2.5" style={{ padding: "2px 6px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- icône PWA figée, pas une image de contenu */}
        <img src="/icon-192.png" alt="" width={30} height={30} style={{ borderRadius: 9, flexShrink: 0 }} />
        <span className="text-[17px] font-extrabold tracking-[-0.02em]">Brief</span>
      </div>

      {/* --- Créer --- */}
      <div className="relative" ref={createRef}>
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          aria-expanded={createOpen}
          aria-haspopup="menu"
          className="flex w-full items-center justify-center gap-2 font-bold"
          style={{
            height: 40,
            borderRadius: R.chip,
            background: C.ink,
            color: "#FFFFFF",
            border: "none",
            fontFamily: "inherit",
            fontSize: 14,
            cursor: "pointer",
            boxShadow: SHADOW.fab,
          }}
        >
          <span style={{ fontSize: 17, lineHeight: 1 }}>+</span>
          <span>Créer</span>
        </button>

        {createOpen && (
          <div
            role="menu"
            className="absolute z-40 animate-pop"
            style={{
              top: 46,
              left: 0,
              width: 232,
              background: C.surface,
              border: `1px solid ${C.hairline2}`,
              borderRadius: R.xl,
              boxShadow: "0 14px 40px rgba(16,16,16,.16)",
              padding: 7,
            }}
          >
            {CREATE.map((c) => (
              <button
                key={c.kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  setCreateOpen(false);
                  onCreate(c.kind);
                }}
                className="flex w-full items-center gap-2.75 text-left hover:bg-[var(--color-bg)]"
                style={{ padding: "9px 10px", borderRadius: R.md, border: "none", background: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                <span
                  className="flex items-center justify-center font-mono font-bold"
                  style={{ width: 24, height: 24, borderRadius: R.sm, fontSize: 12, ...PASTEL_STYLE[c.pastel] }}
                >
                  {c.glyph}
                </span>
                <span className="text-[14px] font-semibold">{c.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* --- Navigation --- */}
      <nav className="flex flex-col gap-0.5">
        {NAV.map((n) => {
          const on = nav === n.key;
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => onNavigate(n.key)}
              aria-current={on ? "page" : undefined}
              className="flex w-full items-center gap-2.75 text-left"
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: R.md,
                border: "none",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: on ? 700 : 600,
                background: on ? C.ink : "transparent",
                color: on ? "#FFFFFF" : C.ink,
                cursor: "pointer",
              }}
            >
              <span className="flex w-[18px] justify-center" aria-hidden="true">{n.glyph}</span>
              <span className="truncate">{n.label}</span>
              {n.key === "inbox" && inboxUnread > 0 && (
                <span
                  className="tnum ml-auto flex items-center justify-center font-bold"
                  style={{
                    minWidth: 20,
                    height: 19,
                    padding: "0 6px",
                    borderRadius: R.chip,
                    fontSize: 11,
                    background: on ? "rgba(255,255,255,.2)" : C.danger,
                    color: "#FFFFFF",
                  }}
                >
                  {inboxUnread}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* --- Projets --- */}
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        <div className="flex items-center justify-between" style={{ padding: "6px 12px 4px" }}>
          <span
            className="font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: "0.08em", color: C.inkFaint }}
          >
            Projets
          </span>
          <button
            type="button"
            aria-label="Nouveau projet"
            onClick={() => onCreate("project")}
            style={{ border: "none", background: "none", color: C.inkMuted, fontSize: 15, lineHeight: 1, cursor: "pointer" }}
          >
            +
          </button>
        </div>

        {visibleProjects.length === 0 && (
          <span className="text-[12px]" style={{ padding: "4px 12px", color: C.inkFaint }}>
            Aucun projet.
          </span>
        )}

        {visibleProjects.map((p) => {
          const on = nav === "project" && activeProjectId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpenProject(p.id)}
              aria-current={on ? "page" : undefined}
              className="flex w-full items-center gap-2.5 text-left hover:bg-[var(--color-bg)]"
              style={{
                height: 33,
                padding: "0 12px",
                borderRadius: 11,
                border: "none",
                fontFamily: "inherit",
                fontSize: 13.5,
                fontWeight: on ? 700 : 600,
                background: on ? "var(--color-bg)" : "transparent",
                color: C.ink,
                cursor: "pointer",
              }}
            >
              <span className="flex-none" style={{ color: skinFor(p).bg }}>
                <ProjectDot size={9} shape={shapeFor(p)} />
              </span>
              <span className="truncate">{p.name}</span>
              <span className="tnum ml-auto font-mono" style={{ fontSize: 10, color: C.inkFaint }}>
                {counts.get(p.id) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* --- Pied : synchro + compte --- */}
      <div className="flex flex-none flex-col gap-2.5">
        <div
          className="flex items-center gap-2"
          style={{ padding: "9px 11px", borderRadius: 14, background: C.bg }}
        >
          <span
            className="flex-none"
            style={{
              width: 7,
              height: 7,
              borderRadius: 99,
              // Gris quand la synchro n'a jamais tourné : un point vert
              // annoncerait « à jour » là où on ne sait rien.
              background: syncLabel ? "var(--color-p6)" : C.inkFaint,
            }}
          />
          <div className="min-w-0">
            <div className="text-[12px] font-bold">Apple Calendar</div>
            <div className="truncate text-[11px]" style={{ color: C.inkMuted }}>
              {syncLabel ? `Sync CalDAV · ${syncLabel}` : "Jamais synchronisé"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAccount}
          className="flex items-center gap-2.5 text-left"
          style={{ padding: "4px 6px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", borderRadius: R.md }}
        >
          <AccountAvatar initials="AM" size={28} bg="var(--color-ink)" color="#FFFFFF" />
          <span className="text-[13px] font-semibold">Mon compte</span>
          <span className="ml-auto" style={{ color: C.inkFaint }} aria-hidden="true">···</span>
        </button>
      </div>
    </aside>
  );
}
