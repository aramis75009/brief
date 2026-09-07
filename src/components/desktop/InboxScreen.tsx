"use client";

/**
 * La boîte de réception — deux onglets, deux natures de « pas encore traité ».
 *
 * **Activité** : ce que Brief a fait sans qu'on le lui demande — un rappel
 * parti, une édition adoptée depuis Apple Calendar, une tâche débloquée. Ces
 * faits n'existaient nulle part dans l'interface ; ils ne laissaient qu'une
 * ligne dans le journal d'un conteneur.
 *
 * **À trier** : les idées, que la v1 mettait dans un onglet de nav à elles
 * seules. Elles n'ont jamais été une destination — ce sont des entrées en
 * attente de décision, exactement comme le reste de cet écran.
 */

import { useState } from "react";
import { TIMEZONE } from "@/lib/zoned";
import { EmptyView } from "./ui";
import { C, R } from "./tokens";
import { DesktopIdeas } from "./DesktopIdeas";
import type { InboxEvent, InboxEventKind, Item, Project } from "@/lib/types";

const KIND_STYLE: Record<InboxEventKind, { glyph: string; background: string; color: string; label: string }> = {
  reminder: { glyph: "⏰", background: "var(--color-late-100)", color: "var(--color-late-700)", label: "Rappel" },
  caldav: { glyph: "⇄", background: "var(--color-task-100)", color: "var(--color-task-700)", label: "Calendrier" },
  unblocked: { glyph: "✓", background: "var(--color-meet-100)", color: "var(--color-meet-700)", label: "Débloquée" },
  capture: { glyph: "●", background: "var(--color-ink)", color: "var(--color-task-100)", label: "Dictée" },
  objective: { glyph: "◎", background: "var(--color-idea-100)", color: "var(--color-idea-700)", label: "Objectif" },
};

/** « il y a 20 min », « hier », « le 3 sept » — jamais un horodatage brut. */
export function relativeTime(at: string, now: Date): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  if (hours < 48) return "hier";
  return `le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: TIMEZONE })}`;
}

export function InboxScreen({
  events,
  unread,
  ideas,
  projects,
  now,
  onMarkRead,
  onOpenTask,
  onPromoteIdea,
  onArchiveIdea,
  onRerouteIdea,
}: {
  events: InboxEvent[];
  unread: number;
  ideas: Item[];
  projects: Project[];
  now: Date;
  onMarkRead: () => void;
  onOpenTask: (id: string) => void;
  onPromoteIdea: (id: string) => void;
  onArchiveIdea: (id: string) => void;
  onRerouteIdea: (id: string, projectId: string) => void;
}) {
  const [tab, setTab] = useState<"activity" | "triage">("activity");

  const tabs = [
    { key: "activity" as const, label: "Activité", count: unread },
    { key: "triage" as const, label: "À trier", count: ideas.length },
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-none items-center gap-2">
        <div className="flex gap-0.5" style={{ padding: 4, background: C.bg, borderRadius: R.chip }}>
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={on ? "page" : undefined}
                className="flex items-center gap-1.75 font-bold"
                style={{
                  height: 30,
                  padding: "0 14px",
                  borderRadius: R.chip,
                  border: "none",
                  background: on ? C.surface : "transparent",
                  color: on ? C.ink : C.inkMuted,
                  boxShadow: on ? "0 1px 3px rgba(16,16,16,.1)" : "none",
                  fontFamily: "inherit",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <span>{t.label}</span>
                {t.count > 0 && <span className="tnum text-[11px]">{t.count}</span>}
              </button>
            );
          })}
        </div>

        {tab === "activity" && unread > 0 && (
          <button
            type="button"
            onClick={onMarkRead}
            className="ml-auto text-[12px] font-bold"
            style={{ border: "none", background: "none", color: C.inkMuted, cursor: "pointer", fontFamily: "inherit" }}
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "activity" ? (
          events.length === 0 ? (
            <EmptyView
              title="Rien à signaler"
              hint="Les rappels envoyés, les modifications adoptées depuis Apple Calendar et les tâches débloquées atterrissent ici."
            />
          ) : (
            <div className="mx-auto flex flex-col gap-2.5" style={{ maxWidth: 760 }}>
              {events.map((e) => {
                const style = KIND_STYLE[e.kind];
                return (
                  <div
                    key={e.id}
                    className="flex gap-3.5"
                    style={{
                      background: C.surface,
                      border: `1px solid ${C.hairline2}`,
                      // Un liseré à gauche plutôt qu'un fond teinté pour le
                      // non-lu : le fond rendrait son texte moins lisible que
                      // celui du lu, soit l'inverse de ce qu'on veut.
                      borderLeftWidth: 3,
                      borderLeftColor: e.readAt ? "transparent" : C.ink,
                      borderRadius: R.xl,
                      padding: "15px 17px",
                    }}
                  >
                    <span
                      className="flex flex-none items-center justify-center font-bold"
                      style={{ width: 34, height: 34, borderRadius: 11, fontSize: 13, background: style.background, color: style.color }}
                      title={style.label}
                      aria-hidden="true"
                    >
                      {style.glyph}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold">{e.title}</div>
                      <div className="text-[13px]" style={{ color: C.inkMuted, marginTop: 3, lineHeight: 1.5 }}>
                        {e.body}
                      </div>
                      {e.itemId && (
                        <button
                          type="button"
                          onClick={() => onOpenTask(e.itemId!)}
                          className="text-[12px] font-bold hover:underline"
                          style={{ border: "none", background: "none", padding: 0, marginTop: 8, color: "var(--color-task-700)", fontFamily: "inherit", cursor: "pointer" }}
                        >
                          Ouvrir la tâche
                        </button>
                      )}
                    </div>
                    <span className="flex-none whitespace-nowrap text-[11px]" style={{ color: C.inkFaint }}>
                      {relativeTime(e.at, now)}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <DesktopIdeas
            ideas={ideas}
            projects={projects}
            onPromote={onPromoteIdea}
            onReroute={onRerouteIdea}
            onArchive={onArchiveIdea}
          />
        )}
      </div>
    </div>
  );
}
