"use client";

/**
 * Portefeuilles — des groupes de projets, et les OBJECTIFS qui s'y rattachent.
 *
 * La fusion vient d'Aramis (« l'onglet Objectif, qu'on peut peut-être intégrer
 * directement dans le portefeuille ») et elle tombe juste : un objectif porte
 * déjà un `projectId`, un portefeuille groupe des projets — la chaîne
 * portefeuille → projets → objectifs existe sans rien inventer.
 *
 * Un portefeuille ne possède rien. Il n'agrège que des projets, dont il tire
 * sa santé et sa progression : supprimer un projet le retire du groupe sans
 * qu'aucun compteur ne soit à corriger.
 */

import { useMemo, useState } from "react";
import { shapeFor, skinFor } from "@/lib/projects";
import { HEALTH_LABEL, healthOf, progressPct, type PortfolioHealth } from "@/lib/status";
import { objectiveEffectiveProgress } from "@/lib/objectives";
import { ProjectDot } from "@/components/icons";
import { Card, Count, EmptyView } from "./ui";
import { C, R, PASTEL } from "./tokens";
import type { Item, Objective, ObjectiveHorizon, Portfolio, Project } from "@/lib/types";

const HEALTH_PASTEL: Record<PortfolioHealth, { bg: string; fg: string }> = {
  ontrack: PASTEL.meet,
  atrisk: PASTEL.idea,
  late: PASTEL.late,
};

