"use client";

import { useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ClockIcon,
  CloseIcon,
  PlusIcon,
  ProjectDot,
  TrashIcon,
} from "./icons";
import { formatDue, resolveDue } from "@/lib/due";
import {
  DUE_CLEAR,
  DUE_SUGGESTIONS,
  PRIORITIES,
  PRIORITY_VALUES,
  shapeFor,
  skinFor,
} from "@/lib/projects";
import type { DraftItem, Priority, Project } from "@/lib/types";

const SWIPE_DELETE_PX = -95;
const SWIPE_MAX_PX = -160;

export function ReviewScreen({
  drafts,
  projects,
  transcript,
  saving,
  onBack,
  onPatch,
  onRemove,
  onAdd,
  onSend,
}: {
  drafts: DraftItem[];
  projects: Project[];
  transcript: string;
  saving: boolean;
  onBack: () => void;
  onPatch: (id: string, patch: Partial<DraftItem>) => void;
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
          className="flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-field border border-[var(--line-2)] bg-tile text-ink transition-all duration-200 hover:bg-page"
        >
          <ArrowLeftIcon />
        </button>
        <div className="flex flex-col">
          <h2 className="m-0 text-21 font-semibold tracking-[-0.3px] text-ink">Revue</h2>
          <span className="text-11 font-medium text-ink-2">
            {n} {n > 1 ? "tâches détectées" : "tâche détectée"}
          </span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="ml-auto flex h-[38px] cursor-pointer items-center gap-1.5 rounded-field border border-dashed border-[rgba(19,18,17,0.22)] bg-transparent px-3.5 text-13 font-semibold text-ink-2 transition-all duration-200 hover:border-action hover:text-action"
        >
          <PlusIcon />
          Tâche
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-[18px] pt-0.5 pb-4">
        {/* La transcription brute reste accessible depuis la revue : on ne perd
            jamais le texte d'origine, même si la structuration est mauvaise. */}
        <div className="flex-none rounded-row border border-[var(--line)] bg-page">
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            aria-expanded={showRaw}
            className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-3 text-left"
          >
            <span className="text-11 font-semibold tracking-[1.1px] text-ink-3 uppercase">
              Transcription brute
            </span>
            <ChevronDownIcon
              className={"ml-auto text-ink-3 transition-transform duration-200 " + (showRaw ? "rotate-180" : "")}
            />
          </button>
          {showRaw && (
            <p className="animate-br-in m-0 px-4 pb-3.5 text-13 leading-[1.5] text-ink-2">
              {transcript}
            </p>
          )}
        </div>

        {drafts.map((d) => {
          const project = byId(d.projectId);
          const skin = skinFor(project);
          const dx = dragId === d.id ? dragDx : 0;

          return (
            <div key={d.id} className="relative flex-none overflow-hidden rounded-tile">
              <div className="absolute inset-0 flex items-center justify-end bg-action pr-[22px] text-white">
                <TrashIcon />
              </div>
              <div
                onPointerDown={(e) => onDown(e, d.id)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                className="relative touch-pan-y rounded-tile border border-[var(--line)] bg-tile px-[13px] pt-[15px] pb-3 shadow-[var(--e1)]"
                style={{
                  transform: `translateX(${dx}px)`,
                  transition: dragId === d.id && dragging ? "none" : "transform .2s ease",
                }}
              >
                <div className="flex items-start gap-2">
                  <input
                    value={d.title}
                    onChange={(e) => onPatch(d.id, { title: e.target.value })}
                    placeholder="Intitulé de la tâche"
                    aria-label="Intitulé de la tâche"
                    className="w-full flex-1 border-none border-b border-b-transparent bg-transparent pt-0.5 pb-[5px] text-15 leading-[1.35] font-semibold tracking-[-0.2px] text-ink outline-none transition-colors duration-200 focus:border-b-accent"
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(d.id)}
                    title="Supprimer"
                    aria-label="Supprimer la tâche"
                    className="-mt-1 mr-[-2px] flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-chip border-none bg-transparent text-ink-3 transition-all duration-200 hover:bg-action-lo hover:text-action"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-[7px]">
                  <span
                    className="relative inline-flex h-8 items-center gap-2 rounded-chip pr-[26px] pl-[11px] text-13 font-semibold"
                    style={{ background: skin.bg, color: skin.fg }}
                  >
                    <ProjectDot shape={shapeFor(project ?? { id: d.projectId })} />
                    {project?.name ?? "Projet"}
                    <ChevronDownIcon className="absolute right-[9px] opacity-55" />
                    <select
                      value={d.projectId}
                      onChange={(e) => onPatch(d.id, { projectId: e.target.value })}
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

                  {/* Nature de l'item — VISIBLE ET MODIFIABLE PAR CONSTRUCTION.
                      Une erreur de classement du modèle n'est signalée nulle
                      part ailleurs : l'item partirait simplement dans la
                      mauvaise catégorie sans que rien ne l'indique. */}
                  <button
                    type="button"
                    onClick={() => onPatch(d.id, { kind: d.kind === "event" ? "task" : "event" })}
                    aria-label={`Nature : ${d.kind === "event" ? "rendez-vous" : "tâche"}, appuyer pour changer`}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-chip border border-[var(--line-2)] bg-tile px-2.5 text-13 font-semibold text-ink-2 transition-colors duration-200 hover:bg-page"
                  >
                    {d.kind === "event" ? "Rendez-vous" : "Tâche"}
                  </button>

                  <span className="relative inline-flex h-8 items-center gap-1.5 rounded-chip bg-page pr-6 pl-2.5 text-13 font-medium text-ink-2">
                    <ClockIcon />
                    {formatDue(d.due, d.allDay)}
                    <select
                      value=""
                      onChange={(e) => {
                        const resolved = resolveDue(e.target.value);
                        // Un libellé non reconnu efface l'échéance au lieu
                        // d'inventer une date : une échéance absente se voit,
                        // une échéance fausse ne se voit pas.
                        onPatch(d.id, {
                          due: resolved?.due ?? null,
                          allDay: resolved?.allDay ?? true,
                        });
                      }}
                      aria-label="Échéance"
                      className="absolute inset-0 h-full w-full cursor-pointer border-none opacity-0"
                    >
                      {/* Aucune option ne porte `value=""` — voir DUE_CLEAR. */}
                      <option value={DUE_CLEAR}>Pas d&apos;échéance</option>
                      {DUE_SUGGESTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </span>

                  <span className="inline-flex h-8 gap-[3px] rounded-chip bg-page p-[3px]">
                    {PRIORITY_VALUES.map((v: Priority) => {
                      const on = d.priority === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => onPatch(d.id, { priority: v })}
                          title={PRIORITIES[v].long}
                          aria-pressed={on}
                          className="min-w-[30px] cursor-pointer rounded-[9px] border-none px-[7px] text-11 font-semibold transition-all duration-200"
                          style={{
                            background: on ? PRIORITIES[v].bg : "transparent",
                            color: on ? PRIORITIES[v].fg : "var(--color-ink-3)",
                            boxShadow: on ? "var(--e1)" : "none",
                          }}
                        >
                          {PRIORITIES[v].label}
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
          <p className="mx-1 mt-2 mb-0 text-13 leading-[1.5] text-ink-2">
            Aucune tâche. Ajoute-en une à la main, ou reviens en arrière pour redicter — ta
            transcription est conservée.
          </p>
        )}

        {!!n && (
          <p className="mt-0.5 mx-1 mb-0 text-11 leading-[1.5] text-ink-3">
            Glisse une carte vers la gauche pour la supprimer. Tape un chip pour l&apos;éditer.
          </p>
        )}
      </div>

      <div className="safe-bottom flex-none border-t border-[var(--line)] bg-[rgba(250,248,245,0.92)] px-[18px] pt-3 pb-3 backdrop-blur-[10px]">
        <button
          type="button"
          onClick={onSend}
          disabled={saving || !n}
          className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-row border-none text-15 font-semibold transition-all duration-200 active:scale-[0.985] disabled:cursor-default"
          style={{
            background: n && !saving ? "var(--color-action)" : "var(--color-ink-3)",
            color: n && !saving ? "var(--color-tile)" : "var(--color-ink-2)",
            boxShadow: n && !saving ? "var(--e-mic)" : "none",
          }}
        >
          {saving && (
            <span className="animate-br-spin block h-[17px] w-[17px] rounded-full border-2 border-[rgba(255,255,255,0.35)] border-t-white" />
          )}
          {saving ? "Envoi en cours…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
