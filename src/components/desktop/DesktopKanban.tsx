"use client";

/**
 * Écran Kanban desktop — board avec colonnes libres (comme Trello).
 * L'utilisateur crée, nomme, réordonne ses colonnes, et déplace ses cartes
 * librement : entre colonnes, à une position précise dans une colonne, et vers
 * la barre « Non placées ».
 *
 * ⚠️ Ce composant ne calcule JAMAIS de rang de carte. Il ne voit qu'une partie
 * de chaque colonne (filtre projet, cartes faites masquées), donc des rangs
 * calculés ici écraseraient l'ordre de ce qu'il ne montre pas. Il envoie une
 * intention — « entre ces deux cartes-là » — et le serveur numérote
 * (`src/lib/kanban.ts`, `PATCH /api/board/cards`).
 *
 * Design : prototype Claude Design "Kanban desktop v2".
 */

import { useState, useCallback, useMemo, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KanbanCard } from "./KanbanCard";
import { columnItems, reorderColumnIds } from "@/lib/kanban";
import { skinFor, shapeFor } from "@/lib/projects";
import type { Item, KanbanBoard, KanbanColumn, Project, Tag } from "@/lib/types";

const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
} as const;

/** Clé de la barre « Non placées » dans le plan de disposition. */
const UNPLACED = "unplaced";
/** Suffixe du droppable « corps de colonne » — distinct de la colonne elle-même. */
const BODY = ":body";

/** Clé de plan ↔ `null` (non placée). */
const columnOfKey = (key: string): string | null => (key === UNPLACED ? null : key);

/* --- Carte triable -------------------------------------------------------- */

function SortableCard({
  item,
  project,
  tags,
  items,
  onOpen,
}: {
  item: Item;
  project: Project | undefined;
  tags: Tag[];
  items: Item[];
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: "card" },
    // `role="group"` et non le `role="button"` par défaut de dnd-kit : la carte
    // CONTIENT un `<button>` (« ouvrir la fiche »), et un élément interactif
    // dans un `role="button"` est de l'ARIA invalide — plusieurs lecteurs
    // d'écran aplatissent alors les enfants et masquent ce bouton.
    // `tabIndex: 0` reste posé par dnd-kit : c'est lui qui rend la carte
    // saisissable au clavier, avec `aria-roledescription="sortable"`.
    attributes: { role: "group" },
  });

  // Placeholder à la Trello : la carte tirée laisse un creux gris de sa propre
  // hauteur, elle ne reste pas en fantôme translucide à sa place.
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          background: "rgba(16,16,16,.05)",
          borderRadius: 18,
        }}
      >
        <div style={{ visibility: "hidden" }}>
          <KanbanCard item={item} project={project} tags={tags} items={items} onClick={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: "grab",
        touchAction: "none",
      }}
    >
      <KanbanCard item={item} project={project} tags={tags} items={items} onClick={onOpen} />
    </div>
  );
}

/* --- Pilule triable (barre « Non placées ») ------------------------------- */

function SortablePill({
  item,
  project,
  onOpen,
}: {
  item: Item;
  project: Project | undefined;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: "card" },
  });
  const skin = project ? skinFor(project) : null;
  const shape = project ? shapeFor(project) : "disc";
  const radius = shape === "square" || shape === "diamond" ? "2px" : "99px";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onDoubleClick={onOpen}
      className="flex items-center"
      style={{
        gap: 9,
        height: 36,
        padding: "0 12px",
        background: isDragging ? "rgba(16,16,16,.05)" : C.bg,
        color: isDragging ? "transparent" : undefined,
        borderRadius: 99,
        cursor: "grab",
        flex: "none",
        transform: CSS.Transform.toString(transform),
        transition,
        // La barre défile horizontalement : sans ça, un geste tactile ferait
        // défiler la liste au lieu de saisir la pilule.
        touchAction: "none",
      }}
    >
      {skin && !isDragging && (
        <span style={{ width: 8, height: 8, borderRadius: radius, background: skin.bg, flex: "none" }} />
      )}
      <span className="text-[13px] font-semibold" style={{ whiteSpace: "nowrap", color: isDragging ? "transparent" : C.ink }}>
        {item.title}
      </span>
    </div>
  );
}

/* --- Colonne triable et droppable ----------------------------------------- */

