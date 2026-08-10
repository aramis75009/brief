"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ProjectDot } from "./icons";
import { PRIORITIES, shapeFor } from "@/lib/projects";
import type { Overview, OverviewDay, OverviewProject, OverviewStack } from "@/lib/types";

/**
 * Vision globale — la charge inter-projets.
 *
 * C'est le seul écran qui justifie d'ouvrir Brief après avoir dicté. Les listes
 * de tâches, Brief y compris, savent toutes montrer des tâches ; aucune ne
 * montre CE QUI DÉBORDE. Les deux représentations répondent à deux questions
 * différentes, et aucune ne rend l'autre inutile :
 *
 *   Charge  → « où ça coince » : un comparateur entre projets.
 *   Horizon → « quand ça va me tomber dessus » : un mur qu'on voit arriver.
 *
 * Charge est le mode par défaut : la question du matin est « qu'est-ce que je
 * laisse tomber », pas « quel jour ».
 */

type Mode = "load" | "horizon";

/**
 * Le mode vit en localStorage et NON dans l'URL : une PWA installée se rouvre
 * toujours sur sa page d'accueil, une URL ne survivrait donc pas à la fermeture.
 */
const MODE_KEY = "brief:overview-mode";

/**
 * Le mode est une source EXTERNE (localStorage), pas un état React : le lire
 * dans un effet déclencherait un rendu en cascade, et le lire pendant le rendu
 * casserait l'hydratation. `useSyncExternalStore` est fait pour ce cas exact.
 */
const modeListeners = new Set<() => void>();
let modeCache: Mode | null = null;

function readMode(): Mode {
  if (modeCache !== null) return modeCache;
  try {
    modeCache = window.localStorage.getItem(MODE_KEY) === "horizon" ? "horizon" : "load";
  } catch {
    modeCache = "load";
  }
  return modeCache;
}

function subscribeMode(onChange: () => void): () => void {
  modeListeners.add(onChange);
  return () => {
    modeListeners.delete(onChange);
  };
}

/** Rendu serveur : « Charge » par défaut. La question du matin est « où ça coince ». */
function serverMode(): Mode {
  return "load";
}

function writeMode(m: Mode): void {
  modeCache = m;
  try {
    window.localStorage.setItem(MODE_KEY, m);
  } catch {
    /* stockage refusé : le mode ne survivra pas, l'écran fonctionne quand même */
  }
  for (const l of modeListeners) l();
}

/** Hauteur du graphe d'horizon, en px. Les empilements s'y répartissent. */
const CHART_H = 180;

function longDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hourOf(iso: string | null, allDay: boolean): string | null {
  if (!iso || allDay) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d);
}

function tintVar(stack: { tint?: number }, ink = false): string {
  // Un projet sans teinte connue retombe sur la ligne neutre plutôt que sur une
  // teinte au hasard : une couleur inventée désignerait un projet inexistant.
  if (!stack.tint) return ink ? "var(--color-ink-3)" : "var(--line-2)";
  return ink ? `var(--color-p${stack.tint}-ink)` : `var(--color-p${stack.tint})`;
}

/* --- Charge par projet ----------------------------------------------------- */

/**
 * Une barre = un projet. Sa LONGUEUR est le volume, sa COMPOSITION l'urgence.
 * L'ordre de l'écran est déjà un jugement : le projet qui déborde remonte seul,
 * on n'a pas à lire les chiffres pour savoir par où commencer.
 */