export function PortfoliosScreen({
  portfolios,
  projects,
  items,
  objectives,
  now,
  onOpenProject,
  onCreatePortfolio,
  onRenamePortfolio,
  onSetProjects,
  onDeletePortfolio,
  onAchieveObjective,
  onReopenObjective,
  onCreateObjective,
  onDeleteObjective,
}: {
  portfolios: Portfolio[];
  projects: Project[];
  items: Item[];
  objectives: Objective[];
  now: Date;
  onOpenProject: (id: string) => void;
  onCreatePortfolio: (name: string) => void;
  onRenamePortfolio: (id: string, name: string) => void;
  onSetProjects: (id: string, projectIds: string[]) => void;
  onDeletePortfolio: (id: string) => void;
  onAchieveObjective: (id: string) => void;
  onReopenObjective: (id: string) => void;
  onCreateObjective: (title: string, projectId: string, horizon: ObjectiveHorizon) => void;
  onDeleteObjective: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);

  /** Les tâches actives d'un projet — jamais les idées ni les archivées. */
  const tasksOf = (projectId: string) =>
    items.filter((it) => it.projectId === projectId && it.status !== "idea" && it.status !== "archived");

  /**
   * Les projets qui n'appartiennent à AUCUN portefeuille.
   *
   * Ils sont montrés à part plutôt que cachés : un projet invisible parce
   * qu'on a oublié de le ranger est exactement le genre de perte silencieuse
   * que cet écran doit éviter.
   */
  const unassigned = useMemo(() => {
    const claimed = new Set(portfolios.flatMap((p) => p.projectIds));
    return activeProjects.filter((p) => !claimed.has(p.id));
  }, [portfolios, activeProjects]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <NewPortfolio onCreate={onCreatePortfolio} />
      </div>

      {portfolios.length === 0 && (
        <EmptyView
          title="Aucun portefeuille"
          hint="Un portefeuille groupe plusieurs projets pour en lire la santé d'un coup d'œil — « Revente », « Formation », « Perso »."
        />
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))" }}>
        {portfolios.map((pf) => {
          const members = pf.projectIds
            .map((id) => projectById.get(id))
            .filter((p): p is Project => !!p && !p.archived);
          const allTasks = members.flatMap((p) => tasksOf(p.id));
          const health = healthOf(allTasks, now, byId);
          const pct = progressPct(allTasks);
          const pfObjectives = objectives.filter((o) => pf.projectIds.includes(o.projectId));

          return (
            <Card key={pf.id} style={{ padding: "18px 20px" }} className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2.5">
                {editing === pf.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => {
                      const name = draftName.trim();
                      if (name && name !== pf.name) onRenamePortfolio(pf.id, name);
                      setEditing(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      // Échap ANNULE : sans lui, la seule sortie est le flou,
                      // qui enregistre — on ne peut pas se raviser.
                      if (e.key === "Escape") {
                        setDraftName(pf.name);
                        setEditing(null);
                      }
                    }}
                    className="min-w-0 flex-1 text-[15px] font-extrabold"
                    style={{ border: `1px solid ${C.hairline2}`, borderRadius: R.sm, padding: "4px 8px", fontFamily: "inherit", background: C.bg }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(pf.id);
                      setDraftName(pf.name);
                    }}
                    className="m-0 truncate text-left text-[15px] font-extrabold"
                    style={{ border: "none", background: "none", padding: 0, fontFamily: "inherit", cursor: "text" }}
                    title="Renommer"
                  >
                    {pf.name}
                  </button>
                )}
                <span
                  className="ml-auto flex-none font-bold"
                  style={{ padding: "4px 10px", borderRadius: R.chip, fontSize: 11, background: HEALTH_PASTEL[health].bg, color: HEALTH_PASTEL[health].fg }}
                >
                  {HEALTH_LABEL[health]}
                </span>
                <button
                  type="button"
                  aria-label={`Supprimer le portefeuille ${pf.name}`}
                  onClick={() => onDeletePortfolio(pf.id)}
                  style={{ border: "none", background: "none", color: C.inkFaint, cursor: "pointer", fontSize: 14 }}
                >
                  ✕
                </button>
              </div>

              {members.length === 0 ? (
                <p className="text-[13px]" style={{ color: C.inkFaint }}>
                  Aucun projet dans ce portefeuille.
                </p>
              ) : (
                <div className="flex flex-col gap-2.25">
                  {members.map((p) => {
                    const tasks = tasksOf(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onOpenProject(p.id)}
                        className="flex items-center gap-2.25 text-left hover:opacity-75"
                        style={{ border: "none", background: "none", padding: 0, fontFamily: "inherit", cursor: "pointer" }}
                      >
                        <span className="flex-none" style={{ color: skinFor(p).bg }}>
                          <ProjectDot size={8} shape={shapeFor(p)} />
                        </span>
                        <span className="truncate text-[13px]">{p.name}</span>
                        <span className="tnum ml-auto flex-none text-[12px] font-bold" style={{ color: C.inkMuted }}>
                          {progressPct(tasks)} %
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ height: 6, borderRadius: 99, background: C.bg, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: C.ink, borderRadius: 99 }} />
              </div>

              <ProjectPicker
                projects={activeProjects}
                selected={pf.projectIds}
                onChange={(ids) => onSetProjects(pf.id, ids)}
              />

              {members.length > 0 && (
                <div className="flex flex-col gap-2" style={{ borderTop: `1px solid ${C.hairline}`, paddingTop: 12 }}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase" style={{ fontSize: 10, letterSpacing: "0.08em", color: C.inkFaint }}>
                      Objectifs
                    </span>
                    <Count n={pfObjectives.length} />
                  </div>
                  {pfObjectives.map((o) => {
                    const prog = objectiveEffectiveProgress(o, items, objectives);
                    return (
                      <div key={o.id} className="flex items-center gap-2.5">
                        <span
                          className="flex-none"
                          style={{ width: 8, height: 8, borderRadius: 2, background: o.achievedAt ? "var(--color-p6)" : "var(--color-idea-100)" }}
                        />
                        <span
                          className="truncate text-[13px] font-semibold"
                          style={{ color: o.achievedAt ? C.inkFaint : C.ink, textDecoration: o.achievedAt ? "line-through" : "none" }}
                        >
                          {o.title}
                        </span>
                        <span className="tnum ml-auto flex-none text-[12px]" style={{ color: C.inkMuted }}>
                          {prog.done}/{prog.total}
                        </span>
                        <button
                          type="button"
                          onClick={() => (o.achievedAt ? onReopenObjective(o.id) : onAchieveObjective(o.id))}
                          className="flex-none text-[11px] font-bold"
                          style={{ border: "none", background: "none", color: C.inkMuted, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          {o.achievedAt ? "Rouvrir" : "Atteint"}
                        </button>
                        <button
                          type="button"
                          aria-label={`Supprimer l'objectif ${o.title}`}
                          onClick={() => onDeleteObjective(o.id)}
                          className="flex-none"
                          style={{ border: "none", background: "none", color: C.inkFaint, cursor: "pointer", fontSize: 13 }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  <NewObjective members={members} onCreate={onCreateObjective} />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: "0.08em", color: C.inkFaint }}>
              Projets sans portefeuille
            </span>
            <Count n={unassigned.length} />
          </div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenProject(p.id)}
                className="flex items-center gap-2 font-semibold"
                style={{
                  height: 32,
                  padding: "0 13px",
                  borderRadius: R.chip,
                  border: `1px solid ${C.hairline2}`,
                  background: C.surface,
                  fontFamily: "inherit",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <span style={{ color: skinFor(p).bg }}>
                  <ProjectDot size={8} shape={shapeFor(p)} />
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Sous-composants ------------------------------------------------------ */

function NewPortfolio({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName("");
  };
  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Nouveau portefeuille…"
        className="text-[13px]"
        style={{
          height: 34,
          width: 240,
          padding: "0 13px",
          borderRadius: R.chip,
          border: `1px solid ${C.hairline2}`,
          background: C.surface,
          fontFamily: "inherit",
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!name.trim()}
        className="font-bold"
        style={{
          height: 34,
          padding: "0 15px",
          borderRadius: R.chip,
          border: "none",
          background: C.ink,
          color: "#FFFFFF",
          fontFamily: "inherit",
          fontSize: 13,
          cursor: name.trim() ? "pointer" : "not-allowed",
          opacity: name.trim() ? 1 : 0.45,
        }}
      >
        Créer
      </button>
    </div>
  );
}

/**
 * Créer un objectif depuis le portefeuille.
 *
 * L'objectif se rattache à un PROJET, pas au portefeuille : c'est
 * `Objective.projectId` qui existe, et le portefeuille n'est qu'un groupe de
 * projets. Le sélecteur est donc obligatoire — sans lui, il faudrait deviner
 * lequel des projets du groupe porte l'objectif.
 */
function NewObjective({
  members,
  onCreate,
}: {
  members: Project[];
  onCreate: (title: string, projectId: string, horizon: ObjectiveHorizon) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(members[0]?.id ?? "");
  const [horizon, setHorizon] = useState<ObjectiveHorizon>("moyen");

  const target = members.some((m) => m.id === projectId) ? projectId : members[0]?.id;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-[12px] font-bold"
        style={{ border: "none", background: "none", padding: 0, color: C.inkMuted, cursor: "pointer", fontFamily: "inherit" }}
      >
        + Ajouter un objectif
      </button>
    );
  }

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed || !target) return;
    onCreate(trimmed, target, horizon);
    setTitle("");
    setOpen(false);
  };

  const field = {
    height: 30,
    borderRadius: 8,
    border: `1px solid ${C.hairline2}`,
    background: C.bg,
    padding: "0 9px",
    fontFamily: "inherit",
    fontSize: 12,
  } as const;

  return (
    <div className="flex flex-wrap items-center gap-1.5" style={{ marginTop: 4 }}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Objectif…"
        style={{ ...field, flex: "1 1 140px", minWidth: 120 }}
      />
      <select value={target} onChange={(e) => setProjectId(e.target.value)} style={field} aria-label="Projet">
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <select
        value={horizon}
        onChange={(e) => setHorizon(e.target.value as ObjectiveHorizon)}
        style={field}
        aria-label="Horizon"
      >
        <option value="court">Court terme</option>
        <option value="moyen">Moyen terme</option>
        <option value="long">Long terme</option>
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={!title.trim() || !target}
        className="font-bold"
        style={{
          height: 30,
          padding: "0 12px",
          borderRadius: 999,
          border: "none",
          background: C.ink,
          color: "#FFFFFF",
          fontFamily: "inherit",
          fontSize: 12,
          cursor: title.trim() && target ? "pointer" : "not-allowed",
          opacity: title.trim() && target ? 1 : 0.45,
        }}
      >
        Créer
      </button>
    </div>
  );
}

/** Les cases à cocher qui composent un portefeuille. */
function ProjectPicker({
  projects,
  selected,
  onChange,
}: {
  projects: Project[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const set = new Set(selected);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-[12px] font-bold"
        style={{ border: "none", background: "none", padding: 0, color: C.inkMuted, cursor: "pointer", fontFamily: "inherit" }}
      >
        {open ? "Fermer" : "Choisir les projets"}
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
          {projects.map((p) => {
            const on = set.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  onChange(on ? selected.filter((id) => id !== p.id) : [...selected, p.id])
                }
                aria-pressed={on}
                className="flex items-center gap-1.75 font-semibold"
                style={{
                  height: 28,
                  padding: "0 11px",
                  borderRadius: R.chip,
                  border: `1px solid ${on ? C.ink : C.hairline2}`,
                  background: on ? C.ink : C.surface,
                  color: on ? "#FFFFFF" : C.ink,
                  fontFamily: "inherit",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
