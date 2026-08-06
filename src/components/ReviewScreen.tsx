"use client";

import { useRef, useState } from "react";
import { ArrowLeftIcon, ChevronDownIcon, ClockIcon, CloseIcon, PlusIcon, TrashIcon } from "./icons";
import { DUE_OPTIONS, PRIOS, PRIO_ORDER, PROJECTS, dueISOFor, dueOpt, projectById } from "@/lib/mock";
import type { Draft, PrioKey } from "@/lib/types";

const SWIPE_DELETE_PX = -95;
const SWIPE_MAX_PX = -160;

export function ReviewScreen({
  drafts,
  sending,
  onBack,
  onPatch,
  onRemove,
  onAdd,
  onSend,
}: {
  drafts: Draft[];
  sending: boolean;
  onBack: () => void;
  onPatch: (id: string, patch: Partial<Draft>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onSend: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ id: string; x: number } | null>(null);

  const onDown = (e: React.PointerEvent, id: string) => {
    const tag = (e.target as HTMLElement).tagName;
    if (/INPUT|SELECT|TEXTAREA|BUTTON|OPTION/.test(tag)) return;
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
  const sendDisabled = sending || !n;

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
            {n} {n > 1 ? "tâches détectées" : "tâche détectée"} · max 5
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
        {drafts.map((d) => {
          const p = projectById(d.projectId);
          const prio = PRIOS[d.prio];
          const dueText = d.dueText || dueOpt(d.dueKey).text;
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
                className="relative touch-pan-y rounded-[22px] border border-[rgba(28,26,24,0.07)] bg-card px-[13px] pt-[13px] pb-3 shadow-[0_2px_12px_-8px_rgba(28,26,24,0.3)]"
                style={{
                  transform: `translateX(${dx}px)`,
                  transition: dragId === d.id && dragging ? "none" : "transform .2s ease",
                }}
              >
                <div className="mb-[11px] flex items-start gap-2">
                  <div className="min-w-0 flex-1 rounded-[14px] border border-[rgba(28,26,24,0.06)] bg-stone-2 px-3 py-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="h-[5px] w-[5px] rounded-full bg-accent" />
                      <span className="text-[9.5px] font-semibold tracking-[1.1px] text-muted-2 uppercase">
                        Todoist Quick Add
                      </span>
                    </div>
                    <p className="m-0 font-mono text-[12.5px] leading-[1.6] break-words text-ink">
                      {d.title.trim() || "Nouvelle tâche"}
                      {dueText && <span className="font-medium text-[#8A6A2E]"> {dueText}</span>}
                      <span className="font-semibold" style={{ color: p.fg }}>
                        {" "}
                        #{p.tag}
                      </span>
                      <span className="font-semibold text-accent-deep"> {d.prio}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(d.id)}
                    title="Supprimer"
                    aria-label="Supprimer la tâche"
                    className="mr-[-2px] flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-[11px] border-none bg-transparent text-muted-2 transition-all duration-200 hover:bg-accent-soft hover:text-accent"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <input
                  value={d.title}
                  onChange={(e) => onPatch(d.id, { title: e.target.value })}
                  placeholder="Titre de la tâche"
                  aria-label="Titre de la tâche"
                  className="w-full border-none border-b border-b-transparent bg-transparent pt-0.5 pb-[5px] text-[15.5px] leading-[1.35] font-semibold tracking-[-0.2px] text-ink outline-none transition-colors duration-200 focus:border-b-accent"
                />

                <div className="mt-2.5 flex flex-wrap items-center gap-[7px]">
                  <span
                    className="relative inline-flex h-8 items-center rounded-[11px] pr-[26px] pl-[11px] text-[12.5px] font-semibold"
                    style={{ background: p.bg, color: p.fg }}
                  >
                    {p.name}
                    <ChevronDownIcon className="absolute right-[9px] opacity-55" />
                    <select
                      value={d.projectId}
                      onChange={(e) => onPatch(d.id, { projectId: e.target.value })}
                      aria-label="Projet"
                      className="absolute inset-0 h-full w-full cursor-pointer border-none opacity-0"
                    >
                      {PROJECTS.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.name}
                        </option>
                      ))}
                    </select>
                  </span>

                  <span className="relative inline-flex h-8 items-center gap-1.5 rounded-[11px] bg-stone-1 pr-6 pl-2.5 text-[12.5px] font-medium text-ink-soft">
                    <ClockIcon />
                    {d.dueKey === "none" ? "Pas d'échéance" : dueText || dueOpt(d.dueKey).label}
                    <select
                      value={d.dueKey}
                      onChange={(e) =>
                        onPatch(d.id, {
                          dueKey: e.target.value,
                          dueText: dueOpt(e.target.value).text,
                          dueISO: dueISOFor(e.target.value),
                        })
                      }
                      aria-label="Échéance"
                      className="absolute inset-0 h-full w-full cursor-pointer border-none opacity-0"
                    >
                      {DUE_OPTIONS.map((op) => (
                        <option key={op.key} value={op.key}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </span>

                  <span className="inline-flex h-8 gap-[3px] rounded-[11px] bg-stone-1 p-[3px]">
                    {PRIO_ORDER.map((k: PrioKey) => {
                      const on = d.prio === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => onPatch(d.id, { prio: k })}
                          title={PRIOS[k].long}
                          className="min-w-[30px] cursor-pointer rounded-[9px] border-none px-[7px] text-xs font-semibold transition-all duration-200"
                          style={{
                            background: on ? PRIOS[k].bg : "transparent",
                            color: on ? PRIOS[k].fg : "#A9A29B",
                            boxShadow: on ? "0 1px 4px -2px rgba(28,26,24,.4)" : "none",
                          }}
                        >
                          {PRIOS[k].label}
                        </button>
                      );
                    })}
                  </span>
                </div>
                <span className="sr-only">Priorité actuelle : {prio.long}</span>
              </div>
            </div>
          );
        })}

        <p className="mt-0.5 mx-1 mb-0 text-[11.5px] leading-[1.5] text-muted-2">
          Glisse une carte vers la gauche pour la supprimer. Tape un chip pour éditer — la string se
          régénère.
        </p>
      </div>

      <div className="flex-none border-t border-[rgba(28,26,24,0.07)] bg-[rgba(250,248,245,0.92)] px-[18px] pt-3 pb-3.5 backdrop-blur-[10px]">
        <button
          type="button"
          onClick={onSend}
          disabled={sendDisabled}
          className="flex h-[54px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[18px] border-none text-base font-semibold text-white shadow-[0_8px_22px_-12px_rgba(192,96,60,0.9)] transition-all duration-200 active:scale-[0.985] disabled:cursor-default"
          style={{ background: n && !sending ? "#C0603C" : "#D8CFC9" }}
        >
          {sending && (
            <span className="animate-br-spin block h-[17px] w-[17px] rounded-full border-2 border-[rgba(255,255,255,0.35)] border-t-white" />
          )}
          {sending ? "Envoi en cours…" : `Envoyer vers Todoist (${n})`}
        </button>
      </div>
    </div>
  );
}
