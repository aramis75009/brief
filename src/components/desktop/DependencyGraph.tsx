"use client";

/**
 * Vue « Graphe » — les dépendances entre tâches, en nœuds reliés (style n8n).
 *
 * Design : prototype Claude Design « Graphe des dépendances ». Toute la
 * logique (statuts, filtres, colonnes, positions) vit dans `@/lib/graph` et
 * s'y teste sans DOM ; ce fichier ne fait que la dessiner et gérer pan / zoom /
 * glisser.
 *
 * ⚠️ **Pas de bibliothèque de graphe.** Le prototype décrit un pan/zoom par
 * `transform` CSS et des arêtes en courbes de Bézier SVG — une centaine de
 * lignes qu'on lit, contre une dépendance (`reactflow`) qu'il aurait fallu
 * reskinner entièrement pour retomber sur ce dessin. La passation du
 * 2026-08-24 prévoyait `reactflow` avant que le prototype n'existe ; il ne
 * porte plus son poids.
 *
 * ⚠️ **Trois statuts.** Voir l'en-tête de `@/lib/graph` et DECISIONS.md : le
 * modèle ne connaît que « à faire » et « fait », donc pas d'orange « bientôt ».
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon } from "../icons";
import {
  COMPACT,
  CONFORTABLE,
  boundingBox,
  graphEdges,
  graphStatus,
  graphTasks,
  indexById,
  layoutGraph,
  unlocks,
  visibleTasks,
  wouldCreateCycle,
  type GraphMetrics,
  type GraphStatus,
  type Point,
} from "@/lib/graph";
import { formatDue } from "@/lib/due";
import { shapeFor, skinFor } from "@/lib/projects";
import type { Item, Project, Shape, Tag } from "@/lib/types";

import { TAG_COLOR_MAP } from "@/lib/tagColors";
const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  danger: "var(--color-danger)",
} as const;

/** Même palette d'étiquettes que les cartes Kanban — les deux vues montrent les mêmes barres. */

const STATUS: Record<GraphStatus, { color: string; label: string }> = {
  ready: { color: "#34C759", label: "Prête à démarrer" },
  blocked: { color: "#E23A2E", label: "Bloquée" },
  // Pas de « terminée » dans la vue : les tâches faites n'y figurent plus.
  done: { color: "#A9A9A2", label: "Terminée" },
};

/** Largeur du panneau de détail — retirée de la place disponible au cadrage. */
const PANEL_W = 428;

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 1.8;

/* --- Pastille projet selon la forme — identique à KanbanCard --- */
function swatchStyle(skin: { bg: string } | null, shape: Shape, size = 10): React.CSSProperties {
  const bg = skin?.bg ?? "#A9A9A2";
  const base: React.CSSProperties = { width: size, height: size, flex: "none", borderRadius: "99px", background: bg, display: "inline-block" };
  if (shape === "square") return { ...base, borderRadius: "2px" };
  if (shape === "diamond") return { ...base, width: size - 1, height: size - 1, borderRadius: "2px", transform: "rotate(45deg)" };
  if (shape === "ring") return { ...base, background: "transparent", border: `2px solid ${bg}` };
  if (shape === "capsule") return { ...base, width: size + 4, height: size - 2 };
  return base;
}

function ResetIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Ce qu'un glisser en cours transporte — jamais dans le state, ça bougerait à 60 Hz. */
type Drag =
  | { type: "pan"; sx: number; sy: number; px: number; py: number; moved: boolean }
  | { type: "node"; id: string; sx: number; sy: number; nx: number; ny: number; moved: boolean };

/**
 * Tirage de lien en cours.
 *
 * `fromId` est la tâche À FAIRE D'ABORD (l'ancre d'où part le geste), `overId`
 * celle qui en dépendra. Le sens compte : c'est `overId.dependsOn` qui reçoit
 * `fromId`, comme une flèche qu'on lit « d'abord ceci, ensuite cela ».
 * `x`/`y` sont en coordonnées du monde, pas de l'écran.
 */
type LinkDrag = { fromId: string; x: number; y: number; overId: string | null };

