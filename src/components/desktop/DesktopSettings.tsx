"use client";

/**
 * Écran Réglages desktop — cartes de destination (couleur + forme + charge
 * réelle depuis `overview.byProject`) et chaîne. Les bascules Calendrier/
 * Digest/PIN sont décoratives, comme sur `AccountSheet` mobile (aucune des
 * deux versions ne les câble à un vrai réglage serveur) ; seule « Rappels
 * push » agit réellement, sur le même chemin que `NotificationsSheet`.
 */

import { useState } from "react";
import { skinFor, shapeFor } from "@/lib/projects";
import type { Overview, Project } from "@/lib/types";

const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
} as const;

function ToggleRow({ label, desc, on, onClick }: { label: string; desc: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3.5" style={{ padding: "12px 0", borderBottom: "1px solid rgba(16,16,16,.06)" }}>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-bold tracking-[-0.01em]">{label}</span>
        <span className="text-[11px] font-medium" style={{ color: C.inkMuted }}>{desc}</span>
      </span>
      {/* Un seul élément interactif — un `<button>` enveloppant sans taille
          propre s'effondre à 0×0 au lieu d'hériter de son contenu. */}
      <button
        onClick={onClick}
        aria-label="Basculer"
        className="relative flex-none"
        style={{ width: 48, height: 28, borderRadius: 99, border: "none", padding: 0, cursor: "pointer", background: on ? C.ink : "#EDEDEA", transition: "background .22s" }}
      >
        <span
          className="absolute"
          style={{ top: 3, width: 22, height: 22, borderRadius: 99, background: "#fff", boxShadow: "0 2px 6px rgba(16,16,16,.2)", transition: "left .22s cubic-bezier(.4,0,.2,1)", left: on ? 23 : 3 }}
        />
      </button>
    </div>
  );
}

const SWATCHES = ["#F4F4F2", "#101010", "#CFE0FF", "#CBE9D6", "#FBE2AE", "#E23A2E"];
const RADII = [8, 12, 18, 20, 24];

export function DesktopSettings({
  projects,
  overview,
  calendarSyncLabel,
  pushSubscribed,
  onEnablePush,
}: {
  projects: Project[];
  overview: Overview | null;
  calendarSyncLabel: string;
  pushSubscribed: boolean;
  onEnablePush: () => void;
}) {
  const [caldavOn, setCaldavOn] = useState(true);
  const [digestOn, setDigestOn] = useState(true);
  const [pinOn, setPinOn] = useState(true);
  const byProject = new Map((overview?.byProject ?? []).map((p) => [p.id, p]));

  return (
    <div className="grid h-full gap-3" style={{ gridTemplateColumns: "1fr 1fr", animation: "fade .3s both" }}>
      <div className="flex h-full min-h-0 flex-col gap-3" style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)", overflow: "hidden" }}>
        <span className="flex-none font-extrabold tracking-[-0.03em]" style={{ fontSize: 20 }}>Destinations</span>
        <span className="flex-none text-[12px] font-medium" style={{ color: C.inkMuted, lineHeight: 1.4 }}>
          Une teinte désigne un projet, elle ne décore jamais. La forme prend le relais quand les teintes ne suffisent plus — elle se lit sans couleur.
        </span>
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
        {projects.map((p) => {
          const skin = skinFor(p);
          const shape = shapeFor(p);
          const stats = byProject.get(p.id);
          return (
            <div key={p.id} className="flex flex-col gap-2.5" style={{ padding: 16, background: C.bg, borderRadius: 20 }}>
              <div className="flex items-center gap-2.75">
                <span style={{ width: 12, height: 12, flex: "none", borderRadius: shape === "square" ? 3 : 99, background: skin.bg }} />
                <span className="text-[15px] font-bold tracking-[-0.02em]">{p.name}</span>
                <span className="ml-auto font-mono" style={{ fontSize: 10, letterSpacing: "0.06em", color: C.inkMuted }}>
                  {stats ? `${stats.total} ouverts · ${stats.overdue} en retard` : "aucun item ouvert"}
                </span>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
        <div className="flex flex-none flex-col gap-1" style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)" }}>
          <span className="text-[17px] font-bold tracking-[-0.02em]" style={{ marginBottom: 6 }}>Chaîne</span>
          <ToggleRow label="Calendrier Apple (CalDAV)" desc={`Source de vérité des RDV — ${calendarSyncLabel}.`} on={caldavOn} onClick={() => setCaldavOn((v) => !v)} />
          <ToggleRow label="Digest Telegram" desc="Récap du matin à 08:30 via n8n." on={digestOn} onClick={() => setDigestOn((v) => !v)} />
          <ToggleRow label="Rappels push" desc="Web Push sur iPhone et desktop." on={pushSubscribed} onClick={onEnablePush} />
          <ToggleRow label="Verrou PIN" desc="Code à l’ouverture, mémorisé par appareil." on={pinOn} onClick={() => setPinOn((v) => !v)} />
        </div>

        <div className="flex flex-none flex-col gap-2.5" style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)" }}>
          <span className="text-[17px] font-bold tracking-[-0.02em]">Jetons du design system</span>
          <div className="flex gap-2.5">
            {SWATCHES.map((hex) => (
              <div key={hex} className="flex flex-1 flex-col gap-1.75">
                <div style={{ height: 44, borderRadius: 12, border: "1px solid rgba(16,16,16,.06)", background: hex }} />
                <span className="font-mono" style={{ fontSize: 9, letterSpacing: "0.04em", color: C.inkMuted }}>{hex}</span>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-2.5">
            <span className="font-extrabold tracking-[-0.03em]" style={{ fontSize: 28, lineHeight: 1 }}>Aa</span>
            <span className="text-[12px] font-semibold" style={{ color: C.inkMuted }}>Plus Jakarta Sans · 400 → 800</span>
            <span className="ml-auto font-mono" style={{ fontSize: 12, color: C.inkMuted }}>JetBrains Mono</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {RADII.map((r) => (
              <span
                key={r}
                className="flex items-center justify-center font-mono"
                style={{ width: 52, height: 38, background: C.bg, border: "1px solid rgba(16,16,16,.06)", fontSize: 10, color: C.inkMuted, borderRadius: r }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
