"use client";

/**
 * Le tableau de bord d'une vue — KPI, barres par section, donut de statut,
 * courbe d'achèvement.
 *
 * À ne pas confondre avec l'écran **Accueil** (`DesktopDashboard`), qui garde
 * la première tuile et le donut « Avancement » de la v1 : celui-ci est la
 * SIXIÈME vue de « Mes tâches » et d'un projet, pas la page d'entrée.
 */

import { useMemo } from "react";
import { STATUS_LABEL, type TaskStatus } from "@/lib/status";
import { dashboardStats, donutGradient, type ItemGroup } from "@/lib/views";
import { agree, plural } from "@/lib/plural";
import { Card } from "../ui";
import { C } from "../tokens";
import type { Item } from "@/lib/types";

/**
 * Les couleurs du donut et de la légende.
 *
 * Volontairement les couleurs PLEINES (`--color-p6`, `--color-danger`…) et non
 * les pastels : sur une part de 12° un pastel est indiscernable du fond blanc.
 */
const STATUS_COLOR: Record<TaskStatus, string> = {
  ontrack: "var(--color-p6)",
  atrisk: "var(--color-p2)",
  late: "var(--color-danger)",
  done: "var(--color-ink)",
};

const BAR_COLORS = ["var(--color-ink)", "var(--color-task-700)", "var(--color-ink-muted)", "var(--color-ink-faint)"];

export function DashboardView({
  items,
  groups,
  now,
}: {
  items: Item[];
  groups: ItemGroup[];
  now: Date;
}) {
  const stats = useMemo(() => dashboardStats(items, groups, now), [items, groups, now]);

  const kpis = [
    { label: "Terminées", value: stats.done, hint: `sur ${plural(stats.total, "tâche")}`, color: C.ink },
    { label: "En retard", value: stats.late, hint: "à traiter en priorité", color: "var(--color-late-700)" },
    { label: "À risque", value: stats.atrisk, hint: "échéance serrée", color: "var(--color-idea-700)" },
    { label: "Total", value: stats.total, hint: "toutes sections", color: C.ink },
  ];

  const maxBar = Math.max(1, ...stats.byGroup.map((g) => g.count));
  const maxDay = Math.max(1, ...stats.completion);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        {kpis.map((k) => (
          <Card key={k.label} style={{ padding: "18px 20px" }}>
            <div className="text-[12px] font-bold" style={{ color: C.inkMuted }}>
              {k.label}
            </div>
            <div
              className="tnum font-extrabold tracking-[-0.04em]"
              style={{ fontSize: 42, lineHeight: 1.05, color: k.color, marginTop: 6 }}
            >
              {k.value}
            </div>
            <div className="text-[12px]" style={{ color: C.inkMuted, marginTop: 6 }}>
              {k.hint}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1fr)" }}>
        <Card style={{ padding: "18px 20px 20px" }}>
          <h3 className="m-0 text-[15px] font-extrabold" style={{ marginBottom: 20 }}>
            Tâches par section
          </h3>
          {stats.byGroup.length === 0 ? (
            <p className="text-[13px]" style={{ color: C.inkFaint }}>
              Aucune section à comparer.
            </p>
          ) : (
            <div className="flex items-end gap-5.5" style={{ height: 190, padding: "0 6px" }}>
              {stats.byGroup.map((g, i) => (
                <div key={g.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2.25">
                  <span className="tnum text-[13px] font-extrabold">{g.count}</span>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 76,
                      // Un minimum de 6 px : une barre à zéro doit rester
                      // visible comme colonne, sinon la section disparaît du
                      // graphique et on croit qu'elle n'existe pas.
                      height: `${Math.max(6, (g.count / maxBar) * 100)}%`,
                      borderRadius: "10px 10px 4px 4px",
                      background: BAR_COLORS[i % BAR_COLORS.length],
                    }}
                  />
                  <span className="truncate text-[11px] font-semibold" style={{ color: C.inkMuted, maxWidth: "100%" }}>
                    {g.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card style={{ padding: "18px 20px" }}>
          <h3 className="m-0 text-[15px] font-extrabold" style={{ marginBottom: 18 }}>
            Répartition par statut
          </h3>
          <div className="flex items-center gap-5.5">
            <div
              className="relative flex-none"
              style={{
                width: 132,
                height: 132,
                borderRadius: 99,
                background: donutGradient(stats.donut, (s) => STATUS_COLOR[s], "var(--color-bg)"),
              }}
            >
              <div
                className="absolute flex flex-col items-center justify-center"
                style={{ inset: 26, borderRadius: 99, background: C.surface }}
              >
                <span className="tnum text-[22px] font-extrabold tracking-[-0.03em]">{stats.total}</span>
                <span className="text-[10px] font-semibold" style={{ color: C.inkMuted }}>
                  tâches
                </span>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2.75">
              {stats.donut.map((d) => (
                <div key={d.status} className="flex items-center gap-2.25">
                  <span
                    className="flex-none"
                    style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_COLOR[d.status] }}
                  />
                  <span className="truncate text-[13px] font-semibold">{STATUS_LABEL[d.status]}</span>
                  <span className="tnum ml-auto text-[13px] font-extrabold">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card style={{ padding: "18px 20px 22px" }}>
        <div className="flex items-center gap-2.5" style={{ marginBottom: 16 }}>
          <h3 className="m-0 text-[15px] font-extrabold">Achèvement au fil du temps</h3>
          <span className="ml-auto text-[12px]" style={{ color: C.inkMuted }}>
            14 derniers jours
          </span>
        </div>
        <CompletionChart series={stats.completion} max={maxDay} />
      </Card>
    </div>
  );
}

/**
 * La courbe d'achèvement, en SVG inline.
 *
 * `preserveAspectRatio="none"` étire le tracé sur toute la largeur : le
 * viewBox est donc un repère abstrait, pas des pixels. C'est voulu — la carte
 * change de largeur avec la fenêtre et la courbe doit la suivre.
 */
function CompletionChart({ series, max }: { series: number[]; max: number }) {
  const total = series.reduce((n, v) => n + v, 0);
  const W = 720;
  const H = 180;
  const PAD = 10;

  if (series.length < 2) return null;

  const points = series.map((v, i) => {
    const x = PAD + (i / (series.length - 1)) * (W - PAD * 2);
    const y = H - PAD - (v / max) * (H - PAD * 3);
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W - PAD} ${H - PAD} L${PAD} ${H - PAD} Z`;

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 180, display: "block" }} aria-hidden="true">
        <path d={area} fill="rgba(31,79,168,.09)" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-task-700)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          // `vector-effect` garde l'épaisseur constante malgré l'étirement du
          // viewBox — sans lui le trait s'épaissit avec la largeur de la carte.
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="text-[12px]" style={{ color: C.inkMuted, marginTop: 8 }}>
        {`${plural(total, "tâche")} ${agree(total, "terminée")} sur la période.`}
      </p>
    </>
  );
}
