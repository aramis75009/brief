"use client";

/**
 * La Chronologie — barres de plage et flèches de dépendance.
 *
 * Elle n'existe QUE dans un projet : hors projet, elle empilerait les barres
 * de huit projets sans rapport sur une même grille.
 *
 * Le placement vient de `timelineRows` / `timelineDeps`, purs et testés. Ce
 * composant convertit des index de colonne en pixels, et rien d'autre.
 */

import { useMemo, useState } from "react";
import { skinFor } from "@/lib/projects";
import { effectiveStart, effectiveDue } from "@/lib/status";
import { dayGrid, timelineDeps, timelineRows } from "@/lib/views";
import { zonedParts, shiftDays, zonedTime } from "@/lib/zoned";
import { EmptyView } from "../ui";
import { C, R } from "../tokens";
import type { Item, Project } from "@/lib/types";

const DAY_W = 74;
const ROW_H = 46;
/** On démarre trois jours avant aujourd'hui : sinon une tâche en retard n'a pas de barre. */
const OFFSET = -3;
const SPAN_DAYS = 21;

export function TimelineView({
  items,
  projects,
  now,
  onOpenTask,
  onMoveRange,
}: {
  items: Item[];
  projects: Project[];
  now: Date;
  onOpenTask: (id: string) => void;
  /**
   * Décale une plage de `days` jours. Le parent écrit ; cette vue ne connaît
   * ni l'API ni l'optimisme d'affichage.
   */
  onMoveRange: (id: string, days: number) => void;
}) {
  const days = useMemo(() => dayGrid(now, OFFSET, SPAN_DAYS), [now]);
  const rows = useMemo(() => timelineRows(items, days, now), [items, days, now]);
  const deps = useMemo(() => timelineDeps(rows), [rows]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const [drag, setDrag] = useState<{ id: string; startX: number; applied: number } | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyView
        title="Rien à placer sur la chronologie"
        hint="Seules les tâches datées y figurent. Ajoute une échéance — et une date de début pour obtenir une barre plutôt qu'un point."
      />
    );
  }

  const gridW = days.length * DAY_W;

  /**
   * Le glissement se termine sur `mouseup` n'importe où dans la fenêtre, pas
   * seulement sur la barre : relâcher hors de la barre laisserait sinon le
   * curseur « collé » à la tâche.
   */
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const delta = Math.round((e.clientX - drag.startX) / DAY_W);
    if (delta !== drag.applied) setDrag({ ...drag, applied: delta });
  };

  const onMouseUp = () => {
    if (!drag) return;
    if (drag.applied !== 0) onMoveRange(drag.id, drag.applied);
    setDrag(null);
  };

  return (
    <div
      style={{ background: C.surface, border: `1px solid ${C.hairline2}`, borderRadius: R.card, overflow: "hidden" }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div className="flex">
        {/* --- Colonne des noms --- */}
        <div style={{ width: 266, flex: "0 0 266px", borderRight: `1px solid ${C.hairline2}` }}>
          <div
            className="flex items-center font-bold uppercase"
            style={{
              height: 40,
              padding: "0 18px",
              borderBottom: `1px solid ${C.hairline2}`,
              background: C.bg,
              fontSize: 11,
              letterSpacing: "0.06em",
              color: C.inkMuted,
            }}
          >
            Tâche
          </div>
          {rows.map((row) => (
            <button
              key={row.item.id}
              type="button"
              onClick={() => onOpenTask(row.item.id)}
              className="flex w-full items-center gap-2.5 text-left hover:bg-[var(--color-bg)]"
              style={{
                height: ROW_H,
                padding: "0 18px",
                border: "none",
                background: "none",
                borderBottom: `1px solid ${C.hairline}`,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <span
                className="flex-none"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 3,
                  background: skinFor(projectById.get(row.item.projectId) ?? { id: row.item.projectId }).bg,
                }}
              />
              <span className="truncate text-[13px] font-semibold">{row.item.title}</span>
            </button>
          ))}
        </div>

        {/* --- Grille --- */}
        <div className="flex-1 overflow-x-auto">
          <div style={{ minWidth: gridW }}>
            <div className="flex" style={{ height: 40, borderBottom: `1px solid ${C.hairline2}`, background: C.bg }}>
              {days.map((d) => (
                <div
                  key={d.key}
                  className="flex flex-col items-center justify-center gap-px"
                  style={{
                    width: DAY_W,
                    flex: `0 0 ${DAY_W}px`,
                    borderRight: `1px solid ${C.hairline}`,
                    background: d.weekend ? "var(--color-bg)" : "transparent",
                  }}
                >
                  <span className="text-[10px] font-semibold" style={{ color: C.inkFaint }}>
                    {d.dow}
                  </span>
                  <span
                    className="text-[12px] font-bold"
                    style={
                      d.isToday
                        ? {
                            width: 20,
                            height: 20,
                            borderRadius: 99,
                            background: C.ink,
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }
                        : undefined
                    }
                  >
                    {d.num}
                  </span>
                </div>
              ))}
            </div>

            <div className="relative">
              {rows.map((row) => {
                const dragging = drag?.id === row.item.id ? drag.applied : 0;
                const project = projectById.get(row.item.projectId);
                const skin = skinFor(project ?? { id: row.item.projectId });
                const left = (row.startIndex + dragging) * DAY_W + 6;
                const width = row.span * DAY_W - 12;
                return (
                  <div
                    key={row.item.id}
                    className="relative"
                    style={{ height: ROW_H, borderBottom: `1px solid ${C.hairline}` }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        // Un clic qui suit un glissement n'ouvre pas la fiche :
                        // sinon chaque déplacement ouvre le panneau par-dessus.
                        if (drag) return;
                        onOpenTask(row.item.id);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setDrag({ id: row.item.id, startX: e.clientX, applied: 0 });
                      }}
                      title={`${row.item.title} — glisser pour décaler`}
                      className="absolute flex items-center font-bold"
                      style={{
                        top: 9,
                        height: 28,
                        left,
                        width,
                        // Les bords coupés sont carrés : un bord arrondi
                        // dirait « la plage s'arrête ici », alors qu'elle
                        // continue hors de la fenêtre.
                        borderTopLeftRadius: row.clippedStart ? 4 : 999,
                        borderBottomLeftRadius: row.clippedStart ? 4 : 999,
                        borderTopRightRadius: row.clippedEnd ? 4 : 999,
                        borderBottomRightRadius: row.clippedEnd ? 4 : 999,
                        padding: "0 13px",
                        border: "none",
                        background: skin.bg,
                        color: "#FFFFFF",
                        fontFamily: "inherit",
                        fontSize: 12,
                        cursor: "grab",
                        opacity: row.item.doneAt ? 0.45 : 1,
                      }}
                    >
                      <span className="truncate">{row.item.title}</span>
                    </button>
                  </div>
                );
              })}

              <svg
                className="pointer-events-none absolute left-0 top-0"
                width={gridW}
                height={rows.length * ROW_H}
                viewBox={`0 0 ${gridW} ${rows.length * ROW_H}`}
                aria-hidden="true"
              >
                {deps.map((d, i) => {
                  const x1 = d.fromCol * DAY_W - 6;
                  const y1 = d.fromRow * ROW_H + ROW_H / 2;
                  const x2 = d.toCol * DAY_W + 6;
                  const y2 = d.toRow * ROW_H + ROW_H / 2;
                  return (
                    <g key={i}>
                      <path
                        d={`M${x1} ${y1} H${x1 + 12} V${y2} H${x2 - 7}`}
                        fill="none"
                        stroke="var(--color-ink-muted)"
                        strokeWidth={1.5}
                      />
                      <path
                        d={`M${x2 - 7} ${y2 - 4} L${x2} ${y2} L${x2 - 7} ${y2 + 4} Z`}
                        fill="var(--color-ink-muted)"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex items-center gap-4 text-[12px]"
        style={{ padding: "12px 18px", borderTop: `1px solid ${C.hairline}`, color: C.inkMuted }}
      >
        <span>Glisse une barre pour décaler la tâche · les flèches sont des dépendances</span>
      </div>
    </div>
  );
}

/**
 * Décale `startDate` ET `due` du même nombre de jours.
 *
 * Exporté pour que le parent construise le patch : décaler l'échéance sans
 * l'entrée ferait grandir la plage au lieu de la déplacer, et l'inverse la
 * ferait rétrécir jusqu'à s'inverser.
 *
 * ⚠️ Le décalage passe par le calendrier de Paris, pas par une addition de
 * millisecondes : ajouter `n × 86 400 000` traverse mal un changement d'heure
 * et déplace la tâche d'une heure deux fois par an.
 */
export function shiftRangePatch(item: Item, days: number): { startDate?: string | null; due?: string | null } {
  const shiftIso = (date: Date): string => {
    const p = zonedParts(date);
    const moved = shiftDays({ y: p.y, m: p.m, d: p.d }, days);
    return zonedTime(moved.y, moved.m, moved.d, p.hour, p.minute).toISOString();
  };

  const due = effectiveDue(item);
  const start = effectiveStart(item);
  const patch: { startDate?: string | null; due?: string | null } = {};
  if (due) patch.due = shiftIso(due);
  if (start) patch.startDate = shiftIso(start);
  return patch;
}
