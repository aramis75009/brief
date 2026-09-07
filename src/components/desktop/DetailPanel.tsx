"use client";

/**
 * La fiche tâche en PANNEAU LATÉRAL, plus en écran plein.
 *
 * En v1, ouvrir une tâche remplaçait toute la vue : on perdait la liste, sa
 * position de défilement et le contexte de ce qu'on était en train de faire.
 * En panneau, la liste reste à côté — c'est le geste du prototype, et celui
 * d'Asana.
 *
 * Le mode focus (plein écran centré) reste disponible pour une fiche longue :
 * il rend la largeur qu'un panneau de 452 px ne peut pas donner, sans
 * reprendre le défaut de la v1 puisqu'on y entre et on en sort d'un clic.
 *
 * Le contenu lui-même reste `DesktopTaskDetail`, inchangé : il est éprouvé, et
 * le réécrire pour le déplacer aurait mélangé deux risques.
 */

import { useEffect } from "react";
import { DesktopTaskDetail } from "./DesktopTaskDetail";
import { C } from "./tokens";
import type { DraftItem, Item, Objective, Project, Tag } from "@/lib/types";

const PANEL_W = 452;

export function DetailPanel({
  item,
  items,
  projects,
  focus,
  onToggleFocus,
  onClose,
  ...detail
}: {
  item: Item | null;
  items: Item[];
  projects: Project[];
  focus: boolean;
  onToggleFocus: () => void;
  onClose: () => void;
  onDone: (id: string, completedAt?: string | null) => void;
  onPostpone: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSub: (itemId: string, subId: string) => void;
  onAddSubtask: (itemId: string, title: string) => void;
  onOpenSibling: (id: string) => void;
  onSave: (id: string, patch: Partial<DraftItem>) => Promise<boolean>;
  allTags: Tag[];
  onAddTag: (itemId: string, tagId: string) => Promise<void>;
  onRemoveTag: (itemId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, color: string) => Promise<Tag | null>;
  onAddDependency: (targetId: string, depId: string) => Promise<void>;
  onRemoveDependency: (targetId: string, depId: string) => Promise<void>;
  objectives: Objective[];
  onSetObjective: (itemId: string, objectiveId: string | null) => Promise<void>;
}) {
  // Échap ferme, comme la palette et les feuilles. Sans ça, un panneau ouvert
  // en mode focus n'a qu'une seule sortie : viser la croix.
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (focus) onToggleFocus();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, focus, onClose, onToggleFocus]);

  if (!item) return null;

  return (
    <aside
      aria-label={`Fiche : ${item.title}`}
      className={focus ? "animate-pop" : "animate-slidein"}
      style={
        focus
          ? {
              position: "fixed",
              inset: 0,
              zIndex: 60,
              background: C.surface,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              padding: "0 max(0px, calc((100vw - 900px) / 2))",
            }
          : {
              width: PANEL_W,
              flex: `0 0 ${PANEL_W}px`,
              background: C.surface,
              borderLeft: `1px solid ${C.hairline2}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }
      }
    >
      <div
        className="flex flex-none items-center gap-2.25"
        style={{ padding: "13px 16px", borderBottom: `1px solid ${C.hairline2}` }}
      >
        <span className="truncate text-[12px] font-bold" style={{ color: C.inkMuted }}>
          Fiche
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFocus}
            aria-pressed={focus}
            title={focus ? "Quitter le plein écran" : "Mode focus plein écran"}
            style={{ border: "none", background: "none", color: C.inkMuted, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
          >
            {focus ? "⤡" : "⛶"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fiche"
            style={{ border: "none", background: "none", color: C.inkMuted, fontSize: 16, cursor: "pointer", fontFamily: "inherit" }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: "16px 18px 40px" }}>
        <DesktopTaskDetail
          item={item}
          items={items}
          projects={projects}
          onBack={onClose}
          compact={!focus}
          {...detail}
        />
      </div>
    </aside>
  );
}
