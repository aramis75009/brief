"use client";

import { useState, useRef, useEffect } from "react";
import { skinFor, shapeFor } from "@/lib/projects";
import { ChevronDownIcon } from "./icons";
import type { Project } from "@/lib/types";

/**
 * ProjectSelector — sélecteur de projet compact pour la capture.
 *
 * Affiche le projet actuellement sélectionné dans un bouton pill avec sa
 * pastille de couleur. Au tap, ouvre un menu déroulant (overlay) qui liste
 * tous les projets avec leur couleur et leur forme.
 *
 * Ne déborde jamais : le menu s'ouvre en overlay absolute, pas dans le flux.
 */
export function ProjectSelector({
  projects,
  selectedId,
  onSelect,
}: {
  projects: Project[];
  selectedId: string;
  onSelect: (projectId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = projects.find((p) => p.id === selectedId);
  const skin = selected ? skinFor(selected) : null;
  const shape = selected ? shapeFor(selected) : "disc";

  // Ferme le menu quand on clique dehors
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Bouton principal — montre le projet sélectionné */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-bg px-3.5 h-9 text-[13px] font-bold text-ink"
      >
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
        {selected?.name || "Sans projet"}
        <ChevronDownIcon size={14} className="text-ink-faint" />
      </button>

      {/* Menu déroulant — s'ouvre vers le HAUT pour ne pas être coupé */}
      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-1.5 min-w-[180px] rounded-20 border border-ink/[.08] bg-surface p-1.5 shadow-card"
          style={{ animation: "fade .15s both" }}
        >
          {projects.map((p) => {
            const pSkin = skinFor(p);
            const pShape = shapeFor(p);
            const isActive = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-12 px-3 h-10 text-[13px] font-bold text-left transition-colors ${
                  isActive ? "bg-bg text-ink" : "text-ink-muted"
                }`}
              >
                <span
                  className="flex-none"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: pShape === "square" ? 2 : pShape === "diamond" ? 2 : 99,
                    background: pSkin.bg,
                    transform: pShape === "diamond" ? "rotate(45deg)" : "none",
                  }}
                />
                {p.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}