"use client";

import { HomeIcon, SearchIcon, PlusIcon, IdeaIcon } from "./icons";

/**
 * BottomNav — navigation basse flottante.
 * Container pill blanc + ombre nav, 4 entrées + FAB central saillant.
 * Accueil · Recherche · FAB(+) · Idées
 */

export type Screen = "home" | "task" | "agenda" | "ideas" | "search";

export function BottomNav({
  current,
  onNavigate,
  onCapture,
}: {
  current: Screen;
  onNavigate: (s: Screen) => void;
  onCapture: () => void;
}) {
  const isHome = current === "home" || current === "task" || current === "agenda";
  const isSearch = current === "search";
  const isIdeas = current === "ideas";

  return (
    <div className="flex flex-none justify-center px-5 pb-[30px] pt-3.5">
      <div className="relative flex items-center gap-1.5 rounded-full border border-ink/[.07] bg-surface p-1.5 shadow-nav">
        {/* Accueil */}
        <button
          aria-label="Accueil"
          onClick={() => onNavigate("home")}
          className="flex items-center justify-center rounded-full"
          style={{ width: 52, height: 48, background: isHome ? "#F4F4F2" : "transparent", transition: "background .15s" }}
        >
          <HomeIcon size={20} className={isHome ? "text-ink" : "text-ink-faint"} />
        </button>

        {/* Recherche */}
        <button
          aria-label="Rechercher"
          onClick={() => onNavigate("search")}
          className="flex items-center justify-center rounded-full"
          style={{ width: 52, height: 48, background: isSearch ? "#F4F4F2" : "transparent", transition: "background .15s" }}
        >
          <SearchIcon size={20} className={isSearch ? "text-ink" : "text-ink-faint"} />
        </button>

        {/* FAB + */}
        <button
          aria-label="Ajouter"
          onClick={onCapture}
          className="relative flex items-center justify-center rounded-full bg-ink text-white shadow-fab"
          style={{ width: 60, height: 60, marginTop: -14, transition: "background .15s" }}
        >
          <PlusIcon size={22} />
        </button>

        {/* Idées */}
        <button
          aria-label="Idées"
          onClick={() => onNavigate("ideas")}
          className="flex items-center justify-center rounded-full"
          style={{ width: 52, height: 48, background: isIdeas ? "#F4F4F2" : "transparent", transition: "background .15s" }}
        >
          <IdeaIcon size={20} className={isIdeas ? "text-ink" : "text-ink-faint"} />
        </button>
      </div>
    </div>
  );
}