"use client";

import { ChevronDownIcon } from "./icons";
import { LANGS, PROJECTS, projectById } from "@/lib/mock";

function Toggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      title={label}
      aria-label={label}
      className="relative h-[30px] w-[50px] flex-none cursor-pointer rounded-[15px] border-none transition-colors duration-200"
      style={{ background: on ? "#C0603C" : "#DAD5CF" }}
    >
      <span
        className="absolute top-[3px] left-[3px] h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200"
        style={{ transform: `translateX(${on ? 20 : 0}px)` }}
      />
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-1 mt-0 mb-[9px] text-[10.5px] font-semibold tracking-[1.1px] text-muted-2 uppercase">
      {children}
    </p>
  );
}

export function SettingsScreen({
  todoist,
  onToggleTodoist,
  defaultProject,
  onDefaultProject,
  lang,
  onLang,
  auto,
  onToggleAuto,
  onResetDemo,
}: {
  todoist: boolean;
  onToggleTodoist: () => void;
  defaultProject: string;
  onDefaultProject: (id: string) => void;
  lang: string;
  onLang: (code: string) => void;
  auto: boolean;
  onToggleAuto: () => void;
  onResetDemo: () => void;
}) {
  const langName = (LANGS.find((l) => l.code === lang) ?? LANGS[0]).name;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-[26px] pt-2.5 pb-2">
        <h1 className="m-0 text-[27px] font-semibold tracking-[-0.5px] text-ink">Réglages</h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-[22px] pt-2.5 pb-5">
        <div>
          <SectionLabel>Intégration</SectionLabel>
          <div className="overflow-hidden rounded-[20px] border border-[rgba(28,26,24,0.07)] bg-card">
            <div className="flex min-h-14 items-center gap-3 px-4 py-[15px]">
              <div className="flex-1">
                <p className="m-0 text-[15px] font-semibold text-ink">Todoist connecté</p>
                <p className="mt-0.5 mb-0 text-xs font-normal text-muted">
                  {todoist ? "Compte « paupy@brief.app » · 5 projets" : "Non connecté"}
                </p>
              </div>
              <Toggle on={todoist} onToggle={onToggleTodoist} label="Connexion Todoist" />
            </div>

            <div className="mx-4 h-px bg-[rgba(28,26,24,0.06)]" />

            <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-[15px]">
              <div className="flex-1">
                <p className="m-0 text-[15px] font-semibold text-ink">Projet par défaut</p>
                <p className="mt-0.5 mb-0 text-xs font-normal text-muted">
                  Si aucun projet n&apos;est détecté
                </p>
              </div>
              <span className="relative inline-flex h-[34px] items-center gap-1.5 rounded-xl bg-stone-1 pr-[26px] pl-3 text-[13px] font-semibold text-ink">
                {projectById(defaultProject).name}
                <ChevronDownIcon className="absolute right-2.5 opacity-50" />
                <select
                  value={defaultProject}
                  onChange={(e) => onDefaultProject(e.target.value)}
                  aria-label="Projet par défaut"
                  className="absolute inset-0 h-full w-full cursor-pointer border-none opacity-0"
                >
                  {PROJECTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </div>
        </div>

        <div>
          <SectionLabel>Dictée</SectionLabel>
          <div className="overflow-hidden rounded-[20px] border border-[rgba(28,26,24,0.07)] bg-card">
            <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-[15px]">
              <div className="flex-1">
                <p className="m-0 text-[15px] font-semibold text-ink">Langue</p>
                <p className="mt-0.5 mb-0 text-xs font-normal text-muted">Reconnaissance vocale</p>
              </div>
              <span className="relative inline-flex h-[34px] items-center gap-1.5 rounded-xl bg-stone-1 pr-[26px] pl-3 text-[13px] font-semibold text-ink">
                {langName}
                <ChevronDownIcon className="absolute right-2.5 opacity-50" />
                <select
                  value={lang}
                  onChange={(e) => onLang(e.target.value)}
                  aria-label="Langue de dictée"
                  className="absolute inset-0 h-full w-full cursor-pointer border-none opacity-0"
                >
                  {LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <div className="mx-4 h-px bg-[rgba(28,26,24,0.06)]" />

            <div className="flex min-h-14 items-center gap-3 px-4 py-[15px]">
              <div className="flex-1">
                <p className="m-0 text-[15px] font-semibold text-ink">Structurer automatiquement</p>
                <p className="mt-0.5 mb-0 text-xs font-normal text-muted">
                  Passe en revue dès la fin de la dictée
                </p>
              </div>
              <Toggle on={auto} onToggle={onToggleAuto} label="Structuration automatique" />
            </div>
          </div>
        </div>

        <div>
          <SectionLabel>Données</SectionLabel>
          <button
            type="button"
            onClick={onResetDemo}
            className="min-h-14 w-full cursor-pointer rounded-[20px] border border-[rgba(28,26,24,0.07)] bg-card px-4 py-[15px] text-left transition-all duration-200 hover:border-[rgba(192,96,60,0.35)]"
          >
            <p className="m-0 text-[15px] font-semibold text-accent">Réinitialiser la démo</p>
            <p className="mt-0.5 mb-0 text-xs font-normal text-muted">
              Restaure les tâches d&apos;exemple
            </p>
          </button>
        </div>

        <p className="mx-1 my-0 text-[11px] text-faint">
          Brief · prototype · parsing local (remplaçable par un LLM)
        </p>
      </div>
    </div>
  );
}
