"use client";

/**
 * Les briques partagées par les vues de la refonte v2.
 *
 * Elles vivent ici plutôt que dans chaque vue parce que la Liste, le Tableau,
 * la Chronologie et la fiche montrent RIGOUREUSEMENT les mêmes pastilles : une
 * priorité qui n'aurait pas le même pastel d'un écran à l'autre se lit comme
 * deux priorités différentes.
 */

import { PRIORITIES, shapeFor, skinFor } from "@/lib/projects";
import { PRIORITY_LABEL, STATUS_LABEL, type TaskStatus } from "@/lib/status";
import { ProjectDot } from "@/components/icons";
import { C, R, STATUS_PASTEL } from "./tokens";
import type { Priority, Project } from "@/lib/types";

/* --- Pastilles ------------------------------------------------------------ */

export function Pill({
  children,
  bg,
  fg,
  title,
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex flex-none items-center gap-1.5 font-bold"
      style={{ padding: "4px 11px", borderRadius: R.chip, fontSize: 12, background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: TaskStatus }) {
  const pastel = STATUS_PASTEL[status];
  return (
    <Pill bg={pastel.bg} fg={pastel.fg}>
      {STATUS_LABEL[status]}
    </Pill>
  );
}

/**
 * La priorité, avec le pastel que `PRIORITIES` porte déjà.
 *
 * ⚠️ **1 est la plus haute** (RFC 5545). Le libellé vient de `PRIORITY_LABEL`,
 * une seule table dans tout le projet — deux tables finiraient par diverger,
 * et l'inversion de priorité est le bug que `types.ts` interdit nommément.
 */
export function PriorityPill({ priority }: { priority: Priority }) {
  const meta = PRIORITIES[priority];
  return (
    <Pill bg={meta.bg} fg={meta.fg} title={meta.long}>
      {PRIORITY_LABEL[priority]}
    </Pill>
  );
}

/* --- Projet --------------------------------------------------------------- */

/** Pastille de projet — teinte ET forme, pour rester lisible sans couleur. */
export function ProjectBadge({ project, compact }: { project: Project | undefined; compact?: boolean }) {
  if (!project) {
    return <span className="text-[13px]" style={{ color: C.inkFaint }}>—</span>;
  }
  const skin = skinFor(project);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex-none" style={{ color: skin.bg }}>
        <ProjectDot size={9} shape={shapeFor(project)} />
      </span>
      <span
        className="truncate"
        style={{ fontSize: compact ? 12 : 13, color: C.ink }}
      >
        {project.name}
      </span>
    </span>
  );
}

/* --- Coche ---------------------------------------------------------------- */

/**
 * La coche ronde du prototype.
 *
 * `aria-label` est obligatoire : le bouton n'a pas de texte, et sans lui un
 * lecteur d'écran annonce « bouton » sur chaque ligne de la liste.
 */
export function CheckCircle({
  done,
  onToggle,
  label,
  size = 19,
}: {
  done: boolean;
  onToggle: () => void;
  label: string;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={done}
      className="flex flex-none items-center justify-center transition-colors"
      style={{
        width: size,
        height: size,
        padding: 0,
        borderRadius: 99,
        border: `1.6px solid ${done ? "var(--color-p6)" : "rgba(16,16,16,.22)"}`,
        background: done ? "var(--color-p6)" : "transparent",
        color: done ? "#FFFFFF" : "transparent",
        fontSize: Math.round(size * 0.53),
        lineHeight: 1,
        cursor: "pointer",
      }}
    >
      ✓
    </button>
  );
}

/* --- Structures ----------------------------------------------------------- */

/** Une carte de surface — le fond blanc arrondi que le prototype répète. */
export function Card({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        background: C.surface,
        border: `1px solid ${C.hairline2}`,
        borderRadius: R.card,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Le vide d'une vue.
 *
 * « Rien ici » et « ça n'a pas chargé » se ressemblent trop pour partager un
 * message : `hint` sert à dire lequel des deux on regarde.
 */
export function EmptyView({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="text-[15px] font-bold tracking-[-0.01em]" style={{ color: C.inkMuted }}>
        {title}
      </span>
      {hint && (
        <span className="text-[13px] font-medium" style={{ color: C.inkFaint, maxWidth: 380 }}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** Le compteur mono du prototype, à côté d'un titre de section. */
export function Count({ n }: { n: number }) {
  return (
    <span className="font-mono tnum" style={{ fontSize: 11, color: C.inkFaint }}>
      {n}
    </span>
  );
}