function ProjectLoadBar({ project, maxTotal }: { project: OverviewProject; maxTotal: number }) {
  const pct = (n: number) => `${(n / Math.max(1, project.total)) * 100}%`;
  const rest = project.total - project.overdue - project.today - project.week;

  const label =
    project.overdue > 0
      ? { text: `${project.overdue} en retard`, color: "var(--color-error)" }
      : project.today > 0
        ? { text: `${project.today} aujourd'hui`, color: "var(--color-ink-3)" }
        : { text: `${project.total} ouvert${project.total > 1 ? "s" : ""}`, color: "var(--color-ink-3)" };

  return (
    <div>
      <div className="mb-[7px] flex items-center gap-2">
        <span className="flex-none" style={{ color: tintVar(project, true) }}>
          <ProjectDot shape={shapeFor(project)} />
        </span>
        <span className="text-15 font-semibold tracking-[-0.2px]">{project.name}</span>
        <span
          className="tnum ml-auto text-13 font-medium"
          style={{ color: label.color }}
        >
          {label.text}
        </span>
      </div>
      <div
        className="flex h-3.5 gap-0.5"
        style={{ width: `${(project.total / Math.max(1, maxTotal)) * 100}%` }}
      >
        {project.overdue > 0 && (
          <span
            className="block rounded-full"
            style={{ width: pct(project.overdue), background: "var(--color-error)" }}
          />
        )}
        {project.today > 0 && (
          <span
            className="block rounded-full"
            style={{ width: pct(project.today), background: "var(--color-ink)" }}
          />
        )}
        {project.week > 0 && (
          <span
            className="block rounded-full"
            style={{ width: pct(project.week), background: tintVar(project) }}
          />
        )}
        {rest > 0 && <span className="block flex-1 rounded-full" style={{ background: "var(--line)" }} />}
      </div>
    </div>
  );
}

/* --- Horizon 7 jours ------------------------------------------------------- */

function Stack({ stacks, unit }: { stacks: OverviewStack[]; unit: number }) {
  if (!stacks.length) {
    // Un jour vide reste un jour : le trait dit « rien ici », l'absence totale
    // ferait croire à une colonne manquante.
    return <span className="block rounded-full" style={{ height: 3, background: "var(--line-2)" }} />;
  }
  return (
    <>
      {stacks.map((s) => (
        <span
          key={s.projectId}
          className="block rounded-md"
          title={`${s.name} · ${s.count}`}
          style={{ height: Math.max(12, Math.round(s.count * unit)), background: tintVar(s) }}
        />
      ))}
    </>
  );
}

