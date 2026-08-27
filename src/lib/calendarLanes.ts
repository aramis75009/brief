/**
 * Répartition en voies des événements d'une journée.
 *
 * `DESIGN.md` §7, règle 2 : « Les blocs qui se chevauchent se partagent la
 * largeur du jour (voies), ils ne se recouvrent jamais. À 56px/heure, deux
 * éléments posés à moins de 50 min d'écart se croisent : c'est la règle, pas un
 * cas limite. » La grille desktop posait pourtant chaque bloc en `left: 4,
 * right: 4`, donc pleine largeur, donc empilés — c'est le bug du 2026-08-25.
 *
 * Fonction pure, sans React ni DOM, pour être vérifiable par la suite de tests
 * qui tourne en `environment: "node"`.
 */

export type LaneInput = {
  id: string;
  /** Minutes depuis le début de la grille. Peut être négatif si l'événement commence avant 7h. */
  startMin: number;
  /** Durée en minutes. Une durée nulle ou absente compte pour la hauteur minimale. */
  durationMin: number;
};

export type LanePlacement = {
  id: string;
  /** Index de voie, 0 = la plus à gauche. */
  lane: number;
  /** Nombre de voies à se partager la largeur pour CE groupe. */
  lanes: number;
  /** Identifiant du groupe d'événements qui se croisent, stable pour la journée. */
  cluster: number;
  /** Vrai quand la voie dépasse le plafond de lisibilité et que le bloc est replié. */
  hidden: boolean;
  /** Nombre d'événements repliés dans le groupe. Renseigné sur chaque membre du groupe. */
  overflow: number;
};

/** Durée minimale prise en compte pour décider si deux blocs se croisent. */
const MIN_SPAN_MIN = 30;

/**
 * Ordonne, groupe et attribue une voie à chaque événement.
 *
 * `maxLanes` plafonne le nombre de voies visibles : au-delà, une colonne de jour
 * dans une semaine à 7 jours devient trop étroite pour qu'un titre se lise. Les
 * événements au-delà du plafond sont marqués `hidden` et comptés dans
 * `overflow`, à l'appelant d'offrir le « +N autres ». Passer `Infinity` rend
 * tout visible (c'est ce que fait le dépli).
 */
export function layoutDayLanes(events: LaneInput[], maxLanes = 3): LanePlacement[] {
  if (events.length === 0) return [];

  // Le plus tôt d'abord ; à égalité, le plus long d'abord — sinon un événement
  // court prend la voie de gauche et pousse le long à droite, ce qui se lit mal.
  const sorted = [...events].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    const spanA = Math.max(MIN_SPAN_MIN, a.durationMin);
    const spanB = Math.max(MIN_SPAN_MIN, b.durationMin);
    if (spanA !== spanB) return spanB - spanA;
    return a.id.localeCompare(b.id);
  });

  const endOf = (e: LaneInput) => e.startMin + Math.max(MIN_SPAN_MIN, e.durationMin);

  // --- Groupes : une suite d'événements qui se croisent de proche en proche ---
  const clusters: LaneInput[][] = [];
  let current: LaneInput[] = [];
  let clusterEnd = -Infinity;
  for (const e of sorted) {
    if (current.length > 0 && e.startMin >= clusterEnd) {
      clusters.push(current);
      current = [];
      clusterEnd = -Infinity;
    }
    current.push(e);
    clusterEnd = Math.max(clusterEnd, endOf(e));
  }
  if (current.length > 0) clusters.push(current);

  // --- Voies dans chaque groupe -------------------------------------------
  const out: LanePlacement[] = [];
  clusters.forEach((cluster, clusterIndex) => {
    const laneEnds: number[] = [];
    const assigned: { e: LaneInput; lane: number }[] = [];

    for (const e of cluster) {
      // Première voie libérée avant le début de cet événement.
      let lane = laneEnds.findIndex((end) => end <= e.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(endOf(e));
      } else {
        laneEnds[lane] = endOf(e);
      }
      assigned.push({ e, lane });
    }

    const usedLanes = laneEnds.length;
    const visibleLanes = Math.min(usedLanes, maxLanes);
    const overflow = assigned.filter((a) => a.lane >= visibleLanes).length;

    for (const { e, lane } of assigned) {
      out.push({
        id: e.id,
        lane,
        lanes: visibleLanes,
        cluster: clusterIndex,
        hidden: lane >= visibleLanes,
        overflow,
      });
    }
  });

  return out;
}
