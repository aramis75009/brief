"use client";

/**
 * L'en-tête de contenu : titre, onglets de vue, barre d'outils.
 *
 * Il est SÉPARÉ de la sidebar parce qu'il change à chaque navigation alors que
 * la sidebar ne change pas. Les fusionner obligerait à re-rendre la liste des
 * projets à chaque changement d'onglet.
 */

import { shapeFor, skinFor } from "@/lib/projects";
import { BellIcon, ProjectDot, MicIcon, SearchIcon } from "@/components/icons";
import { C, R } from "./tokens";
import { VIEWS_FOR, type NavKey, type ViewKey } from "./types";
import type { Project } from "@/lib/types";

export function ViewHeader({
  nav,
  view,
  project,
  subtitle,
  countLabel,
  onSelectView,
  onOpenPalette,
  onOpenNotifications,
  onCapture,
  onAddTask,
  toolbar,
}: {
  nav: NavKey;
  view: ViewKey;
  /** Le projet ouvert, quand `nav === "project"`. */
  project: Project | null;
  subtitle: string;
  /** « 14 tâches · 3 terminées » — à droite de la barre d'outils. */
  countLabel: string | null;
  onSelectView: (view: ViewKey) => void;
  onOpenPalette: () => void;
  onOpenNotifications: () => void;
  onCapture: () => void;
  /** `null` sur les vues où ajouter une tâche n'a pas de sens (Fichiers, Tableau de bord). */
  onAddTask: (() => void) | null;
  /** Contrôles propres à la vue courante (filtres, tri, navigation de semaine). */
  toolbar?: React.ReactNode;
}) {
  const titles: Record<string, string> = {
    accueil: "Accueil",
    inbox: "Boîte de réception",
    mytasks: "Mes tâches",
    portfolios: "Portefeuilles",
    graphe: "Graphe des dépendances",
    réglages: "Réglages",
  };
  const title = nav === "project" ? (project?.name ?? "Projet") : titles[nav];
  const views = nav === "mytasks" || nav === "project" ? VIEWS_FOR[nav] : null;

  return (
    <header
      className="flex-none"
      style={{ background: C.surface, borderBottom: `1px solid ${C.hairline2}`, padding: "14px 24px 0" }}
    >
      <div className="flex min-h-[38px] items-center gap-3.5">
        {nav === "project" && project && (
          <span className="flex-none" style={{ color: skinFor(project).bg }}>
            <ProjectDot size={12} shape={shapeFor(project)} />
          </span>
        )}
        <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{title}</h1>
        {subtitle && (
          <span className="truncate text-[13px]" style={{ color: C.inkMuted }}>
            {subtitle}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenPalette}
            className="flex items-center gap-2"
            style={{
              height: 34,
              minWidth: 200,
              padding: "0 13px",
              borderRadius: R.chip,
              background: C.bg,
              border: "none",
              color: C.inkMuted,
              fontFamily: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <SearchIcon size={15} className="text-ink-muted" />
            <span>Rechercher</span>
            <span className="ml-auto font-mono" style={{ fontSize: 10, color: C.inkFaint }}>
              ⌘K
            </span>
          </button>

          <button
            type="button"
            aria-label="Notifications et rappels"
            onClick={onOpenNotifications}
            className="flex items-center justify-center"
            style={{
              width: 34,
              height: 34,
              borderRadius: R.chip,
              border: `1px solid ${C.hairline2}`,
              background: C.surface,
              cursor: "pointer",
            }}
          >
            <BellIcon size={16} className="text-ink" />
          </button>

          <button
            type="button"
            onClick={onCapture}
            className="flex items-center gap-2 font-bold"
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: R.chip,
              background: C.ink,
              color: "#FFFFFF",
              border: "none",
              fontFamily: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <MicIcon size={14} className="text-white" />
            <span>Dicter</span>
          </button>
        </div>
      </div>

      {views && (
        <div className="flex items-center gap-0.5" style={{ marginTop: 10 }}>
          {views.map((v) => {
            const on = v.key === view;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => onSelectView(v.key)}
                aria-current={on ? "page" : undefined}
                style={{
                  height: 34,
                  padding: "0 14px",
                  border: "none",
                  background: "none",
                  borderBottom: `2px solid ${on ? C.ink : "transparent"}`,
                  fontFamily: "inherit",
                  fontSize: 13.5,
                  fontWeight: on ? 800 : 600,
                  color: on ? C.ink : C.inkMuted,
                  cursor: "pointer",
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      {(onAddTask || toolbar || countLabel) && (
        <div
          className="flex items-center gap-2"
          style={{ padding: "10px 0", borderTop: views ? `1px solid ${C.hairline}` : "none", marginTop: views ? 0 : 10 }}
        >
          {onAddTask && (
            <button
              type="button"
              onClick={onAddTask}
              className="flex items-center gap-1.75 font-bold"
              style={{
                height: 32,
                padding: "0 13px",
                borderRadius: R.chip,
                border: `1px solid ${C.hairline2}`,
                background: "none",
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
              <span>Ajouter une tâche</span>
            </button>
          )}
          {toolbar}
          {countLabel && (
            <span className="ml-auto text-[12px]" style={{ color: C.inkMuted }}>
              {countLabel}
            </span>
          )}
        </div>
      )}
    </header>
  );
}