function HorizonChart({
  horizon,
  overdueStacks,
}: {
  horizon: OverviewDay[];
  overdueStacks: OverviewStack[];
}) {
  const overdueTotal = overdueStacks.reduce((n, s) => n + s.count, 0);
  const maxTotal = Math.max(1, overdueTotal, ...horizon.map((d) => d.total));
  const unit = CHART_H / maxTotal;

  return (
    <div className="flex h-[212px] items-end gap-2.5">
      {/* Le retard est une colonne À PART, avant le trait : il n'appartient à
          aucun jour, il pèse sur tous. L'agréger dans « aujourd'hui » ferait
          disparaître la seule information qui demande une décision. */}
      <div className="flex flex-none flex-col items-center gap-2">
        <div
          className="flex w-[34px] flex-col-reverse justify-start gap-0.5 overflow-hidden"
          style={{ height: CHART_H }}
        >
          {overdueStacks.length ? (
            overdueStacks.map((s, i) => (
              <span
                key={s.projectId}
                className="block rounded-md"
                title={`${s.name} · ${s.count}`}
                style={{
                  height: Math.max(12, Math.round(s.count * unit)),
                  background: "var(--color-error)",
                  // Le retard garde UNE couleur : ce qui compte est le volume,
                  // pas de quel projet il vient. L'opacité sépare les strates
                  // sans introduire une seconde grille de lecture.
                  opacity: i === 0 ? 1 : Math.max(0.35, 0.85 - i * 0.25),
                }}
              />
            ))
          ) : (
            <span className="block rounded-full" style={{ height: 3, background: "var(--line-2)" }} />
          )}
        </div>
        <span
          className="text-11 font-semibold"
          style={{ color: overdueTotal ? "var(--color-error)" : "var(--color-ink-3)" }}
        >
          retard
        </span>
      </div>

      <span className="block h-[190px] w-px flex-none" style={{ background: "var(--line-2)" }} />

      <div className="flex h-[212px] flex-1 items-end gap-1.5">
        {horizon.map((day) => (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
            <div
              className="flex w-full flex-col-reverse justify-start gap-0.5 overflow-hidden"
              style={{ height: CHART_H }}
            >
              <Stack stacks={day.stacks} unit={unit} />
            </div>
            <span
              className="text-11"
              style={{
                fontWeight: day.isToday || day.total ? 600 : 500,
                color: day.isToday
                  ? "var(--color-action)"
                  : day.total
                    ? "var(--color-ink)"
                    : "var(--color-ink-3)",
              }}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --- Écran ----------------------------------------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-1 mt-4 mb-3 flex items-center gap-2">
      <span className="text-11 font-semibold tracking-[1.2px] text-ink-3 uppercase">{children}</span>
      <span className="h-px flex-1" style={{ background: "var(--line)" }} />
    </div>
  );
}

export function OverviewScreen({
  overview,
  loading,
  error,
  onRetry,
}: {
  overview: Overview | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const mode = useSyncExternalStore(subscribeMode, readMode, serverMode);
  const pick = useCallback((m: Mode) => writeMode(m), []);

  const header = (subtitle: string) => (
    <div className="flex-none px-[26px] pt-2.5 pb-2">
      <h1 className="m-0 text-27 font-semibold tracking-[-0.7px]">Vision</h1>
      <p className="mt-1 mb-0 text-13 font-normal text-ink-2">{subtitle}</p>
    </div>
  );

  if (loading && !overview) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header("Calcul de la charge…")}
        <div className="flex flex-1 items-center justify-center">
          <span className="animate-br-spin block h-6 w-6 rounded-full border-2 border-[var(--line-2)] border-t-action" />
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header("Charge indisponible")}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="m-0 text-15 leading-[1.5] font-medium text-ink-2">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="h-11 cursor-pointer rounded-full bg-action px-5 text-15 font-semibold text-white"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  const { totals, byProject, activity, horizon, overdueStacks, peak } = overview;

  if (!totals.open) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header(longDate(overview.generatedAt))}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-10 text-center">
          <p className="m-0 text-21 font-semibold tracking-[-0.3px]">Rien ne déborde.</p>
          <p className="m-0 text-15 leading-[1.5] font-normal text-ink-2">
            Aucun item ouvert. Cet écran se remplira à la première dictée.
          </p>
        </div>
      </div>
    );
  }

  // Tri par PRESSION, pas par volume : un projet avec trois retards passe devant
  // un projet avec dix tâches lointaines.
  const sorted = [...byProject].sort(
    (a, b) => b.overdue - a.overdue || b.today - a.today || b.total - a.total,
  );
  const maxTotal = Math.max(1, ...sorted.map((p) => p.total));
  const topOverdue = sorted.find((p) => p.overdue > 0);
  const maxActivity = Math.max(1, ...activity);

  const headline =
    totals.overdue > 0 && topOverdue
      ? `${topOverdue.name} déborde — ${topOverdue.overdue} des ${totals.overdue} retards viennent de là.`
      : totals.today > 0
        ? `Rien en retard. ${totals.today} item${totals.today > 1 ? "s" : ""} pour aujourd'hui.`
        : "Rien en retard, rien pour aujourd'hui.";

  const subtitle =
    mode === "load"
      ? `${longDate(overview.generatedAt)} · ${totals.open} item${totals.open > 1 ? "s" : ""} ouvert${totals.open > 1 ? "s" : ""}`
      : `Sept jours devant · ${horizon.reduce((n, d) => n + d.total, 0)} item${horizon.reduce((n, d) => n + d.total, 0) > 1 ? "s" : ""} daté${horizon.reduce((n, d) => n + d.total, 0) > 1 ? "s" : ""}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header(subtitle)}

      {/* Le seul segmenté de l'app qui ne filtre pas une liste mais change de
          REPRÉSENTATION. C'est assumé : les deux réponses viennent du même
          appel, et aucune ne rend l'autre inutile. */}
      <div className="flex-none px-[22px] pb-1">
        <div
          className="flex gap-1 rounded-chip p-1"
          role="tablist"
          aria-label="Représentation de la charge"
          style={{ background: "var(--line)" }}
        >
          {([
            ["load", "Charge"],
            ["horizon", "Horizon"],
          ] as const).map(([key, label]) => {
            const on = mode === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => pick(key)}
                className="h-9 flex-1 cursor-pointer rounded-chip border-none text-13 font-semibold transition-all duration-200"
                style={{
                  background: on ? "var(--color-tile)" : "transparent",
                  color: on ? "var(--color-ink)" : "var(--color-ink-3)",
                  boxShadow: on ? "var(--e1)" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-2.5 pb-4">
        {mode === "load" ? (
          <>
            {/* Bloc inversé : c'est le seul de l'écran, donc le seul endroit où
                l'œil va en premier. Le nombre de retards mérite cette place. */}
            <div
              className="animate-br-in mb-3 rounded-tile px-[22px] pt-5 pb-[22px]"
              style={{ background: "var(--color-ink)", color: "var(--color-page)" }}
            >
              <div className="flex items-end gap-2.5">
                <span className="tnum text-56 leading-[0.9] font-semibold tracking-[-2.4px]">
                  {totals.overdue}
                </span>
                <span className="pb-1.5 text-15 leading-[1.3] font-medium opacity-70">
                  item{totals.overdue > 1 ? "s" : ""}
                  <br />
                  en retard
                </span>
                <span className="ml-auto pb-1.5 text-right">
                  <span className="tnum block text-21 font-semibold tracking-[-0.3px]">
                    {totals.today}
                  </span>
                  <span className="block text-11 font-medium opacity-70">aujourd&apos;hui</span>
                </span>
              </div>

              <p className="mt-3.5 mb-0 text-15 leading-[1.4] font-medium">{headline}</p>

              <div className="mt-[18px] flex h-11 items-end justify-between">
                {activity.map((n, i) => (
                  <i
                    key={i}
                    className="block w-[11px] flex-none rounded-full"
                    style={{
                      height: `${Math.max(6, (n / maxActivity) * 100)}%`,
                      background: i === activity.length - 1 ? "var(--color-action)" : "currentColor",
                      opacity: i === activity.length - 1 ? 1 : 0.22,
                    }}
                  />
                ))}
              </div>
              <p className="mt-[9px] mb-0 text-11 font-medium opacity-55">
                Dictées des 7 derniers jours
              </p>
            </div>

            <SectionLabel>Charge par projet</SectionLabel>

            <div className="flex flex-col gap-3.5">
              {sorted.map((p) => (
                <ProjectLoadBar key={p.id} project={p} maxTotal={maxTotal} />
              ))}
            </div>
          </>
        ) : (
          <>
            <HorizonChart horizon={horizon} overdueStacks={overdueStacks} />

            {peak && (
              <div
                className="animate-br-in mt-[18px] rounded-tile px-5 pt-[18px] pb-5"
                style={{ background: "var(--color-ink)", color: "var(--color-page)" }}
              >
                <p className="m-0 text-21 leading-[1.25] font-semibold tracking-[-0.3px]">
                  {longDate(peak.date)} est ton mur : {peak.total} item
                  {peak.total > 1 ? "s" : ""}
                  {peak.events > 0 &&
                    `, dont ${peak.events} rendez-vous`}
                  .
                </p>
                <p className="mt-[9px] mb-0 text-13 leading-[1.5] font-normal opacity-70">
                  {peak.projects} projet{peak.projects > 1 ? "s" : ""} le même jour.
                </p>
              </div>
            )}

            {peak && peak.items.length > 0 && (
              <>
                <SectionLabel>{longDate(peak.date)}</SectionLabel>
                <div className="flex flex-col gap-2">
                  {peak.items.map((it) => {
                    const p = byProject.find((x) => x.id === it.projectId);
                    const hour = hourOf(it.due, it.allDay);
                    return (
                      <div
                        key={it.id}
                        className="flex items-center gap-2.5 rounded-row border bg-tile px-3.5 py-[11px] shadow-[var(--e1)]"
                        style={{ borderColor: "var(--line)" }}
                      >
                        <span className="flex-none" style={{ color: tintVar(p ?? {}, true) }}>
                          <ProjectDot shape={shapeFor({ id: it.projectId, shape: p?.shape })} />
                        </span>
                        <span className="flex-1 text-15 font-medium">{it.title}</span>
                        {hour ? (
                          <span className="tnum text-11 font-medium text-ink-2">{hour}</span>
                        ) : (
                          <span
                            className="text-11 font-semibold"
                            style={{ color: PRIORITIES[it.priority].fg }}
                          >
                            {PRIORITIES[it.priority].label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
