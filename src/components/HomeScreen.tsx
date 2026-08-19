"use client";

/**
 * HomeScreen — écran d'accueil du redesign Claude Design v1.
 *
 * Structure bento : en-tête (avatar + actions), titre, grille 2×2 de tuiles
 * de destination, puis la section « Aujourd'hui » avec la liste du jour.
 *
 * Les valeurs exactes du design (min-height, radius, gap, tailles d'icônes)
 * passent par `style={{}}` pour ne pas dépendre d'utilitaires arbitraires
 * fragiles. Les couleurs utilisent les variables CSS du design system.
 */

import { useMemo } from "react";
import { AccountAvatar } from "./AccountAvatar";
import { EmptyState } from "./EmptyState";
import { SkeletonList } from "./Skeleton";
import { VoiceBadge } from "./VoiceBadge";
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  HelpIcon,
  IdeaIcon,
  StarIcon,
  TaskCheckIcon,
} from "./icons";
import { skinFor, shapeFor } from "@/lib/projects";
import { TIMEZONE, zonedParts } from "@/lib/zoned";
import type { Item, Overview, Project } from "@/lib/types";

interface HomeScreenProps {
  items: Item[];
  projects: Project[];
  overview: Overview | null;
  loading: boolean;
  onToggleDone: (id: string) => void;
  onOpenTask: (id: string) => void;
  onOpenAgenda: () => void;
  onOpenIdeas: () => void;
  onOpenAccount: () => void;
  onCapture: () => void;
  onAskAI: () => void;
  onScrollToTasks: () => void;
}

/* ------------------------------------------------------------------ *
 * Couleurs du design system — références aux variables CSS.
 * ------------------------------------------------------------------ */

const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  task100: "var(--color-task-100)",
  meet100: "var(--color-meet-100)",
  idea100: "var(--color-idea-100)",
  danger: "var(--color-danger)",
  hairline: "rgba(16,16,16,.06)",
  hairline18: "rgba(16,16,16,.18)",
} as const;

/* ------------------------------------------------------------------ *
 * Tuile de destination — cercle d'icône blanc en haut, label + sous-titre
 * en bas, le tout en flex-col justify-between.
 * ------------------------------------------------------------------ */

function DestinationTile({
  bg,
  icon,
  label,
  subtitle,
  textDark,
  onClick,
}: {
  bg: string;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  /** true pour la tuile IA (fond ink, texte blanc). */
  textDark?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="flex flex-col justify-between text-left"
      style={{
        background: bg,
        borderRadius: 24,
        minHeight: 132,
        padding: 16,
        border: "none",
        cursor: onClick ? "pointer" : "default",
        fontFamily: "inherit",
      }}
    >
      {/* Cercle d'icône blanc 44px */}
      <span
        className="flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: 99,
          background: C.surface,
          color: C.ink,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>

      {/* Label + sous-titre */}
      <span className="flex flex-col gap-[2px]">
        <span
          className="font-bold tracking-[-0.02em]"
          style={{ fontSize: 17, lineHeight: 1.2, color: textDark ? "#fff" : C.ink }}
        >
          {label}
        </span>
        <span
          className="font-medium"
          style={{
            fontSize: 13,
            lineHeight: 1.3,
            color: textDark ? "rgba(255,255,255,.6)" : C.inkMuted,
          }}
        >
          {subtitle}
        </span>
      </span>
    </Tag>
  );
}

/* ------------------------------------------------------------------ *
 * Bouton d'action de l'en-tête (aide, notifications) — 40px, icône centrée.
 * ------------------------------------------------------------------ */

function HeaderIconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative flex items-center justify-center"
      style={{
        width: 44,
        height: 44,
        borderRadius: 99,
        border: "1px solid rgba(16,16,16,.08)",
        background: C.surface,
        color: C.ink,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Case à cocher ronde — 26px, bordure 2px ink/18%. Affiche la coche si fait.
 * ------------------------------------------------------------------ */

function RowCheckbox({
  done,
  onClick,
}: {
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={done ? "Marquer non fait" : "Marquer fait"}
      className="flex shrink-0 items-center justify-center"
      style={{
        width: 26,
        height: 26,
        borderRadius: 99,
        border: `2px solid ${C.hairline18}`,
        background: C.surface,
        color: C.ink,
        cursor: "pointer",
        padding: 0,
      }}
    >
      {done && <CheckIcon size={13} />}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Une ligne de la liste « Aujourd'hui ».
 * ------------------------------------------------------------------ */

function TodayRow({
  item,
  project,
  onToggle,
  onOpen,
}: {
  item: Item;
  project: Project | undefined;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const done = !!item.doneAt;
  const skin = project ? skinFor(project) : null;
  const shape = project ? shapeFor(project) : "disc";

  // Heure formatée depuis l'échéance (fuseau Europe/Paris).
  const time = useMemo(() => {
    if (!item.due) return "";
    const d = new Date(item.due);
    if (Number.isNaN(d.getTime())) return "";
    if (item.allDay) return "journée";
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TIMEZONE,
    }).format(d);
  }, [item.due, item.allDay]);

  const isVocal = !!item.audioOrigin;

  return (
    <button
      onClick={() => onOpen(item.id)}
      className="flex w-full items-center gap-3 text-left"
      style={{ padding: "12px 14px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}
    >
      <RowCheckbox done={done} onClick={() => onToggle(item.id)} />

      {/* Titre + métadonnées */}
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span
          className="font-semibold tracking-[-0.01em]"
          style={{
            fontSize: 15,
            lineHeight: 1.3,
            color: done ? C.inkFaint : C.ink,
            textDecoration: done ? "line-through" : "none",
          }}
        >
          {item.title}
        </span>

        {/* Métadonnées : pastille projet + libellé + badge vocal */}
        <span className="flex items-center gap-[6px]">
          {skin && (
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: shape === "square" ? 1 : 99,
                background: skin.bg,
                flexShrink: 0,
              }}
            />
          )}
          {project && (
            <span
              className="font-medium"
              style={{ fontSize: 13, lineHeight: 1, color: C.inkMuted }}
            >
              {project.name}
            </span>
          )}
          {isVocal && <VoiceBadge size="small" />}
        </span>
      </span>

      {/* Heure */}
      {time && (
        <span
          className="shrink-0 font-bold tnum"
          style={{ fontSize: 13, lineHeight: 1, color: done ? C.inkFaint : C.ink }}
        >
          {time}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Composant principal.
 * ------------------------------------------------------------------ */

export function HomeScreen({
  items,
  projects,
  overview,
  loading,
  onToggleDone,
  onOpenTask,
  onOpenAgenda,
  onOpenIdeas,
  onOpenAccount,
  onCapture,
  onAskAI,
  onScrollToTasks,
}: HomeScreenProps) {
  // Date du jour formatée « mar. 19 août » dans le fuseau Europe/Paris.
  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "long",
      timeZone: TIMEZONE,
    }).format(new Date());
  }, []);

  // Items du jour : ce dont l'échéance tombe aujourd'hui dans le fuseau Paris.
  const todayItems = useMemo(() => {
    const nowParts = zonedParts(new Date());
    return items.filter((it) => {
      if (it.status === "idea" || it.status === "archived") return false;
      if (!it.due) return false;
      const parts = zonedParts(new Date(it.due));
      return parts.y === nowParts.y && parts.m === nowParts.m && parts.d === nowParts.d;
    });
  }, [items]);

  // Comptages pour les tuiles : aujourd'hui pour tâches et RDV, total pour idées.
  const counts = useMemo(() => {
    let tasks = 0;
    let events = 0;
    let ideas = 0;
    const nowParts = zonedParts(new Date());
    for (const it of items) {
      if (it.status === "idea") {
        ideas++;
        continue;
      }
      if (it.status === "archived") continue;
      if (it.kind === "event") events++;
      else tasks++;
    }
    // Pour les tuiles, on compte "aujourd'hui"
    const todayTasks = todayItems.filter((it) => it.kind === "task").length;
    const todayEvents = todayItems.filter((it) => it.kind === "event").length;
    return { tasks: todayTasks, events: todayEvents, ideas };
  }, [items, todayItems]);

  // Index des projets par id.
  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-y-auto" style={{ background: C.bg }}>
      {/* --- En-tête ------------------------------------------------- */}
      <div className="safe-top flex items-center justify-between px-5">
        <AccountAvatar
          initials="AM"
          size={46}
          bg={C.task100}
          color="var(--color-task-700)"
          onClick={onOpenAccount}
        />
        <div className="flex items-center gap-1">
          <HeaderIconButton label="Aide" onClick={undefined}>
            <HelpIcon size={17} />
          </HeaderIconButton>
          <HeaderIconButton label="Notifications" onClick={undefined}>
            <BellIcon size={19} />
            {/* Point rouge de notification */}
            <span
              className="absolute"
              style={{
                top: 8,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: 99,
                background: C.danger,
                border: `2px solid ${C.bg}`,
              }}
            />
          </HeaderIconButton>
        </div>
      </div>

      {/* --- Titre --------------------------------------------------- */}
      <div className="flex flex-col px-5" style={{ gap: 0, paddingTop: 6, paddingBottom: 20 }}>
        <h1
          className="font-extrabold tracking-[-0.03em]"
          style={{ fontSize: 34, lineHeight: 1.1, color: C.ink }}
        >
          Salut Aramis,
        </h1>
        <h2
          className="font-extrabold tracking-[-0.03em]"
          style={{ fontSize: 34, lineHeight: 1.1, color: C.inkFaint }}
        >
          Qu&apos;est-ce qu&apos;on organise?
        </h2>
      </div>

      {/* --- Grille de tuiles 2×2 ----------------------------------- */}
      <div
        className="grid px-5"
        style={{
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          paddingBottom: 24,
        }}
      >
        <DestinationTile
          bg={C.task100}
          icon={<TaskCheckIcon size={20} />}
          label="Tâches"
          subtitle={`${counts.tasks} aujourd'hui`}
          onClick={onScrollToTasks}
        />
        <DestinationTile
          bg={C.meet100}
          icon={<CalendarIcon size={20} />}
          label="Rendez-vous"
          subtitle={`${counts.events} · Calendrier Apple`}
          onClick={onOpenAgenda}
        />
        <DestinationTile
          bg={C.idea100}
          icon={<IdeaIcon size={20} />}
          label="Idées"
          subtitle={`${counts.ideas} à trier`}
          onClick={onOpenIdeas}
        />
        <DestinationTile
          bg={C.ink}
          icon={<StarIcon size={20} />}
          label="Demander à l'IA"
          subtitle="Assistant"
          textDark
          onClick={onAskAI}
        />
      </div>

      {/* --- Section « Aujourd'hui » --------------------------------- */}
      <div className="flex flex-col px-5" style={{ gap: 14, paddingBottom: 32 }}>
        {/* En-tête de section */}
        <div className="flex items-baseline justify-between">
          <span
            className="font-bold tracking-[-0.02em]"
            style={{ fontSize: 20, lineHeight: 1, color: C.ink }}
          >
            Aujourd&apos;hui
          </span>
          <span
            className="font-semibold"
            style={{ fontSize: 13, lineHeight: 1, color: C.inkMuted }}
          >
            {todayLabel}
          </span>
        </div>

        {/* Contenu : loading → skeleton, empty → EmptyState, sinon liste */}
        {loading ? (
          <SkeletonList count={3} />
        ) : todayItems.length === 0 ? (
          <EmptyState
            icon={<IdeaIcon size={22} />}
            title="Journée libre"
            description="Rien de prévu aujourd'hui. Profite-en, ou capture une idée pour plus tard."
            actionLabel="Capturer une idée"
            onAction={onCapture}
          />
        ) : (
          <div
            className="overflow-hidden"
            style={{
              background: C.surface,
              borderRadius: 20,
              padding: "6px 4px",
              border: `1px solid ${C.hairline}`,
            }}
          >
            {todayItems.map((item, i) => (
              <div key={item.id}>
                <TodayRow
                  item={item}
                  project={projectMap.get(item.projectId)}
                  onToggle={onToggleDone}
                  onOpen={onOpenTask}
                />
                {i < todayItems.length - 1 && (
                  <div style={{ height: 1, background: C.hairline, margin: "0 14px" }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}