function SortableColumnView({
  column,
  items,
  allItems,
  projects,
  tags,
  activeProjectFilter,
  onOpenTask,
  onRenameColumn,
  onDeleteColumn,
  onSetWip,
  onAddCard,
}: {
  column: KanbanColumn;
  items: Item[];
  allItems: Item[];
  projects: Project[];
  tags: Tag[];
  activeProjectFilter: string | null;
  onOpenTask: (id: string) => void;
  onRenameColumn: (id: string, name: string) => void;
  onDeleteColumn: (id: string, cardCount: number) => void;
  onSetWip: (columnId: string, limit: number | null) => void;
  onAddCard: (columnId: string, title: string, projectId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id, data: { type: "column" } });

  // Droppable DISTINCT de la colonne : sans deux ids, le dépôt d'une carte en
  // zone vide et le réordonnancement des colonnes se disputeraient la même
  // cible, et l'un des deux gestes deviendrait imprévisible.
  const { setNodeRef: setBodyRef, isOver } = useDroppable({
    id: `${column.id}${BODY}`,
    data: { type: "column-body", columnId: column.id },
  });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [wipDraft, setWipDraft] = useState<string | null>(null);

  /**
   * Le nombre de cartes de la colonne COMPLÈTE, pas celui des cartes affichées.
   * `items` est déjà filtré (projet actif, cartes faites masquées) : annoncer
   * « ses 3 cartes » avant d'en détacher 10 serait un mensonge au moment précis
   * où l'utilisateur décide.
   */
  const totalCards = allItems.filter((it) => it.columnId === column.id).length;

  /**
   * Les cartes en cours de la colonne complète — le compte que regarde la
   * limite WIP. Une carte faite n'est pas du travail en cours, et `items` est
   * filtré : une limite comptée à l'écran passerait au vert dès qu'on filtre.
   */
  const openCards = allItems.filter((it) => it.columnId === column.id && !it.doneAt).length;
  const overWip = column.wipLimit !== undefined && openCards > column.wipLimit;

  const commitWip = () => {
    const raw = (wipDraft ?? "").trim();
    setWipDraft(null);
    if (!raw) { if (column.wipLimit !== undefined) onSetWip(column.id, null); return; }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 999) return;
    if (n !== column.wipLimit) onSetWip(column.id, n);
  };

  const startEditing = () => {
    // Le champ se remplit à l'OUVERTURE, pas par un effet sur `column.name` :
    // un `setState` synchrone dans un effet relance un rendu en cascade à
    // chaque rafraîchissement du board, et écraserait la saisie en cours si un
    // autre onglet renommait la colonne pendant la frappe.
    setName(column.name);
    setEditing(true);
  };

  const commitName = () => {
    setEditing(false);
    if (name.trim() && name.trim() !== column.name) onRenameColumn(column.id, name.trim());
    else setName(column.name);
  };

  const commitCard = () => {
    const title = draft.trim();
    if (!title) return;
    // La carte hérite du filtre projet posé : sans ça, créer une carte pendant
    // qu'un filtre est actif produit une carte immédiatement invisible.
    onAddCard(column.id, title, activeProjectFilter);
    setDraft(""); // le champ reste ouvert : on enchaîne les cartes, comme Trello
  };

  return (
    <div
      ref={setNodeRef}
      className="flex h-full min-h-0 w-[300px] flex-none flex-col"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        background: isOver ? "#FFFFFF" : "rgba(16,16,16,.03)",
        borderRadius: 20,
        // La limite dépassée se voit à l'échelle de la colonne : c'est la
        // colonne qui est trop pleine, pas son compteur qui a un problème.
        border: overWip
          ? "1px solid var(--color-danger)"
          : isOver
            ? "1px solid rgba(16,16,16,.20)"
            : "1px solid rgba(16,16,16,.06)",
      }}
    >
      {/* Header colonne — la pastille est la poignée de déplacement */}
      <div className="flex items-center" style={{ gap: 9, padding: "13px 14px 10px", flex: "none" }}>
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Déplacer la liste ${column.name}`}
          style={{
            width: 14, height: 14, flex: "none", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "none", border: "none", cursor: "grab", touchAction: "none",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 99, background: "#A9A9A2", display: "block" }} />
        </button>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") { setEditing(false); setName(column.name); }
            }}
            className="flex-1"
            style={{
              padding: "6px 10px", background: C.surface, border: "1px solid rgba(16,16,16,.12)",
              borderRadius: 8, fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: C.ink,
            }}
          />
        ) : (
          <button
            onClick={startEditing}
            className="flex-1 text-left"
            style={{
              background: "none", border: "none", padding: "6px 0", cursor: "pointer",
              fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em",
            }}
          >
            {column.name}
          </button>
        )}
        <span
          className="tnum"
          style={{
            minWidth: 20, padding: "2px 6px", borderRadius: 99, background: C.surface,
            border: "1px solid rgba(16,16,16,.06)", fontSize: 10, fontWeight: 700,
            textAlign: "center",
            color: overWip ? "var(--color-danger)" : C.inkMuted,
          }}
          title={column.wipLimit !== undefined ? `Limite indicative : ${column.wipLimit} cartes en cours` : undefined}
        >
          {column.wipLimit !== undefined ? `${openCards}/${column.wipLimit}` : items.length}
        </span>
        {/* « + » ajoute une carte — c'est ce que son libellé annonce. Il
            appelait `onDeleteColumn`, donc un clic dessus faisait disparaître
            toutes les cartes de la liste. */}
        <button
          onClick={() => setComposing((v) => !v)}
          aria-label="Ajouter une carte"
          style={{
            width: 26, height: 26, flex: "none", borderRadius: 99,
            border: "1px solid rgba(16,16,16,.1)", background: C.surface, cursor: "pointer",
            fontSize: 14, fontWeight: 700, color: C.ink, lineHeight: 1,
          }}
        >
          +
        </button>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Options de la liste"
          style={{
            width: 26, height: 26, flex: "none", borderRadius: 99,
            border: "1px solid rgba(16,16,16,.1)", background: C.surface, cursor: "pointer",
            fontSize: 12, fontWeight: 700, color: C.inkMuted, lineHeight: 1,
          }}
        >
          ⋯
        </button>
      </div>

      {menuOpen && (
        <div
          style={{
            margin: "0 12px 8px", padding: 6, background: C.surface,
            border: "1px solid rgba(16,16,16,.08)", borderRadius: 12,
            boxShadow: "0 6px 20px rgba(16,16,16,.07)",
          }}
        >
          <button
            onClick={() => { startEditing(); setMenuOpen(false); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.ink }}
          >
            Renommer la liste
          </button>
          {/* Le libellé disait « Vider et supprimer » et ne vidait rien : les
              cartes gardaient un `columnId` mort et disparaissaient du board.
              Elles repartent maintenant en « Non placées » — d'où la
              confirmation en deux temps, qui dit ce qui leur arrive. */}
          {wipDraft === null ? (
            <button
              onClick={() => setWipDraft(column.wipLimit === undefined ? "" : String(column.wipLimit))}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.ink }}
            >
              {column.wipLimit === undefined ? "Définir une limite (WIP)" : `Limite : ${column.wipLimit}`}
            </button>
          ) : (
            <div style={{ padding: "8px 10px" }}>
              <input
                autoFocus
                inputMode="numeric"
                value={wipDraft}
                // Chiffres seuls, pas de zéro en tête, trois caractères au
                // plus : `0` et `1000` deviennent inatteignables. `commitWip`
                // les refusait déjà, mais en fermant le champ sans rien dire —
                // un refus silencieux ressemble à un enregistrement réussi.
                onChange={(e) =>
                  setWipDraft(e.target.value.replace(/[^0-9]/g, "").replace(/^0+/, "").slice(0, 3))
                }
                onBlur={commitWip}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitWip();
                  if (e.key === "Escape") setWipDraft(null);
                }}
                placeholder="Vide = aucune limite"
                aria-label={`Limite de cartes pour ${column.name}`}
                style={{
                  width: "100%", padding: "6px 10px", background: C.bg,
                  border: "1px solid rgba(16,16,16,.12)", borderRadius: 8,
                  fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.ink,
                }}
              />
              <p className="text-[11px] font-medium" style={{ color: C.inkFaint, margin: "4px 0 0", lineHeight: 1.4 }}>
                Indicative : la colonne pleine accepte quand même les cartes.
              </p>
            </div>
          )}
          {confirmingDelete ? (
            <div style={{ padding: "8px 10px" }}>
              <p className="text-[12px] font-semibold" style={{ color: C.ink, margin: 0, lineHeight: 1.4 }}>
                Supprimer «&nbsp;{column.name}&nbsp;» ?
              </p>
              <p className="text-[11px] font-medium" style={{ color: C.inkMuted, margin: "3px 0 8px", lineHeight: 1.4 }}>
                {totalCards === 0
                  ? "La liste est vide."
                  : `${totalCards} carte${totalCards > 1 ? "s" : ""} repart${totalCards > 1 ? "ent" : ""} en Non placées.`}
              </p>
              <div className="flex" style={{ gap: 6 }}>
                <button
                  onClick={() => { onDeleteColumn(column.id, totalCards); setConfirmingDelete(false); setMenuOpen(false); }}
                  style={{ padding: "6px 10px", background: "var(--color-danger)", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}
                >
                  Supprimer
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  style={{ padding: "6px 10px", background: "none", border: "1px solid rgba(16,16,16,.12)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: C.inkMuted }}
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--color-danger)" }}
            >
              Supprimer la liste
            </button>
          )}
        </div>
      )}

      {/* Cartes */}
      <div ref={setBodyRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ gap: 8, padding: "0 12px 12px" }}>
        <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableCard
              key={item.id}
              item={item}
              project={projects.find((p) => p.id === item.projectId)}
              tags={tags}
              items={allItems}
              onOpen={() => onOpenTask(item.id)}
            />
          ))}
        </SortableContext>

        {items.length === 0 && !composing && (
          <div
            className="flex items-center justify-center"
            style={{
              height: 74, border: "1px dashed rgba(16,16,16,.14)", borderRadius: 18,
              fontSize: 12, fontWeight: 600, color: C.inkFaint,
            }}
          >
            Déposer une carte ici
          </div>
        )}

        {composing && (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCard();
                if (e.key === "Escape") { setDraft(""); setComposing(false); }
              }}
              onBlur={() => { if (!draft.trim()) setComposing(false); }}
              placeholder="Titre de la carte…"
              style={{
                padding: "10px 12px", background: C.surface, border: "1px solid rgba(16,16,16,.12)",
                borderRadius: 18, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.ink,
              }}
            />
            <span className="text-[11px] font-medium" style={{ color: C.inkFaint, paddingLeft: 4 }}>
              Entrée pour ajouter · Échap pour fermer
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* --- Board ---------------------------------------------------------------- */

export function DesktopKanban({
  items,
  projects,
  board,
  tags,
  onMoveCard,
  onReorderColumns,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
  onSetWip,
  onAddCard,
  onOpenTask,
}: {
  items: Item[];
  projects: Project[];
  board: KanbanBoard;
  tags: Tag[];
  onMoveCard: (intent: { itemId: string; toColumnId: string | null; beforeId?: string; afterId?: string }) => Promise<void>;
  onReorderColumns: (ids: string[]) => void;
  onAddColumn: (name: string) => void;
  onRenameColumn: (columnId: string, name: string) => void;
  onDeleteColumn: (columnId: string, cardCount: number) => void;
  onSetWip: (columnId: string, limit: number | null) => void;
  onAddCard: (columnId: string, title: string, projectId: string | null) => void;
  onOpenTask: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"card" | "column" | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [activeProjectFilter, setActiveProjectFilter] = useState<string | null>(null);
  const [showUnplaced, setShowUnplaced] = useState(true);

  /**
   * Aperçu du board pendant le glissement : `clé de colonne → ids visibles`.
   * dnd-kit ne déplace rien tout seul entre conteneurs ; c'est ce plan qu'on
   * mute au survol, et qu'on relit au dépôt pour en déduire les voisins.
   */
  const [preview, setPreview] = useState<Record<string, string[]> | null>(null);
  const previewRef = useRef<Record<string, string[]> | null>(null);

  /**
   * Écrit le plan dans le ref ET dans l'état, en un seul geste.
   *
   * Le ref est ce que relit le handler SUIVANT : `onDragOver` peut se déclencher
   * plusieurs fois avant que React n'ait rendu, et `onDragEnd` a besoin du
   * dernier plan, pas de celui du rendu courant. L'écrire en corps de rendu
   * (`previewRef.current = preview`) marchait mais rendait le rendu impur — et
   * un rendu concurrent abandonné aurait laissé le ref sur un plan jamais
   * affiché.
   */
  const setPlan = useCallback((next: Record<string, string[]> | null) => {
    previewRef.current = next;
    setPreview(next);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columns = useMemo(() => [...board.columns].sort((a, b) => a.order - b.order), [board.columns]);

  const visibleItems = useMemo(
    () => (activeProjectFilter ? items.filter((it) => it.projectId === activeProjectFilter) : items),
    [items, activeProjectFilter],
  );

  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  /** Les ids visibles par colonne, tels que les données les donnent. */
  const layout = useMemo(() => {
    const open = visibleItems.filter((it) => !it.doneAt);
    const next: Record<string, string[]> = { [UNPLACED]: columnItems(open, null).map((it) => it.id) };
    for (const column of columns) next[column.id] = columnItems(open, column.id).map((it) => it.id);
    return next;
  }, [visibleItems, columns]);

  const effective = preview ?? layout;

  const openCount = visibleItems.filter((it) => !it.doneAt).length;
  const unplacedIds = effective[UNPLACED] ?? [];

  const projectIdsInUse = new Set(items.filter((it) => !it.doneAt && it.projectId).map((it) => it.projectId));
  const filterProjects = projects.filter((p) => projectIdsInUse.has(p.id));

  /** La clé de colonne qui contient cet id dans le plan courant. */
  const keyContaining = useCallback((plan: Record<string, string[]>, id: string): string | null => {
    for (const [key, ids] of Object.entries(plan)) if (ids.includes(id)) return key;
    return null;
  }, []);

  /** La clé de colonne visée par un `over`, quelle que soit sa nature. */
  const keyOfOver = useCallback(
    (plan: Record<string, string[]>, overId: string): string | null => {
      if (overId === UNPLACED) return UNPLACED;
      if (overId.endsWith(BODY)) return overId.slice(0, -BODY.length);
      if (plan[overId]) return overId; // l'id d'une colonne
      return keyContaining(plan, overId); // l'id d'une carte
    },
    [keyContaining],
  );

  /**
   * Détection composée. `closestCorners` seul vise la mauvaise colonne dès que
   * le curseur passe au-dessus d'une gouttière : on privilégie ce qui est
   * réellement sous le pointeur, et on ne retombe sur la géométrie que si rien
   * ne l'est.
   */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args);
    const collisions = pointer.length > 0 ? pointer : rectIntersection(args);
    const first = getFirstCollision(collisions, "id");
    return first != null ? collisions : closestCorners(args);
  }, []);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const type = (e.active.data.current?.type as "card" | "column" | undefined) ?? "card";
    setActiveId(String(e.active.id));
    setActiveType(type);
    if (type === "card") setPlan(layout);
  }, [layout, setPlan]);

  const handleDragOver = useCallback(
    (e: DragOverEvent) => {
      if (activeType !== "card" || !e.over) return;
      const plan = previewRef.current;
      if (!plan) return;

      const activeCardId = String(e.active.id);
      const overId = String(e.over.id);
      const fromKey = keyContaining(plan, activeCardId);
      const toKey = keyOfOver(plan, overId);
      if (!fromKey || !toKey) return;

      const overIndex = (plan[toKey] ?? []).indexOf(overId);

      if (fromKey === toKey) {
        if (overIndex === -1) return;
        const ids = plan[toKey];
        const from = ids.indexOf(activeCardId);
        if (from === -1 || from === overIndex) return;
        const next = [...ids];
        next.splice(from, 1);
        next.splice(overIndex, 0, activeCardId);
        setPlan({ ...plan, [toKey]: next });
        return;
      }

      const source = (plan[fromKey] ?? []).filter((id) => id !== activeCardId);
      const target = [...(plan[toKey] ?? [])];
      target.splice(overIndex === -1 ? target.length : overIndex, 0, activeCardId);
      setPlan({ ...plan, [fromKey]: source, [toKey]: target });
    },
    [activeType, keyContaining, keyOfOver, setPlan],
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const active = String(e.active.id);
      const type = activeType;
      const plan = previewRef.current;
      setActiveId(null);
      setActiveType(null);

      /*
       * ⚠️ L'aperçu n'est PAS effacé au moment où la requête part.
       *
       * `preview` est ce qui dessine le board pendant le glissement. L'effacer
       * au dépôt fait retomber le rendu sur `layout`, dérivé d'un `items` que
       * le serveur n'a pas encore rafraîchi : la carte se redessinait à sa
       * position d'ORIGINE le temps de l'aller-retour, puis sautait à sa
       * nouvelle place. Invisible en local, très visible depuis le VPS.
       *
       * Il est effacé quand la requête a rendu — succès comme échec — parce
       * qu'à ce moment `items` porte l'état serveur.
       */
      if (!e.over) { setPlan(null); return; }

      if (type === "column") {
        setPlan(null);
        const over = String(e.over.id);
        const overColumn = over.endsWith(BODY) ? over.slice(0, -BODY.length) : over;
        if (!columns.some((c) => c.id === overColumn) || overColumn === active) return;
        onReorderColumns(reorderColumnIds(columns, active, overColumn));
        return;
      }

      if (!plan) { setPlan(null); return; }
      const key = keyContaining(plan, active);
      if (key === null) { setPlan(null); return; }

      const ids = plan[key];
      const index = ids.indexOf(active);
      const beforeId = index > 0 ? ids[index - 1] : undefined;
      const afterId = index < ids.length - 1 ? ids[index + 1] : undefined;

      // Rien n'a bougé : ni écriture, ni requête.
      const origin = layout[key] ?? [];
      if (origin.indexOf(active) === index && keyContaining(layout, active) === key) {
        setPlan(null);
        return;
      }

      void onMoveCard({ itemId: active, toColumnId: columnOfKey(key), beforeId, afterId })
        .finally(() => setPlan(null));
    },
    [activeType, columns, keyContaining, layout, onMoveCard, onReorderColumns, setPlan],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setActiveType(null);
    setPlan(null);
  }, [setPlan]);

  const { setNodeRef: setUnplacedRef, isOver: unplacedOver } = useDroppable({
    id: UNPLACED,
    data: { type: "column-body", columnId: null },
  });

  const activeItem = activeId ? itemById.get(activeId) : null;
  const activeColumn = activeType === "column" ? columns.find((c) => c.id === activeId) : undefined;

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ animation: "fade .3s both" }}>
      {/* En-tête : Titre + filtres + Non placées */}
      <div className="flex items-center flex-none" style={{ gap: 12, margin: "0 2px 12px" }}>
        <h1 className="text-[22px] font-extrabold" style={{ margin: 0, letterSpacing: "-0.02em", color: C.ink }}>
          Kanban
        </h1>
        <span className="tnum text-[13px] font-bold" style={{ color: C.inkFaint }}>
          {openCount} ouvertes
        </span>

        <div className="flex" style={{ gap: 6, marginLeft: 8 }}>
          {filterProjects.map((p) => {
            const skin = skinFor(p);
            const shape = shapeFor(p);
            const radius = shape === "square" || shape === "diamond" ? "2px" : "99px";
            const on = activeProjectFilter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActiveProjectFilter(on ? null : p.id)}
                className="inline-flex items-center"
                style={{
                  gap: 7, height: 30, padding: "0 12px", borderRadius: 99,
                  border: `1px solid ${on ? "#101010" : "rgba(16,16,16,.08)"}`,
                  background: on ? "#101010" : C.surface, cursor: "pointer",
                  fontSize: 12, fontWeight: 700, color: on ? "#FFFFFF" : C.ink,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: radius, background: skin.bg, flex: "none" }} />
                {p.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center" style={{ marginLeft: "auto", gap: 8 }}>
          <button
            onClick={() => setShowUnplaced(!showUnplaced)}
            className="flex items-center"
            style={{
              gap: 8, height: 36, padding: "0 14px", borderRadius: 99,
              border: "1px solid rgba(16,16,16,.12)", background: C.surface,
              cursor: "pointer", fontSize: 12, fontWeight: 700, color: C.ink,
            }}
          >
            Non placées
            <span
              className="tnum"
              style={{
                minWidth: 18, padding: "2px 5px", borderRadius: 99, background: C.bg,
                fontSize: 10, fontWeight: 700, textAlign: "center", color: C.inkMuted,
              }}
            >
              {unplacedIds.length}
            </span>
            <span style={{ color: C.inkFaint }}>{showUnplaced ? "−" : "+"}</span>
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Barre « Non placées » — cible de dépôt : une carte peut sortir du board */}
        {showUnplaced && (unplacedIds.length > 0 || activeType === "card") && (
          <div
            ref={setUnplacedRef}
            className="flex items-center flex-none"
            style={{
              gap: 10, padding: "10px 12px", marginBottom: 12,
              background: unplacedOver ? "#FFFFFF" : C.surface,
              border: `1px dashed ${unplacedOver ? "rgba(16,16,16,.28)" : "rgba(16,16,16,.14)"}`,
              borderRadius: 18, animation: "fade .2s both", minHeight: 56,
            }}
          >
            <span
              className="font-mono flex-none"
              style={{ fontSize: 10, letterSpacing: "0.09em", color: C.inkFaint, paddingLeft: 4 }}
            >
              NON PLACÉES
            </span>
            <div className="flex overflow-x-auto" style={{ gap: 8 }}>
              <SortableContext items={unplacedIds} strategy={horizontalListSortingStrategy}>
                {unplacedIds.map((id) => {
                  const item = itemById.get(id);
                  if (!item) return null;
                  return (
                    <SortablePill
                      key={id}
                      item={item}
                      project={item.projectId ? projectById.get(item.projectId) : undefined}
                      onOpen={() => onOpenTask(id)}
                    />
                  );
                })}
              </SortableContext>
              {unplacedIds.length === 0 && (
                <span className="text-[12px] font-semibold" style={{ color: C.inkFaint }}>
                  Déposer ici pour retirer du board
                </span>
              )}
            </div>
          </div>
        )}

        {/* Colonnes + ajout */}
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto" style={{ paddingBottom: 6 }}>
          <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            {columns.map((col) => {
              const ids = effective[col.id] ?? [];
              const colItems = ids.map((id) => itemById.get(id)).filter((it): it is Item => !!it);
              return (
                <SortableColumnView
                  key={col.id}
                  column={col}
                  items={colItems}
                  allItems={items}
                  projects={projects}
                  tags={tags}
                  activeProjectFilter={activeProjectFilter}
                  onOpenTask={onOpenTask}
                  onRenameColumn={onRenameColumn}
                  onDeleteColumn={onDeleteColumn}
                  onSetWip={onSetWip}
                  onAddCard={onAddCard}
                />
              );
            })}
          </SortableContext>

          <div className="flex w-[250px] flex-none flex-col" style={{ paddingTop: 2 }}>
            {addingColumn ? (
              <div className="flex flex-col gap-2" style={{ padding: 14, background: C.bg, borderRadius: 20, border: "1px solid rgba(16,16,16,.06)" }}>
                <input
                  autoFocus
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newColumnName.trim()) {
                      onAddColumn(newColumnName.trim());
                      setNewColumnName("");
                      setAddingColumn(false);
                    }
                    if (e.key === "Escape") {
                      setNewColumnName("");
                      setAddingColumn(false);
                    }
                  }}
                  placeholder="Nom de la liste…"
                  style={{
                    padding: "10px 12px", background: C.surface, border: "1px solid rgba(16,16,16,.12)",
                    borderRadius: 12, fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: C.ink,
                  }}
                />
                <button
                  onClick={() => {
                    if (newColumnName.trim()) {
                      onAddColumn(newColumnName.trim());
                      setNewColumnName("");
                      setAddingColumn(false);
                    }
                  }}
                  style={{
                    padding: "10px 12px", background: C.ink, color: "#fff", border: "none",
                    borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  }}
                >
                  Ajouter
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="flex items-center justify-center"
                style={{
                  width: "100%", height: 46, background: "rgba(16,16,16,.03)",
                  border: "1px dashed rgba(16,16,16,.14)", borderRadius: 20, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: C.inkMuted, gap: 8,
                }}
              >
                + Ajouter une liste
              </button>
            )}
          </div>
        </div>

        {/*
          Le DragOverlay est HORS du conteneur `overflow-x-auto` : à l'intérieur,
          il se faisait rogner par l'ancêtre défilant et se décalait au scroll.
        */}
        <DragOverlay>
          {activeItem && activeType === "card" ? (
            <div style={{ width: 272, boxShadow: "0 8px 20px rgba(16,16,16,.28)", borderRadius: 18 }}>
              <KanbanCard
                item={activeItem}
                project={activeItem.projectId ? projectById.get(activeItem.projectId) : undefined}
                tags={tags}
                items={items}
                onClick={() => {}}
              />
            </div>
          ) : activeColumn ? (
            <div
              className="flex w-[300px] items-center"
              style={{
                gap: 9, height: 52, padding: "0 14px", background: C.surface,
                borderRadius: 20, boxShadow: "0 8px 20px rgba(16,16,16,.28)",
                fontSize: 14, fontWeight: 700, color: C.ink,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 99, background: "#A9A9A2" }} />
              {activeColumn.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
