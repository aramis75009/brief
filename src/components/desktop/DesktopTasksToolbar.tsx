"use client";

import { useEffect, useRef, useState } from "react";
import type { TasksGroupBy, TasksSort } from "@/lib/prefs";

/**
 * Barre d'outils de l'écran « Mes tâches » — quatre boutons
 * (`+ Ajouter une tâche | Filtrer | Trier | Regrouper | Options`),
 * trois panneaux popovers ancrés sous les boutons.
 *
 * Le bouton `Options` est volontairement vide pour l'instant : c'est
 * sa présence qui compte (la barre ressemble à la maquette). Il sera
 * rempli au prochain tour.
 *
 * `doneHidden` est appliqué en amont dans `DesktopShell.tsx` ; ici on
 * ne fait qu'exposer le toggle et le nombre d'éléments masqués, pour
 * qu'un clic dessus réouvre le panneau (le toggle est coché = on
 * masque, mais l'indicateur reste cliquable pour accéder au panneau).
 */

export interface ToolbarHandlers {
  onAddTask: () => void;
  onToggleDoneHidden: (next: boolean) => void;
  onChangeSort: (sort: TasksSort) => void;
  onChangeGroupBy: (g: TasksGroupBy) => void;
}

export interface ToolbarState {
  doneHidden: boolean;
  sort: TasksSort;
  groupBy: TasksGroupBy;
  /** Nb de tâches terminées actuellement masquées par le toggle. */
  doneHiddenCount: number;
}

type Panel = null | "filter" | "sort" | "group";

export function DesktopTasksToolbar({
  state,
  handlers,
}: {
  state: ToolbarState;
  handlers: ToolbarHandlers;
}) {
  const [open, setOpen] = useState<Panel>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Clic hors panneau = fermeture. Écoute uniquement quand un panneau
  // est ouvert, pour ne pas pénaliser les taps rapides sur la liste.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const chip: React.CSSProperties = {
    height: 32,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid var(--hairline-2)",
    background: "var(--color-surface)",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--color-ink)",
    cursor: "pointer",
  };

  const addBtn: React.CSSProperties = {
    ...chip,
    background: "var(--color-ink)",
    color: "#FFFFFF",
    border: "1px solid var(--color-ink)",
  };

  const togglePanel = (p: Panel) => setOpen((cur) => (cur === p ? null : p));

  const paneItem = (active: boolean): React.CSSProperties => ({
    width: "100%",
    textAlign: "left",
    borderRadius: 6,
    padding: "6px 10px",
    height: "auto",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    border: "none",
    background: active ? "var(--color-bg)" : "transparent",
    color: active ? "var(--color-ink)" : "var(--color-ink-muted)",
    cursor: "pointer",
  });

  return (
    <div
      ref={rootRef}
      className="relative flex flex-wrap items-center gap-2"
      data-testid="tasks-toolbar"
    >
      <button
        type="button"
        onClick={handlers.onAddTask}
        aria-label="Ajouter une tâche"
        style={addBtn}
      >
        + Ajouter une tâche
      </button>

      <button
        type="button"
        onClick={() => togglePanel("filter")}
        aria-expanded={open === "filter"}
        aria-haspopup="dialog"
        style={chip}
      >
        Filtrer
      </button>
      <button
        type="button"
        onClick={() => togglePanel("sort")}
        aria-expanded={open === "sort"}
        aria-haspopup="dialog"
        style={chip}
      >
        Trier
      </button>
      <button
        type="button"
        onClick={() => togglePanel("group")}
        aria-expanded={open === "group"}
        aria-haspopup="dialog"
        style={chip}
      >
        Regrouper
      </button>
      <button
        type="button"
        onClick={() => {
          /* Option volontairement vide — le bouton existe pour ressembler à la maquette. */
        }}
        aria-label="Options"
        style={chip}
      >
        Options
      </button>

      {/* Indicateur discret des terminées masquées : ouvre le panneau Filtrer. */}
      {state.doneHidden && state.doneHiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setOpen("filter")}
          className="flex items-center gap-1"
          style={{
            ...chip,
            background: "var(--color-bg)",
            color: "var(--color-ink-muted)",
            fontWeight: 500,
          }}
          aria-label={`${state.doneHiddenCount} tâche(s) terminée(s) masquée(s) — ouvrir les filtres`}
        >
          <span aria-hidden="true">·</span>
          <span>{state.doneHiddenCount} masquée{state.doneHiddenCount > 1 ? "s" : ""}</span>
        </button>
      )}

      {open === "filter" && (
        <Popover anchor="left" onClose={() => setOpen(null)}>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Tâches terminées</span>
            <Switch
              checked={state.doneHidden}
              onChange={handlers.onToggleDoneHidden}
              label="Masquer les tâches terminées"
            />
          </div>
          <p className="px-3 pb-3" style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
            Activé par défaut — les tâches terminées n&apos;apparaissent pas dans Mes tâches.
          </p>
        </Popover>
      )}

      {open === "sort" && (
        <Popover anchor="left" onClose={() => setOpen(null)}>
          {(["urgency", "due", "priority", "project"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                handlers.onChangeSort(s);
                setOpen(null);
              }}
              style={paneItem(state.sort === s)}
            >
              {labelForSort(s)}
            </button>
          ))}
        </Popover>
      )}

      {open === "group" && (
        <Popover anchor="left" onClose={() => setOpen(null)}>
          {(["time", "project"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                handlers.onChangeGroupBy(g);
                setOpen(null);
              }}
              style={paneItem(state.groupBy === g)}
            >
              {g === "time" ? "Par date d'échéance" : "Par projet"}
            </button>
          ))}
        </Popover>
      )}
    </div>
  );
}

function labelForSort(s: TasksSort): string {
  switch (s) {
    case "urgency": return "Tri : urgence";
    case "due": return "Tri : échéance";
    case "priority": return "Tri : priorité";
    case "project": return "Tri : projet";
  }
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        background: checked ? "var(--color-ink)" : "var(--hairline-2)",
        position: "relative",
        transition: "background-color .15s ease",
        cursor: "pointer",
        border: "none",
        padding: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: "#FFFFFF",
          transition: "left .15s ease",
        }}
      />
    </button>
  );
}

function Popover({
  children,
  anchor = "left",
  onClose,
}: {
  children: React.ReactNode;
  anchor?: "left";
  onClose: () => void;
}) {
  // Échap ferme le panneau — comportement attendu pour un popover de filtre.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: anchor === "left" ? 140 : 0,
        minWidth: 240,
        background: "var(--color-surface)",
        border: "1px solid var(--hairline-2)",
        borderRadius: 10,
        boxShadow: "0 12px 32px rgba(15,15,15,.12)",
        padding: 6,
        zIndex: 30,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}