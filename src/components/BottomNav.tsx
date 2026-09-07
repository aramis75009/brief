"use client";

import { HomeIcon, SearchIcon, TasksIcon, MicSmallIcon, OverviewIcon } from "./icons";

/**
 * BottomNav — navigation basse flottante.
 *
 * ⚠️ Le FAB n'est plus un « + » muet : c'est un bouton **Dicter** avec sa
 * pastille rouge, comme le prototype. Un « + » sur une app pilotée à la voix
 * dit « saisir au clavier », soit exactement l'inverse de ce qu'elle propose.
 *
 * Quatre destinations : Accueil · Mes tâches · Projets · Recherche. « Idées »
 * a quitté la barre au profit de « Mes tâches » — elle reste atteignable par
 * sa tuile de l'accueil, qui affiche déjà le nombre à trier ; ce n'est donc
 * pas une fonction perdue, seulement un raccourci déplacé.
 */

export type Screen = "home" | "task" | "agenda" | "ideas" | "search" | "mytasks" | "projects";

const TABS: { screen: Screen; label: string; icon: (on: boolean) => React.ReactNode }[] = [
  {
    screen: "home",
    label: "Accueil",
    icon: (on) => <HomeIcon size={20} className={on ? "text-ink" : "text-ink-faint"} />,
  },
  {
    screen: "mytasks",
    label: "Mes tâches",
    icon: (on) => <TasksIcon size={20} className={on ? "text-ink" : "text-ink-faint"} />,
  },
  {
    screen: "projects",
    label: "Projets",
    icon: (on) => <OverviewIcon size={20} className={on ? "text-ink" : "text-ink-faint"} />,
  },
  {
    screen: "search",
    label: "Rechercher",
    icon: (on) => <SearchIcon size={20} className={on ? "text-ink" : "text-ink-faint"} />,
  },
];

export function BottomNav({
  current,
  onNavigate,
  onCapture,
}: {
  current: Screen;
  onNavigate: (s: Screen) => void;
  onCapture: () => void;
}) {
  /**
   * Quel onglet s'allume pour l'écran courant.
   *
   * `task` (la fiche) n'a pas d'onglet à lui : elle s'ouvre depuis plusieurs
   * endroits, et allumer « Accueil » quand on y est arrivé par « Mes tâches »
   * mentirait sur l'endroit d'où l'on revient. On n'allume donc RIEN plutôt
   * que de deviner.
   */
  const activeOf = (s: Screen): Screen | null => {
    if (s === "agenda") return "home";
    if (s === "task") return null;
    if (s === "ideas") return null;
    return s;
  };
  const active = activeOf(current);

  return (
    <div className="flex flex-none justify-center px-4 pb-[30px] pt-3.5">
      <div className="relative flex items-center gap-1 rounded-full border border-ink/[.07] bg-surface p-1.5 shadow-nav">
        {TABS.map((t) => {
          const on = active === t.screen;
          return (
            <button
              key={t.screen}
              aria-label={t.label}
              aria-current={on ? "page" : undefined}
              onClick={() => onNavigate(t.screen)}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 48,
                height: 48,
                background: on ? "var(--color-bg)" : "transparent",
                transition: "background .15s",
              }}
            >
              {t.icon(on)}
            </button>
          );
        })}

        <button
          aria-label="Dicter une note"
          onClick={onCapture}
          className="flex items-center justify-center gap-1.5 rounded-full bg-ink text-white shadow-fab"
          style={{ height: 48, padding: "0 15px", transition: "background .15s" }}
        >
          <span
            aria-hidden="true"
            style={{ width: 7, height: 7, borderRadius: 99, background: "var(--color-danger)", flex: "none" }}
          />
          <MicSmallIcon size={14} className="text-white" />
          <span className="text-[13px] font-bold tracking-[-0.01em]">Dicter</span>
        </button>
      </div>
    </div>
  );
}
