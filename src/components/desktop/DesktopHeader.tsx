"use client";

/**
 * Bandeau desktop — marque, nav horizontale, ⌘K, cloche, avatar, Dicter.
 * Prolonge les tokens du design system v1 (voir `DESIGN.md` à la racine) ;
 * ne réinvente aucune couleur, aucun rayon.
 */

import { AccountAvatar } from "../AccountAvatar";
import { BellIcon, MicIcon, SearchIcon } from "../icons";
import type { DesktopScreen } from "./types";

const C = {
  ink: "var(--color-ink)",
  surface: "var(--color-surface)",
  bg: "var(--color-bg)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  danger: "var(--color-danger)",
  task100: "var(--color-task-100)",
  task700: "var(--color-task-700)",
} as const;

/**
 * Les onglets de la nav.
 *
 * « Réglages » n'y est plus (décision Aramis du 2026-08-30) : on y va par
 * l'AVATAR, à droite du bandeau. La nav ne garde que les écrans de travail —
 * huit onglets dont un « Réglages » qu'on ouvre trois fois par mois, c'est
 * sept onglets qui rétrécissent pour rien.
 */
const NAV_ITEMS: { screen: DesktopScreen; label: string }[] = [
  { screen: "dashboard", label: "Dashboard" },
  { screen: "calendrier", label: "Calendrier" },
  { screen: "tâches", label: "Tâches & RDV" },
  { screen: "kanban", label: "Kanban" },
  { screen: "objectifs", label: "Objectifs" },
  { screen: "graphe", label: "Graphe" },
  { screen: "idées", label: "Idées" },
];

export function DesktopHeader({
  screen,
  badges,
  onNavigate,
  onOpenPalette,
  onOpenNotifications,
  onOpenAccount,
  onCapture,
}: {
  screen: DesktopScreen;
  /** Badge numérique par écran (RDV de la semaine, tâches ouvertes, idées…). 0/absent = pas de badge. */
  badges: Partial<Record<DesktopScreen, number>>;
  onNavigate: (screen: DesktopScreen) => void;
  onOpenPalette: () => void;
  onOpenNotifications: () => void;
  onOpenAccount: () => void;
  onCapture: () => void;
}) {
  return (
    <header
      className="flex items-center gap-4.5"
      style={{
        padding: "12px 16px",
        background: C.surface,
        border: "1px solid rgba(16,16,16,.06)",
        borderRadius: 24,
        boxShadow: "0 6px 20px rgba(16,16,16,.07)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- icône PWA figée, pas une image de contenu */}
      <img src="/icon-192.png" alt="Brief" width={36} height={36} style={{ borderRadius: 10, flexShrink: 0 }} />

      <nav className="flex gap-[3px]" style={{ padding: 4, background: C.bg, borderRadius: 99 }}>
        {NAV_ITEMS.map((n) => {
          const on = n.screen === screen;
          const badge = badges[n.screen];
          return (
            <button
              key={n.screen}
              onClick={() => onNavigate(n.screen)}
              className="flex items-center gap-[7px]"
              style={{
                padding: "9px 17px",
                border: "none",
                borderRadius: 99,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                cursor: "pointer",
                background: on ? C.ink : "transparent",
                color: on ? "#FFFFFF" : C.inkMuted,
              }}
            >
              <span>{n.label}</span>
              {!!badge && (
                <span
                  className="tnum"
                  style={{
                    minWidth: 18,
                    padding: "2px 5px",
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 700,
                    textAlign: "center",
                    background: on ? "rgba(255,255,255,.16)" : C.surface,
                    color: on ? "#FFFFFF" : C.inkMuted,
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2.5"
          style={{
            height: 44,
            padding: "0 14px",
            background: C.bg,
            border: "1px solid rgba(16,16,16,.06)",
            borderRadius: 99,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <SearchIcon size={16} className="text-ink-muted" />
          <span className="text-[13px] font-semibold" style={{ color: C.inkMuted }}>Chercher</span>
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.06em",
              color: C.inkFaint,
              padding: "3px 6px",
              background: C.surface,
              borderRadius: 6,
              border: "1px solid rgba(16,16,16,.06)",
            }}
          >
            ⌘K
          </span>
        </button>

        <button
          aria-label="Notifications"
          onClick={onOpenNotifications}
          className="relative flex items-center justify-center"
          style={{ width: 44, height: 44, borderRadius: 99, border: "1px solid rgba(16,16,16,.08)", background: C.surface, cursor: "pointer" }}
        >
          <BellIcon size={19} className="text-ink" />
          <span
            className="absolute"
            style={{ top: 8, right: 9, width: 8, height: 8, borderRadius: 99, background: C.danger, border: `2px solid ${C.surface}` }}
          />
        </button>

        {/* L'avatar EST l'onglet Réglages depuis le 2026-08-30 : il en porte
            donc l'état actif, comme n'importe quel onglet de la nav. Sans cet
            anneau, on ouvre l'écran sans aucun repère de « où je suis ». */}
        <button
          aria-label="Compte et réglages"
          aria-current={screen === "réglages" ? "page" : undefined}
          onClick={onOpenAccount}
          className="flex items-center justify-center"
          style={{
            width: 44,
            height: 44,
            borderRadius: 99,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            boxShadow: screen === "réglages" ? `0 0 0 2px ${C.ink}` : "none",
            transition: "box-shadow .18s",
          }}
        >
          <AccountAvatar initials="AM" size={44} bg={C.task100} color={C.task700} />
        </button>

        <button
          onClick={onCapture}
          className="flex items-center gap-2.25"
          style={{
            height: 44,
            padding: "0 20px 0 17px",
            background: C.ink,
            color: "#FFFFFF",
            border: "none",
            borderRadius: 99,
            boxShadow: "0 12px 30px rgba(16,16,16,.26)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          <MicIcon size={16} className="text-white" />
          <span>Dicter</span>
        </button>
      </div>
    </header>
  );
}

export { NAV_ITEMS };
