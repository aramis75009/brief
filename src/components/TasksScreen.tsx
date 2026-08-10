"use client";

import { ProjectDot } from "./icons";
import { formatDue } from "@/lib/due";
import { PRIORITIES, shapeFor, skinFor } from "@/lib/projects";
import type { Project, Item } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "Tout" },
  { key: "task", label: "Tâches" },
  { key: "event", label: "Rendez-vous" },
] as const;

export type FilterKey = (typeof FILTERS)[number]["key"];

export function TasksScreen({
  sent,
  pending,
  projects,
  filter,
  onFilter,
  onOpen,
}: {
  sent: Item[];
  /** Dictées encore en file locale — visibles, mais jamais dites enregistrées. */
  pending: Item[];
  projects: Project[];
  filter: FilterKey;
  onFilter: (f: FilterKey) => void;
  onOpen: (id: string) => void;
}) {
  // Les items en attente passent devant : ce sont les seuls qui peuvent encore
  // être perdus, donc les seuls qui demandent une action.
  const all = [...pending, ...sent];
  const visible = all.filter((t) => (filter === "all" ? true : t.kind === filter));

  const groups = projects
    .map((p) => {
      const items = visible.filter((t) => t.projectId === p.id);
      return items.length ? { project: p, items } : null;
    })
    .filter((g): g is { project: Project; items: Item[] } => g !== null);

  // Tâches dont le projet n'est plus dans la liste — jamais masquées.
  const known = new Set(projects.map((p) => p.id));
  const orphans = visible.filter((t) => !known.has(t.projectId));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-[26px] pt-2.5 pb-3">
        <h1 className="mt-0 mb-3 text-27 font-semibold tracking-[-0.5px] text-ink">Tâches</h1>

        {/* Bandeau persistant : il ne disparaît qu'à l'envoi CONFIRMÉ par le
            serveur. C'est la seule chose qui sépare une note dictée d'une note
            perdue — Safari peut évincer le stockage local sans prévenir. Pas de
            couleur sémantique ici : « en attente » n'est pas un jugement, c'est
            une absence, et le pointillé la dit sans ajouter un 4ᵉ rouge. */}
        {pending.length > 0 && (
          <div
            className="mb-3 rounded-row px-3.5 py-2.5"
            style={{ border: "1.5px dashed var(--color-ink-3)" }}
            role="status"
          >
            <p className="m-0 text-13 leading-[1.45] font-semibold text-ink">
              {pending.length} note{pending.length > 1 ? "s" : ""} en attente d&apos;envoi
            </p>
            <p className="mt-1 mb-0 text-11 leading-[1.45] font-normal text-ink-2">
              Pas encore enregistrée{pending.length > 1 ? "s" : ""} sur le serveur. Ça repart à la
              prochaine ouverture avec du réseau.
            </p>
          </div>
        )}

        <div className="flex gap-1 rounded-field bg-page p-1">
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilter(f.key)}
                aria-pressed={on}
                className="h-9 flex-1 cursor-pointer rounded-chip border-none text-13 font-semibold transition-all duration-200"
                style={{
                  background: on ? "var(--color-tile)" : "transparent",
                  color: on ? "var(--color-ink)" : "var(--color-ink-3)",
                  boxShadow: on ? "var(--e1)" : "none",
                }}
              >
                {f.label}
                
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-1 pb-[18px]">
        {[...groups, ...(orphans.length ? [{ project: { id: "?", name: "Autre" }, items: orphans }] : [])].map(
          ({ project, items }) => {
            const skin = skinFor(project);
            return (
              <div key={project.id} className="mb-5">
                <div className="mx-1 mt-0 mb-[9px] flex items-center gap-2">
                  <span
                    className="inline-flex h-6 items-center gap-2 rounded-chip px-[9px] text-11 font-semibold"
                    style={{ background: skin.bg, color: skin.fg }}
                  >
                    <ProjectDot shape={shapeFor(project)} />
                    {project.name}
                  </span>
                  <span className="text-11 font-medium text-ink-3">
                    {items.length} {items.length > 1 ? "items" : "item"}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((t) => {
                    const done = !!t.doneAt;
                    const isEvent = t.kind === "event";
                    const waiting = !!t.pendingAt;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => !waiting && onOpen(t.id)}
                        disabled={waiting}
                        className={
                          "w-full rounded-row px-[15px] py-[13px] text-left transition-all duration-200 " +
                          (waiting
                            ? "cursor-default"
                            : "cursor-pointer border bg-tile shadow-[var(--e1)] hover:-translate-y-px")
                        }
                        // Trois signaux cumulés, dont deux survivent au
                        // daltonisme ET au mode sombre : contour pointillé,
                        // pas de surface, pas d'ombre. Un item en attente ne
                        // doit JAMAIS pouvoir se lire comme « enregistré ».
                        style={
                          waiting
                            ? { border: "1.5px dashed var(--color-ink-3)", background: "transparent" }
                            : { borderColor: "var(--line)" }
                        }
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="flex-1 text-15 leading-[1.4] font-medium text-pretty text-ink">
                            {t.title}
                          </span>
                          <span
                            className="mt-px flex-none text-11 font-semibold"
                            style={{
                              color: waiting
                                ? "var(--color-ink-2)"
                                : done
                                  ? "var(--color-ok)"
                                  : "var(--color-ink-3)",
                            }}
                          >
                            {waiting ? "en attente" : done ? "✓ fait" : isEvent ? "rendez-vous" : "tâche"}
                          </span>
                        </div>
                        <div className="mt-[7px] flex items-center gap-2">
                          <span className="text-11 font-medium text-ink-2">
                            {formatDue(t.due, t.allDay)}
                          </span>
                          <span className="h-[3px] w-[3px] rounded-full bg-ink-3" />
                          <span
                            className="text-11 font-semibold"
                            style={{
                              color: PRIORITIES[t.priority].fg === "var(--color-ink)" ? "var(--color-ink-3)" : PRIORITIES[t.priority].fg,
                            }}
                          >
                            {PRIORITIES[t.priority].label}
                          </span>
                        </div>
                        {t.rrule && (
                          <p className="mt-2 mb-0 text-11 leading-[1.4] text-ink-3">
                            se répète
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          },
        )}

        {!visible.length && (
          <div className="px-5 py-16 text-center">
            <p className="m-0 text-13 leading-[1.5] font-medium text-ink-3">
              {all.length ? "Rien dans ce filtre." : "Aucun item enregistré pour l'instant."}
              <br />
              {!all.length && "Dicte une note pour commencer."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
