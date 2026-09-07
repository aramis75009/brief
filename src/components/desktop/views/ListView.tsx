"use client";

/**
 * La vue Liste — le tableau à colonnes du prototype.
 *
 * Nom · Échéance · Projet · Priorité · Statut, groupé par section (colonne
 * Kanban dans un projet) ou par temps (hors projet). Le groupement vient de
 * `groupItems`, testé sans DOM : ce composant ne fait que rendre.
 */

import { useState } from "react";
import { statusOf } from "@/lib/status";
import { rangeLabel, type ItemGroup } from "@/lib/views";
import { CheckCircle, Count, EmptyView, PriorityPill, ProjectBadge, StatusPill } from "../ui";
import { C, R } from "../tokens";
import type { Item, Project } from "@/lib/types";

/** Les cinq colonnes, en une seule déclaration : l'en-tête et les lignes la partagent. */
const GRID = "minmax(0,1fr) 168px 158px 118px 148px";

export function ListView({
  groups,
  projects,
  items,
  now,
  onToggleDone,
  onOpenTask,
  onAddTask,
}: {
  groups: ItemGroup[];
  projects: Project[];
  /** TOUS les items, pour résoudre les dépendances du statut — pas seulement ceux affichés. */
  items: Item[];
  now: Date;
  onToggleDone: (id: string) => void;
  onOpenTask: (id: string) => void;
  onAddTask: (groupKey: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const byId = new Map(items.map((it) => [it.id, it]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  if (groups.length === 0 || total === 0) {
    return (
      <EmptyView
        title="Rien à afficher ici"
        hint="Dicte une note ou ajoute une tâche — elle apparaîtra dans la section qui correspond à son échéance."
      />
    );
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.hairline2}`, borderRadius: R.card, overflow: "auto" }}>
      <div style={{ minWidth: 880 }}>
        <div
          className="grid items-center font-bold uppercase"
          style={{
            gridTemplateColumns: GRID,
            gap: 12,
            padding: "0 18px",
            height: 38,
            borderBottom: `1px solid ${C.hairline2}`,
            background: "var(--color-bg)",
            fontSize: 11,
            letterSpacing: "0.06em",
            color: C.inkMuted,
          }}
        >
          <span>Nom</span>
          <span>Échéance</span>
          <span>Projet</span>
          <span>Priorité</span>
          <span>Statut</span>
        </div>

        {groups.map((group) => {
          const open = !collapsed[group.key];
          return (
            <div key={group.key}>
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !c[group.key] }))}
                aria-expanded={open}
                className="flex w-full items-center gap-2.25 text-left"
                style={{
                  padding: "0 18px",
                  height: 42,
                  background: C.surface,
                  border: "none",
                  borderBottom: `1px solid ${C.hairline}`,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 10, color: C.inkMuted, width: 10 }} aria-hidden="true">
                  {open ? "▾" : "▸"}
                </span>
                <span className="text-[14px] font-extrabold tracking-[-0.01em]">{group.label}</span>
                <Count n={group.items.length} />
              </button>

              {open && (
                <div>
                  {group.items.map((it) => {
                    const status = statusOf(it, now, byId);
                    const done = !!it.doneAt;
                    return (
                      <div
                        key={it.id}
                        className="grid items-center hover:bg-[var(--color-bg)]"
                        style={{
                          gridTemplateColumns: GRID,
                          gap: 12,
                          padding: "0 18px",
                          height: 47,
                          borderBottom: `1px solid ${C.hairline}`,
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <CheckCircle
                            done={done}
                            onToggle={() => onToggleDone(it.id)}
                            label={done ? `Rouvrir « ${it.title} »` : `Marquer « ${it.title} » comme faite`}
                          />
                          <button
                            type="button"
                            onClick={() => onOpenTask(it.id)}
                            className="truncate text-left text-[14px] font-semibold hover:text-[var(--color-task-700)]"
                            style={{
                              border: "none",
                              background: "none",
                              padding: 0,
                              fontFamily: "inherit",
                              cursor: "pointer",
                              color: done ? C.inkFaint : C.ink,
                              textDecoration: done ? "line-through" : "none",
                            }}
                          >
                            {it.title}
                          </button>
                          {it.audioOrigin && (
                            <span
                              className="flex-none font-mono font-semibold"
                              title="Issue d'une dictée"
                              style={{
                                fontSize: 9,
                                letterSpacing: "0.06em",
                                padding: "3px 7px",
                                borderRadius: 6,
                                background: "var(--color-bg)",
                                color: C.inkMuted,
                              }}
                            >
                              VOIX
                            </span>
                          )}
                          {it.ownerUserId && (
                            <span
                              className="flex-none font-mono font-semibold"
                              title="Tâche qu'un autre compte t'a assignée — tu peux la cocher"
                              style={{
                                fontSize: 9,
                                letterSpacing: "0.06em",
                                padding: "3px 7px",
                                borderRadius: 6,
                                background: "var(--color-bg)",
                                color: "var(--color-task-700, #2563EB)",
                              }}
                            >
                              PARTAGÉE
                            </span>
                          )}
                          {(it.subtasks?.length ?? 0) > 0 && (
                            <span className="tnum flex-none text-[11px]" style={{ color: C.inkFaint }}>
                              {it.subtasks!.filter((s) => s.done).length}/{it.subtasks!.length}
                            </span>
                          )}
                        </div>

                        <span
                          className="truncate text-[13px] font-semibold"
                          style={{ color: status === "late" ? "var(--color-late-700)" : done ? C.inkFaint : C.ink }}
                        >
                          {rangeLabel(it, now)}
                        </span>

                        <ProjectBadge project={projectById.get(it.projectId)} />

                        <span className="justify-self-start">
                          <PriorityPill priority={it.priority} />
                        </span>

                        <span className="justify-self-start">
                          <StatusPill status={status} />
                        </span>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => onAddTask(group.key)}
                    className="flex w-full items-center gap-2.75 font-semibold hover:text-[var(--color-ink)]"
                    style={{
                      padding: "0 18px",
                      height: 42,
                      border: "none",
                      background: "none",
                      borderBottom: `1px solid ${C.hairline}`,
                      color: C.inkFaint,
                      fontFamily: "inherit",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 15 }}>+</span>
                    <span>Ajouter une tâche</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