export function DependencyGraph({
  items,
  projects,
  tags,
  onOpenTask,
  onAddDependency,
  density = "compact",
  showGrid = true,
  curve = 0.5,
}: {
  items: Item[];
  projects: Project[];
  tags: Tag[];
  /** Ouvre la vraie fiche tâche (double-clic sur un nœud, ou « Ouvrir la fiche »). */
  onOpenTask: (id: string) => void;
  /**
   * Crée « `itemId` dépend de `depId` ». Absent, les ancres de tirage ne
   * s'affichent pas : pas de poignée qui ne mène à rien.
   */
  onAddDependency?: (itemId: string, depId: string) => void;
  density?: "compact" | "confortable";
  showGrid?: boolean;
  /** Cambrure des arêtes, 0.2 (raide) → 0.9 (ample). */
  curve?: number;
}) {
  const [pan, setPan] = useState<Point>({ x: 40, y: 30 });
  const [zoom, setZoom] = useState(0.92);
  const [pinned, setPinned] = useState<Record<string, Point>>({});
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  /** Incrémenté pour demander un recadrage — un booléen ne redéclencherait pas deux fois. */
  const [fitToken, setFitToken] = useState(0);
  /** Lien en cours de tirage depuis l'ancre d'un nœud. `null` = aucun. */
  const [link, setLink] = useState<LinkDrag | null>(null);
  /** Motif d'un refus de lien, affiché puis effacé — jamais un échec muet. */
  const [linkRefusal, setLinkRefusal] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const metrics: GraphMetrics = density === "confortable" ? CONFORTABLE : COMPACT;

  const allTasks = useMemo(() => graphTasks(items), [items]);
  const allById = useMemo(() => indexById(allTasks), [allTasks]);
  const list = useMemo(
    () => visibleTasks(items, { projectFilter, blockedOnly }),
    [items, projectFilter, blockedOnly],
  );
  const pos = useMemo(() => layoutGraph(list, metrics, pinned), [list, metrics, pinned]);
  const edges = useMemo(() => graphEdges(list), [list]);
  const byId = useMemo(() => indexById(list), [list]);

  /* Les gestionnaires posés une seule fois (molette, glisser) et `fit` lisent
     l'état courant par référence — sinon ils captureraient le zoom et la
     disposition du premier rendu, et le glisser dériverait. Le miroir se met à
     jour après le rendu : écrire une ref pendant le rendu est interdit. */
  const zoomRef = useRef(zoom);
  const posRef = useRef(pos);
  const listRef = useRef(list);
  const metricsRef = useRef(metrics);
  const selectedRef = useRef(selectedId);
  const panRef = useRef(pan);
  const linkRef = useRef<LinkDrag | null>(null);
  const allTasksRef = useRef(allTasks);
  useEffect(() => {
    zoomRef.current = zoom;
    posRef.current = pos;
    listRef.current = list;
    metricsRef.current = metrics;
    selectedRef.current = selectedId;
    panRef.current = pan;
    linkRef.current = link;
    allTasksRef.current = allTasks;
  });

  const projectOf = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects],
  );

  /** Couleur d'identité d'un projet — sert au liseré des nœuds et au trait des arêtes. */
  const colorOf = useCallback(
    (projectId: string) => {
      const p = projectOf(projectId);
      return p ? skinFor(p).bg : "#A9A9A2";
    },
    [projectOf],
  );

  /* --- Cadrage --- */

  const fit = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const current = listRef.current;
    const box = boundingBox(current, posRef.current, metricsRef.current);
    if (!box) return;
    const r = el.getBoundingClientRect();
    const w = box.maxX - box.minX;
    const h = box.maxY - box.minY;
    // On réserve la place du panneau ouvert, des commandes de zoom et de la légende.
    const availW = r.width - (selectedRef.current ? PANEL_W : 0) - 96 - 190;
    const availH = r.height - 170;
    const z = Math.max(ZOOM_MIN, Math.min(1.15, Math.min(availW / w, availH / h)));
    setZoom(z);
    setPan({
      x: 44 - box.minX * z + Math.max(0, (availW - w * z) / 2),
      y: 64 - box.minY * z + Math.max(0, (availH - h * z) / 2),
    });
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => fit());
    return () => cancelAnimationFrame(id);
  }, [fitToken, fit]);

  const requestFit = useCallback(() => setFitToken((t) => t + 1), []);

  /** Zoom par pas, ancré au centre du canvas (les boutons + / −). */
  const zoomBy = useCallback((k: number) => {
    const el = canvasRef.current;
    setZoom((z) => {
      const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * k));
      if (el) {
        const r = el.getBoundingClientRect();
        const cx = r.width / 2;
        const cy = r.height / 2;
        setPan((p) => ({ x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) }));
      }
      return nz;
    });
  }, []);

  /* --- Glisser : le fond se déplace, un nœud se repositionne --- */

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      // 3 px de tolérance : un clic tremblé reste un clic, pas un glisser.
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      if (d.type === "pan") {
        setPan({ x: d.px + dx, y: d.py + dy });
      } else {
        const z = zoomRef.current;
        setPinned((prev) => ({ ...prev, [d.id]: { x: d.nx + dx / z, y: d.ny + dy / z } }));
      }
    };
    const onUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      // Un glisser ne sélectionne pas : seul un vrai clic ouvre le panneau.
      if (!d.moved) setSelectedId(d.type === "node" ? d.id : null);
      setGrabbing(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  /* --- Tirage de lien : créer une dépendance à la souris --- */

  /** Écran → monde : l'inverse exact de la transformation appliquée au calque. */
  const toWorld = useCallback((clientX: number, clientY: number): Point => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const z = zoomRef.current;
    const p = panRef.current;
    return { x: (clientX - r.left - p.x) / z, y: (clientY - r.top - p.y) / z };
  }, []);

  const startLink = useCallback(
    (fromId: string, e: React.MouseEvent) => {
      // Sans stopPropagation, le nœud partirait en déplacement sous l'ancre.
      e.stopPropagation();
      e.preventDefault();
      setLinkRefusal(null);
      const w = toWorld(e.clientX, e.clientY);
      setLink({ fromId, x: w.x, y: w.y, overId: null });
    },
    [toWorld],
  );

  /* Abonné une seule fois par tirage : `linking` est un booléen, pas l'objet —
     sinon chaque mouvement de souris réabonnerait les écouteurs. */
  const linking = link !== null;
  useEffect(() => {
    if (!linking) return;
    const onMove = (e: MouseEvent) => {
      const w = toWorld(e.clientX, e.clientY);
      const el = (e.target as HTMLElement | null)?.closest?.("[data-node-id]") as HTMLElement | null;
      const hovered = el?.dataset.nodeId ?? null;
      setLink((l) => (l ? { ...l, x: w.x, y: w.y, overId: hovered && hovered !== l.fromId ? hovered : null } : l));
    };
    const onUp = () => {
      const l = linkRef.current;
      setLink(null);
      if (!l || !l.overId || !onAddDependency) return;
      const dependentId = l.overId;
      const dependencyId = l.fromId;
      const all = allTasksRef.current;
      const dependent = all.find((t) => t.id === dependentId);
      if ((dependent?.dependsOn ?? []).includes(dependencyId)) {
        setLinkRefusal("Ce lien existe déjà.");
        return;
      }
      if (wouldCreateCycle(dependentId, dependencyId, all)) {
        setLinkRefusal("Refusé : les deux tâches s'attendraient l'une l'autre, et aucune ne serait jamais prête.");
        return;
      }
      onAddDependency(dependentId, dependencyId);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [linking, toWorld, onAddDependency]);

  /* Le refus s'efface de lui-même : un message d'erreur qui reste devient du décor. */
  useEffect(() => {
    if (!linkRefusal) return;
    const id = setTimeout(() => setLinkRefusal(null), 5000);
    return () => clearTimeout(id);
  }, [linkRefusal]);

  /* La molette doit pouvoir annuler le défilement de la page : `passive: false`
     est impossible à obtenir via onWheel de React, d'où l'écoute manuelle. */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      setZoom((z) => {
        const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * Math.exp(-e.deltaY * 0.0016)));
        // Zoom ancré au pointeur : le point sous le curseur ne bouge pas.
        setPan((p) => ({ x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) }));
        return nz;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onCanvasDown = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-node]") || t.closest("button")) return;
    dragRef.current = { type: "pan", sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: false };
    setGrabbing(true);
  };

  const onNodeDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const p = pos.get(id) ?? { x: 0, y: 0 };
    dragRef.current = { type: "node", id, sx: e.clientX, sy: e.clientY, nx: p.x, ny: p.y, moved: false };
  };

  /* --- Voisinage du nœud sélectionné : tout le reste s'estompe --- */

  const neighbours = useMemo(() => {
    const set = new Set<string>();
    if (!selectedId) return set;
    set.add(selectedId);
    edges.forEach(({ from, to }) => {
      if (from.id === selectedId) set.add(to.id);
      if (to.id === selectedId) set.add(from.id);
    });
    return set;
  }, [selectedId, edges]);

  const blockedCount = useMemo(
    () => allTasks.filter((t) => graphStatus(t, allById) === "blocked").length,
    [allTasks, allById],
  );

  /** Les projets qui ont au moins une tâche — inutile de proposer un filtre vide. */
  const chips = useMemo(() => {
    const used = new Set(allTasks.map((t) => t.projectId));
    return projects.filter((p) => used.has(p.id));
  }, [projects, allTasks]);

  const toggleProject = (id: string) => {
    setProjectFilter((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
    setSelectedId(null);
    requestFit();
  };

  const selected = selectedId ? byId.get(selectedId) ?? allById.get(selectedId) ?? null : null;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* --- Titre, compteur, filtres --- */}
      <div className="flex flex-none items-center gap-3" style={{ margin: "0 2px" }}>
        <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]" style={{ color: C.ink }}>
          Graphe
        </h1>
        <span className="tnum text-[13px] font-bold" style={{ color: C.inkFaint }}>
          {list.length} {list.length > 1 ? "tâches" : "tâche"} · {edges.length}{" "}
          {edges.length > 1 ? "dépendances" : "dépendance"}
        </span>

        <div className="flex flex-wrap gap-1.5" style={{ marginLeft: 4 }}>
          {chips.map((p) => {
            const on = projectFilter.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleProject(p.id)}
                aria-pressed={on}
                className="inline-flex flex-none items-center gap-[7px] whitespace-nowrap"
                style={{
                  height: 30,
                  padding: "0 12px",
                  borderRadius: 99,
                  border: `1px solid ${on ? C.ink : "rgba(16,16,16,.08)"}`,
                  background: on ? C.ink : C.surface,
                  color: on ? "#FFFFFF" : C.ink,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span style={swatchStyle(skinFor(p), shapeFor(p), 8)} />
                {p.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-none items-center gap-2">
          <button
            onClick={() => {
              setBlockedOnly((v) => !v);
              setSelectedId(null);
              requestFit();
            }}
            aria-pressed={blockedOnly}
            className="flex items-center gap-2 whitespace-nowrap"
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 99,
              border: `1px solid ${blockedOnly ? C.ink : "rgba(16,16,16,.12)"}`,
              background: blockedOnly ? C.ink : C.surface,
              color: blockedOnly ? "#FFFFFF" : C.ink,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <span style={{ width: 8, height: 8, flex: "none", borderRadius: 99, background: STATUS.blocked.color }} />
            Bloquées
            <span
              className="tnum text-center"
              style={{
                minWidth: 18,
                padding: "2px 5px",
                borderRadius: 99,
                fontSize: 10,
                fontWeight: 700,
                background: blockedOnly ? "rgba(255,255,255,.16)" : C.bg,
                color: blockedOnly ? "#FFFFFF" : C.inkMuted,
              }}
            >
              {blockedCount}
            </span>
          </button>

          <button
            onClick={() => {
              setPinned({});
              setProjectFilter([]);
              setBlockedOnly(false);
              setSelectedId(null);
              requestFit();
            }}
            aria-label="Réinitialiser la disposition"
            title="Réinitialiser la disposition"
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              flex: "none",
              borderRadius: 99,
              border: "1px solid rgba(16,16,16,.12)",
              background: C.surface,
              color: C.ink,
              cursor: "pointer",
            }}
          >
            <ResetIcon />
          </button>
        </div>
      </div>

      {/* --- Le canvas --- */}
      <div
        ref={canvasRef}
        onMouseDown={onCanvasDown}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{
          background: C.surface,
          border: "1px solid rgba(16,16,16,.06)",
          borderRadius: 20,
          cursor: grabbing ? "grabbing" : "grab",
        }}
      >
        <div
          className="absolute left-0 top-0"
          style={{ transformOrigin: "0 0", transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}
        >
          {showGrid && (
            <div
              className="absolute"
              style={{
                left: -1600,
                top: -1200,
                width: 6000,
                height: 4000,
                backgroundImage: "radial-gradient(rgba(16,16,16,.11) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
          )}

          <svg
            width={4200}
            height={2600}
            className="pointer-events-none absolute left-0 top-0"
            style={{ overflow: "visible" }}
          >
            {edges.map(({ from, to }) => {
              const a = pos.get(from.id);
              const b = pos.get(to.id);
              if (!a || !b) return null;
              const x1 = a.x + metrics.W;
              const y1 = a.y + metrics.H / 2;
              const x2 = b.x - 9;
              const y2 = b.y + metrics.H / 2;
              // Poignées de Bézier horizontales : les arêtes partent et arrivent à plat.
              const dx = Math.max(70, Math.abs(x2 - x1) * curve);
              const touches = !!selectedId && (from.id === selectedId || to.id === selectedId);
              /*
                Le trait dit l'état de la DÉPENDANCE, plus la couleur du projet
                (refonte 2026-08-25). Deux raisons :

                - La couleur de projet sur une arête décorait : DESIGN.md dit
                  qu'une teinte désigne. Le liseré du nœud porte déjà le projet.
                - L'ancien code testait `from.doneAt` pour choisir plein ou
                  pointillé, mais `graphTasks()` exclut les tâches terminées :
                  `from.doneAt` était donc TOUJOURS nul et le trait plein ne
                  pouvait jamais s'afficher. La légende annonçait une
                  distinction qui n'existait pas.

                Ce qui distingue vraiment deux arêtes entre tâches actives,
                c'est le statut de la source : « prête » = c'est le front, on
                peut s'y mettre maintenant ; « bloquée » = la chaîne continue
                derrière, ce lien attendra son tour.
              */
              const fromStatus = graphStatus(from, byId);
              const front = fromStatus === "ready";
              const color = fromStatus === "done" ? C.inkFaint : C.ink;
              const width = touches ? 2.6 : front ? 2 : 1.5;
              const baseOpacity = front ? 0.9 : 0.4;
              return (
                <g key={`${from.id}->${to.id}`} opacity={selectedId ? (touches ? 1 : 0.14) : baseOpacity}>
                  <path
                    d={`M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`}
                    fill="none"
                    // Plein = la source est prête, le lien est actionnable ;
                    // pointillé = la source attend encore quelqu'un.
                    strokeDasharray={front ? "0" : "5 5"}
                    strokeLinecap="round"
                    style={{ stroke: color, strokeWidth: width }}
                  />
                  <path
                    d={`M${x2 - 7},${y2 - 4.5} L${x2},${y2} L${x2 - 7},${y2 + 4.5}`}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ stroke: color, strokeWidth: width }}
                  />
                </g>
              );
            })}

            {/* Le lien en cours de tirage — il suit le curseur jusqu'au relâchement. */}
            {link && (() => {
              const a = pos.get(link.fromId);
              if (!a) return null;
              const x1 = a.x + metrics.W;
              const y1 = a.y + metrics.H / 2;
              const dx = Math.max(70, Math.abs(link.x - x1) * curve);
              return (
                <g>
                  <path
                    d={`M${x1},${y1} C${x1 + dx},${y1} ${link.x - dx},${link.y} ${link.x},${link.y}`}
                    fill="none"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    style={{ stroke: C.ink, strokeWidth: 2.4, opacity: link.overId ? 1 : 0.5 }}
                  />
                  <circle cx={link.x} cy={link.y} r={link.overId ? 5 : 3} style={{ fill: C.ink, opacity: link.overId ? 1 : 0.5 }} />
                </g>
              );
            })()}
          </svg>

          {list.map((t) => {
            const p = pos.get(t.id);
            if (!p) return null;
            const project = projectOf(t.projectId);
            const st = graphStatus(t, byId);
            const dim = !!selectedId && !neighbours.has(t.id);
            const subs = t.subtasks ?? [];
            const doneSubs = subs.filter((s) => s.done).length;
            const hasAudio = !!(t.audioOrigin || t.audioId);
            return (
              <div
                key={t.id}
                data-node="1"
                data-node-id={t.id}
                onMouseDown={(e) => onNodeDown(t.id, e)}
                onDoubleClick={() => onOpenTask(t.id)}
                title={t.title}
                className="absolute left-0 top-0 flex select-none flex-col"
                style={{
                  transform: `translate(${p.x}px,${p.y}px)`,
                  width: metrics.W,
                  height: metrics.H,
                  padding: "9px 11px",
                  gap: 7,
                  background: t.doneAt ? "#FBFBFA" : C.surface,
                  // Cible de dépôt pendant un tirage : l'encre annonce « ici ».
                  border: `1.5px solid ${link?.overId === t.id ? C.ink : selectedId === t.id ? C.ink : colorOf(t.projectId)}`,
                  borderRadius: 14,
                  boxShadow:
                    link?.overId === t.id
                      ? "0 0 0 3px rgba(16,16,16,.14)"
                      : selectedId === t.id
                        ? "0 6px 20px rgba(16,16,16,.16)"
                        : "0 2px 8px rgba(16,16,16,.04)",
                  opacity: dim && link?.overId !== t.id ? 0.34 : 1,
                  cursor: "grab",
                  transition: "opacity .18s, box-shadow .18s",
                }}
              >
                <span
                  className="absolute"
                  style={{ top: 9, right: 10, width: 8, height: 8, borderRadius: 99, background: STATUS[st].color }}
                />

                {/*
                  Ancre de tirage, sur le bord droit — le côté « ce qui vient
                  après ». On tire de A vers B pour dire « A d'abord, puis B ».
                  Toujours visible, comme les ports de React Flow : une poignée
                  qui n'apparaît qu'au survol ne s'apprend pas.
                */}
                {onAddDependency && (
                  <span
                    role="button"
                    aria-label={`Tirer un lien de dépendance depuis « ${t.title} »`}
                    onMouseDown={(e) => startLink(t.id, e)}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className="absolute"
                    style={{
                      right: -7,
                      top: metrics.H / 2 - 7,
                      width: 14,
                      height: 14,
                      borderRadius: 99,
                      background: C.ink,
                      border: "2.5px solid var(--color-surface)",
                      cursor: "crosshair",
                      opacity: link?.fromId === t.id ? 1 : 0.42,
                      transition: "opacity .15s, transform .15s",
                      transform: link?.fromId === t.id ? "scale(1.25)" : "none",
                    }}
                  />
                )}

                <div className="flex flex-wrap gap-1 overflow-hidden" style={{ height: 8 }}>
                  {(t.tags ?? []).slice(0, 4).map((tagId) => {
                    const tag = tags.find((x) => x.id === tagId);
                    if (!tag) return null;
                    return (
                      <span
                        key={tagId}
                        title={tag.name}
                        style={{ width: 28, height: 8, flex: "none", borderRadius: 99, background: TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.blue }}
                      />
                    );
                  })}
                </div>

                <span
                  className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold tracking-[-0.01em]"
                  style={{
                    lineHeight: 1.25,
                    paddingRight: 14,
                    color: C.ink,
                    textDecoration: "none",
                  }}
                >
                  {t.title}
                </span>

                <div className="flex items-center gap-2" style={{ marginTop: "auto" }}>
                  {project && <span style={swatchStyle(skinFor(project), shapeFor(project))} />}
                  <span
                    className="tnum whitespace-nowrap text-[11px] font-semibold"
                    style={{ color: st === "blocked" ? C.danger : C.inkMuted }}
                  >
                    {formatDue(t.due, t.allDay)}
                  </span>
                  {subs.length > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span style={{ width: 30, height: 4, borderRadius: 99, background: "rgba(16,16,16,.09)", overflow: "hidden" }}>
                        <span
                          style={{
                            display: "block",
                            height: "100%",
                            borderRadius: 99,
                            background: C.ink,
                            width: `${Math.round((doneSubs / subs.length) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="tnum text-[11px] font-semibold" style={{ color: C.inkMuted }}>
                        {doneSubs}/{subs.length}
                      </span>
                    </span>
                  )}
                  {hasAudio && (
                    <span title="Issue d'une dictée" className="inline-flex items-end" style={{ marginLeft: "auto", gap: 2, height: 12 }}>
                      <span style={{ width: 2, height: 5, borderRadius: 99, background: "#A9A9A2" }} />
                      <span style={{ width: 2, height: 10, borderRadius: 99, background: "#A9A9A2" }} />
                      <span style={{ width: 2, height: 7, borderRadius: 99, background: "#A9A9A2" }} />
                      <span style={{ width: 2, height: 12, borderRadius: 99, background: "#A9A9A2" }} />
                    </span>
                  )}
                </div>

                {st === "blocked" && !dim && (
                  <span
                    className="absolute inline-flex items-center"
                    style={{
                      bottom: -9,
                      left: 11,
                      height: 18,
                      padding: "0 8px",
                      borderRadius: 99,
                      background: C.ink,
                      color: "#FFFFFF",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    bloquée
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* --- Légende --- */}
        <div
          className="absolute flex items-center"
          style={{
            left: 16,
            bottom: 16,
            gap: 14,
            padding: "9px 14px",
            background: "rgba(255,255,255,.92)",
            border: "1px solid rgba(16,16,16,.06)",
            borderRadius: 99,
            boxShadow: "0 6px 20px rgba(16,16,16,.07)",
          }}
        >
          <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint }}>
            LÉGENDE
          </span>
          {(["ready", "blocked"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: C.ink }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: STATUS[k].color }} />
              {k === "ready" ? "prête" : "bloquée"}
            </span>
          ))}
          <span style={{ width: 1, height: 14, background: "rgba(16,16,16,.08)" }} />
          {/*
            La légende disait « levée » / « active ». « Levée » ne pouvait jamais
            s'afficher : une dépendance levée est une tâche terminée, et le
            graphe n'en montre aucune. Elle décrit maintenant ce que le trait
            distingue réellement.
          */}
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: C.ink }}>
            <span style={{ width: 18, height: 0, borderTop: "2px solid var(--color-ink)" }} />
            à faire maintenant
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: C.ink }}>
            <span style={{ width: 18, height: 0, borderTop: "1.5px dashed var(--color-ink)", opacity: 0.45 }} />
            plus loin dans la chaîne
          </span>
        </div>

        {/* --- Refus de lien — un geste impossible se dit, il ne s'ignore pas --- */}
        {linkRefusal && (
          <div
            role="status"
            className="absolute flex items-center"
            style={{
              left: "50%",
              transform: "translateX(-50%)",
              bottom: 16,
              gap: 10,
              maxWidth: 460,
              padding: "10px 16px",
              background: C.surface,
              border: `1px solid rgba(226,58,46,.25)`,
              borderRadius: 99,
              boxShadow: "0 6px 20px rgba(16,16,16,.1)",
              zIndex: 20,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 99, background: C.danger, flex: "none" }} />
            <span className="text-[12px] font-semibold" style={{ color: C.ink }}>{linkRefusal}</span>
          </div>
        )}

        {/* Aide au geste, pendant le tirage seulement. */}
        {link && (
          <div
            className="absolute"
            style={{
              left: "50%",
              transform: "translateX(-50%)",
              top: 16,
              padding: "8px 14px",
              background: C.ink,
              borderRadius: 99,
              zIndex: 20,
              pointerEvents: "none",
            }}
          >
            <span className="text-[12px] font-semibold" style={{ color: "#fff" }}>
              {link.overId ? "Relâche pour créer la dépendance" : "Amène le lien sur la tâche qui doit suivre"}
            </span>
          </div>
        )}

        {/* --- Commandes de zoom --- */}
        <div
          className="absolute flex items-center"
          style={{
            right: 16,
            top: 16,
            gap: 4,
            padding: 5,
            background: "rgba(255,255,255,.94)",
            border: "1px solid rgba(16,16,16,.06)",
            borderRadius: 99,
            boxShadow: "0 6px 20px rgba(16,16,16,.07)",
          }}
        >
          <button
            onClick={() => zoomBy(1 / 1.18)}
            aria-label="Dézoomer"
            className="flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: 99, border: "none", background: C.bg, color: C.ink, cursor: "pointer" }}
          >
            <ZoomOutIcon />
          </button>
          <span className="tnum text-center text-[12px] font-bold" style={{ minWidth: 46, color: C.ink }}>
            {Math.round(zoom * 100)} %
          </span>
          <button
            onClick={() => zoomBy(1.18)}
            aria-label="Zoomer"
            className="flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: 99, border: "none", background: C.bg, color: C.ink, cursor: "pointer" }}
          >
            <ZoomInIcon />
          </button>
          <button
            onClick={fit}
            style={{
              height: 30,
              padding: "0 12px",
              borderRadius: 99,
              border: "none",
              background: C.ink,
              color: "#FFFFFF",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Ajuster
          </button>
        </div>

        {list.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-[16px] font-bold" style={{ color: C.ink }}>
              Aucune chaîne à afficher
            </span>
            <span className="text-[13px] font-medium" style={{ color: C.inkMuted }}>
              Change de filtre pour retrouver tes dépendances.
            </span>
          </div>
        )}

        {selected && (
          <DetailPanel
            item={selected}
            allTasks={allTasks}
            allById={allById}
            projects={projects}
            tags={tags}
            onSelect={setSelectedId}
            onClose={() => setSelectedId(null)}
            onOpenTask={onOpenTask}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Panneau de détail — s'ouvre au clic sur un nœud.
 *
 * Il ne réédite rien : c'est une lecture de la chaîne (amont / aval) avec une
 * sortie vers la vraie fiche. Le prototype dessinait ici une fiche complète en
 * modale ; Brief en a déjà une, autrement plus riche (audio, sous-tâches
 * éditables, étiquettes) — le double-clic y mène plutôt que de la redessiner.
 * ------------------------------------------------------------------------ */

function DetailPanel({
  item,
  allTasks,
  allById,
  projects,
  tags,
  onSelect,
  onClose,
  onOpenTask,
}: {
  item: Item;
  allTasks: Item[];
  allById: Map<string, Item>;
  projects: Project[];
  tags: Tag[];
  onSelect: (id: string) => void;
  onClose: () => void;
  onOpenTask: (id: string) => void;
}) {
  const project = projects.find((p) => p.id === item.projectId);
  const st = graphStatus(item, allById);
  const deps = (item.dependsOn ?? []).map((id) => allById.get(id)).filter((d): d is Item => !!d);
  const next = unlocks(item, allTasks);
  const subs = item.subtasks ?? [];
  const doneSubs = subs.filter((s) => s.done).length;
  const itemTags = (item.tags ?? []).map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => !!t);

  const link = (x: Item) => {
    const p = projects.find((q) => q.id === x.projectId);
    return (
      <button
        key={x.id}
        onClick={() => onSelect(x.id)}
        className="flex w-full items-center gap-2.5 text-left"
        style={{
          padding: "11px 12px",
          background: "var(--color-surface)",
          border: "1px solid rgba(16,16,16,.06)",
          borderLeft: `3px solid ${p ? skinFor(p).bg : "#A9A9A2"}`,
          borderRadius: 12,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span style={{ width: 8, height: 8, flex: "none", borderRadius: 99, background: STATUS[graphStatus(x, allById)].color }} />
        <span
          className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold"
          style={{ color: C.ink, textDecoration: "none" }}
        >
          {x.title}
        </span>
        <span className="whitespace-nowrap text-[11px] font-bold" style={{ color: C.inkMuted }}>
          à faire
        </span>
      </button>
    );
  };

  const sectionLabel = (text: string) => (
    <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint }}>
      {text}
    </span>
  );

  return (
    <aside
      className="absolute bottom-0 right-0 top-0 flex flex-col"
      style={{
        width: PANEL_W,
        background: C.surface,
        borderLeft: "1px solid rgba(16,16,16,.08)",
        boxShadow: "-10px 0 28px rgba(16,16,16,.1)",
      }}
    >
      <div className="flex items-start gap-2.5" style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(16,16,16,.06)" }}>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            {project && <span style={swatchStyle(skinFor(project), shapeFor(project))} />}
            <span className="text-[12px] font-bold" style={{ color: C.inkMuted }}>
              {project?.name ?? "Sans projet"}
            </span>
            <span
              className="inline-flex items-center gap-1.5"
              style={{ height: 22, padding: "0 9px", borderRadius: 99, background: C.bg, fontSize: 11, fontWeight: 700, color: C.ink }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 99, background: STATUS[st].color }} />
              {STATUS[st].label}
            </span>
          </div>
          <span
            className="text-[20px] font-extrabold tracking-[-0.02em]"
            style={{ lineHeight: 1.2, color: item.doneAt ? C.inkFaint : C.ink, textDecoration: item.doneAt ? "line-through" : "none" }}
          >
            {item.title}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="flex items-center justify-center"
          style={{ width: 32, height: 32, flex: "none", borderRadius: 99, border: "1px solid rgba(16,16,16,.08)", background: C.surface, color: C.inkMuted, cursor: "pointer" }}
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" style={{ padding: "16px 20px 20px" }}>
        <div className="flex flex-col gap-2.5" style={{ padding: 14, background: C.bg, borderRadius: 18 }}>
          <div className="flex items-center justify-between gap-2.5">
            {sectionLabel("ÉCHÉANCE")}
            <span className="tnum text-[13px] font-bold" style={{ color: st === "blocked" ? C.danger : C.ink }}>
              {formatDue(item.due, item.allDay)}
            </span>
          </div>
          <div style={{ height: 1, background: "rgba(16,16,16,.06)" }} />
          <div className="flex items-center justify-between gap-2.5">
            {sectionLabel("ÉTIQUETTES")}
            <span className="inline-flex flex-wrap justify-end gap-1.5">
              {itemTags.length === 0 && (
                <span className="text-[12px] font-semibold" style={{ color: C.inkFaint }}>
                  aucune
                </span>
              )}
              {itemTags.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5"
                  style={{ height: 22, padding: "0 9px", borderRadius: 99, background: C.surface, fontSize: 11, fontWeight: 700, color: C.ink }}
                >
                  <span style={{ width: 14, height: 6, borderRadius: 99, background: TAG_COLOR_MAP[t.color] ?? TAG_COLOR_MAP.blue }} />
                  {t.name}
                </span>
              ))}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {sectionLabel(`DÉPEND DE · ${deps.length}`)}
          {deps.length === 0 ? (
            <span className="text-[12px] font-semibold" style={{ color: C.inkFaint }}>
              Aucune dépendance — cette tâche ouvre sa chaîne.
            </span>
          ) : (
            deps.map(link)
          )}
        </div>

        <div className="flex flex-col gap-2">
          {sectionLabel(`DÉBLOQUE · ${next.length}`)}
          {next.length === 0 ? (
            <span className="text-[12px] font-semibold" style={{ color: C.inkFaint }}>
              Rien n&apos;attend cette tâche.
            </span>
          ) : (
            next.map(link)
          )}
        </div>

        {subs.length > 0 && (
          <div
            className="flex flex-col gap-2.5"
            style={{ padding: 14, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 18 }}
          >
            <div className="flex items-center justify-between">
              {sectionLabel("SOUS-TÂCHES")}
              <span className="tnum text-[12px] font-bold" style={{ color: C.ink }}>
                {doneSubs}/{subs.length}
              </span>
            </div>
            <span style={{ height: 5, borderRadius: 99, background: "rgba(16,16,16,.07)", overflow: "hidden" }}>
              <span
                style={{
                  display: "block",
                  height: "100%",
                  borderRadius: 99,
                  background: C.ink,
                  width: `${Math.round((doneSubs / subs.length) * 100)}%`,
                  transition: "width .35s",
                }}
              />
            </span>
            {subs.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <span
                  style={{
                    width: 16,
                    height: 16,
                    flex: "none",
                    borderRadius: 99,
                    border: `2px solid ${s.done ? C.ink : "rgba(16,16,16,.18)"}`,
                    background: s.done ? C.ink : "transparent",
                  }}
                />
                <span
                  className="text-[13px] font-medium"
                  style={{ color: s.done ? C.inkFaint : C.ink, textDecoration: s.done ? "line-through" : "none" }}
                >
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => onOpenTask(item.id)}
          style={{
            height: 48,
            borderRadius: 99,
            border: "none",
            background: C.ink,
            color: "#FFFFFF",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          Ouvrir la fiche
        </button>
        <span className="text-center text-[11px] font-medium" style={{ color: C.inkFaint }}>
          Double-clic sur un nœud pour la fiche complète.
        </span>
      </div>
    </aside>
  );
}
