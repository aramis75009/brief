"use client";

import { useRef, useState } from "react";
import { ArrowLeftIcon, ChevronDownIcon, ClockIcon, CloseIcon, PlusIcon, TrashIcon } from "./icons";
import { DUE_SUGGESTIONS, PRIOS, PRIO_VALUES, skinFor } from "@/lib/todoist";
import type { Draft, PrioValue, Project } from "@/lib/types";

const SWIPE_DELETE_PX = -95;
const SWIPE_MAX_PX = -160;

export function ReviewScreen({
  drafts,
  projects,
  transcript,
  pushing,
  onBack,
  onPatch,
  onRemove,
  onAdd,
  onSend,
}: {
  drafts: Draft[];
  projects: Project[];
  transcript: string;
  pushing: boolean;
  onBack: () => void;
  onPatch: (id: string, patch: Partial<Draft>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onSend: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const dragRef = useRef<{ id: string; x: number } | null>(null);

  const onDown = (e: React.PointerEvent, id: string) => {
    if (/INPUT|SELECT|TEXTAREA|BUTTON|OPTION/.test((e.target as HTMLElement).tagName)) return;
    dragRef.current = { id, x: e.clientX };
    setDragId(id);
    setDragDx(0);
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setDragDx(Math.max(SWIPE_MAX_PX, Math.min(0, e.clientX - dragRef.current.x)));
  };
  const onUp = () => {
    if (!dragRef.current) return;
    const { id } = dragRef.current;
    dragRef.current = null;
    if (dragDx < SWIPE_DELETE_PX) onRemove(id);
    setDragId(null);
    setDragDx(0);
    setDragging(false);
  };

  const n = drafts.length;
  const byId = (id: string) => projects.find((p) => p.id === id) ?? projects[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center gap-2.5 px-[22px] pt-2 pb-3">
        <button
          type="button"
          onClick={onBack}
          title="Retour"
          aria-label="Retour à la capture"
          className="flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-[13px] border border-[rgba(28,26,24,0.09)] bg-card text-ink transition-all duration-200 hover:bg-stone-1"
        >
          <ArrowLeftIcon />
        </button>
        <div className="flex flex-col">
          <h2 className="m-0 text-xl font-semibold tracking-[-0.3px] text-ink">Revue</h2>
          <span className="text-xs font-medium text-muted">
            {n} {n > 1 ? "tâches détectées" : "tâche détectée"}
          </span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="ml-auto flex h-[38px] cursor-pointer items-center gap-1.5 rounded-[13px] border border-dashed border-[rgba(28,26,24,0.22)] bg-transparent px-3.5 text-[13px] font-semibold text-ink-soft transition-all duration-200 hover:border-accent hover:text-accent"
        >
          <PlusIcon />
          Tâche
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-[18px] pt-0.5 pb-4">
        {/* La transcription brute reste accessible depuis la revue : on ne perd
            jamais le texte d'origine, même si la structuration est mauvaise. */}
        <div className="flex-none rounded-[18px] border border-[rgba(28,26,24,0.07)] bg-stone-2">
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            aria-expanded={showRaw}
            className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-3 text-left"
          >
            <span className="text-[10.5px] font-semibold tracking-[1.1px] text-muted-2 uppercase">
              Transcription brute
            </span>
            <ChevronDownIcon
              className={"ml-auto text-muted-2 transition-transform duration-200 " + (showRaw ? "rotate-180" : "")}
            />
          </button>
          {showRaw && (
            <p className="animate-br-in m-0 px-4 pb-3.5 text-[13.5px] leading-[1.5] text-ink-soft">
              {transcript}
            </p>
          )}
        </div>

        {drafts.map((d) => {
          const project = byId(d.project_id);
          const skin = skinFor(project);
          const dx = dragId === d.id ? dragDx : 0;

          return (
            <div key={d.id} className="relative flex-none overflow-hidden rounded-[22px]">
              <div className="absolute inset-0 flex items-center justify-end bg-accent pr-[22px] text-white">
                <TrashIcon />
              </div>
              <div
                onPointerDown={(e) => onDown(e, d.id)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                className="relative touch-pan-y rounded-[22px] border border-[rgba(28,26,24,0.07)] bg-card px-[13px] pt-[15px] pb-3 shadow-[0_2px_12px_-8px_rgba(28,26,24,0.3)]"
                style={{
                  transform: `translateX(${dx}px)`,
                  transition: dragId === d.id && dragging ? "none" : "transform .2s ease",
                }}
              >
                <div className="flex items-start gap-2">
                  <input
                    value={d.content}
                    onChange={(e) => onPatch(d.id, { content: e.target.value })}
                    placeholder="Intitulé de la tâche"
                    aria-label="Intitulé de la tâche"
                    className="w-full flex-1 border-none border-b border-b-transparent bg-transparent pt-0.5 pb-[5px] text-[15.5px] leading-[1.35] font-semibold tracking-[-0.2px] text-ink outline-none transition-colors duration-200 focus:border-b-accent"
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(d.id)}
                    title="Supprimer"
                    aria-label="Supprimer la tâche"
                    className="-mt-1 mr-[-2px] flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-[11px] border-none bg-transparent text-muted-2 transition-all duration-200 hover:bg-accent-soft hover:text-accent"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-[7px]">
                  <span
                    className="relative inline-flex h-8 items-center rounded-[11px] pr-[26px] pl-[11px] text-[12.5px] font-semibold"
                    style={{ background: skin.bg, color: skin.fg }}
                  >
                    {project?.name ?? "Projet"}
                    <ChevronDownIcon className="absolute right-[9px] opacity-55" />
                    <select
                      value={d.project_id}
                      onChange={(e) => onPatch(d.id, { project_id: e.target.value })}
                      aria-label="Projet"
                      className="absolute inset-0 h-full w-full cursor-pointer border-none opacity-0"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </span>

                  <span className="relative inline-flex h-8 items-center gap-1.5 rounded-[11px] bg-stone-1 pr-6 pl-2.5 text-[12.5px] font-medium text-ink-soft">
                    <ClockIcon />
                    {d.due_string || "Pas d'échéance"}
                    <select
                      value={d.due_string ?? ""}
                      onChange={(e) =>
                        onPatch(d.id, { due_string: e.target.value || undefined })
                      }
                      aria-label="Échéance"
                      className="absolute inset-0 h-full w-full cursor-pointer border-none opacity-0"
                    >
                      {[...new Set([d.due_string ?? "", ...DUE_SUGGESTIONS])].map((s) => (
                        <option key={s || "none"} value={s}>
                          {s || "Pas d'échéance"}
                        </option>
                      ))}
                    </select>
                  </span>

                  <span className="inline-flex h-8 gap-[3px] rounded-[11px] bg-stone-1 p-[3px]">
                    {PRIO_VALUES.map((v: PrioValue) => {
                      const on = d.priority === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => onPatch(d.id, { priority: v })}
                          title={PRIOS[v].long}
                          aria-pressed={on}
                          className="min-w-[30px] cursor-pointer rounded-[9px] border-none px-[7px] text-xs font-semibold transition-all duration-200"
                          style={{
                            background: on ? PRIOS[v].bg : "transparent",
                            color: on ? PRIOS[v].fg : "#A9A29B",
                            boxShadow: on ? "0 1px 4px -2px rgba(28,26,24,.4)" : "none",
                          }}
                        >
                          {PRIOS[v].label}
                        </button>
                      );
                    })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {!n && (
          <p className="mx-1 mt-2 mb-0 text-[13px] leading-[1.5] text-muted">
            Aucune tâche. Ajoute-en une à la main, ou reviens en arrière pour redicter — ta
            transcription est conservée.
          </p>
        )}

        {!!n && (
          <p className="mt-0.5 mx-1 mb-0 text-[11.5px] leading-[1.5] text-muted-2">
            Glisse une carte vers la gauche pour la supprimer. Tape un chip pour l&apos;éditer.
          </p>
        )}
      </div>

      <div className="safe-bottom flex-none border-t border-[rgba(28,26,24,0.07)] bg-[rgba(250,248,245,0.92)] px-[18px] pt-3 pb-3 backdrop-blur-[10px]">
        <button
          type="button"
          onClick={onSend}
          disabled={pushing || !n}
          className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[18px] border-none text-base font-semibold transition-all duration-200 active:scale-[0.985] disabled:cursor-default"
          style={{
            background: n && !pushing ? "#C0603C" : "#D8CFC9",
            color: n && !pushing ? "#FFFFFF" : "#4A4640",
            boxShadow: n && !pushing ? "0 8px 22px -12px rgba(192,96,60,0.9)" : "none",
          }}
        >
          {pushing && (
            <span className="animate-br-spin block h-[17px] w-[17px] rounded-full border-2 border-[rgba(255,255,255,0.35)] border-t-white" />
          )}
          {pushing ? "Envoi en cours…" : `Envoyer vers Todoist (${n})`}
        </button>
      </div>
    </div>
  );
}
