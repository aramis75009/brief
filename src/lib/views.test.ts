import { describe, expect, it } from "vitest";
import {
  UNPLACED,
  dashboardStats,
  dayGrid,
  dayKey,
  donutGradient,
  groupItems,
  mondayOf,
  rangeLabel,
  timelineDeps,
  timelineRows,
  weekGrid,
} from "./views";
import type { Item, KanbanColumn } from "./types";

/**
 * Dimanche 6 septembre 2026, 10:00 UTC (12:00 à Paris).
 *
 * Un dimanche est délibéré : c'est le jour où une grille calculée avec les
 * méthodes locales de `Date` en UTC se décale d'une semaine entière.
 */
const NOW = new Date("2026-09-06T10:00:00.000Z");

function task(over: Partial<Item> = {}): Item {
  return {
    id: "it_1",
    kind: "task",
    title: "Tâche",
    projectId: "p1",
    due: null,
    allDay: true,
    priority: 3,
    rrule: null,
    createdAt: "2026-09-01T08:00:00.000Z",
    remindedAt: null,
    doneAt: null,
    ...over,
  };
}

/* --- Grilles de jours ----------------------------------------------------- */

describe("dayGrid", () => {
  it("rend le bon nombre de jours consécutifs", () => {
    const days = dayGrid(NOW, 0, 14);
    expect(days).toHaveLength(14);
    expect(days[0].key).toBe("2026-09-06");
    expect(days[13].key).toBe("2026-09-19");
  });

  it("accepte un décalage négatif — les tâches en retard ont besoin de place à gauche", () => {
    expect(dayGrid(NOW, -3, 7)[0].key).toBe("2026-09-03");
  });

  it("marque aujourd'hui, et lui seul", () => {
    const days = dayGrid(NOW, -2, 5);
    expect(days.filter((d) => d.isToday).map((d) => d.key)).toEqual(["2026-09-06"]);
  });

  it("nomme les jours dans le calendrier de Paris — le 6 sept 2026 est un dimanche", () => {
    const days = dayGrid(NOW, 0, 3);
    expect(days.map((d) => d.dow)).toEqual(["DIM", "LUN", "MAR"]);
    expect(days[0].weekend).toBe(true);
    expect(days[1].weekend).toBe(false);
  });

  it("franchit une fin de mois sans trou", () => {
    const days = dayGrid(new Date("2026-09-29T10:00:00.000Z"), 0, 4);
    expect(days.map((d) => d.key)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("mondayOf / weekGrid", () => {
  it("un dimanche appartient à la semaine qui a commencé le lundi PRÉCÉDENT", () => {
    // Le piège classique : avec `getDay()`, dimanche = 0 renvoie au lundi suivant.
    expect(dayKey(mondayOf(NOW))).toBe("2026-08-31");
  });

  it("la semaine va de lundi à dimanche", () => {
    const week = weekGrid(NOW);
    expect(week).toHaveLength(7);
    expect(week[0].dow).toBe("LUN");
    expect(week[6].dow).toBe("DIM");
    expect(week[6].isToday).toBe(true);
  });
});

/* --- rangeLabel ----------------------------------------------------------- */

describe("rangeLabel", () => {
  it("dit « Pas d'échéance » quand il n'y en a pas", () => {
    expect(rangeLabel(task(), NOW)).toBe("Pas d'échéance");
  });

  it("nomme aujourd'hui, demain et hier", () => {
    expect(rangeLabel(task({ due: "2026-09-06T14:00:00.000Z" }), NOW)).toBe("Aujourd'hui");
    expect(rangeLabel(task({ due: "2026-09-07T14:00:00.000Z" }), NOW)).toBe("Demain");
    expect(rangeLabel(task({ due: "2026-09-05T14:00:00.000Z" }), NOW)).toBe("Hier");
  });

  it("ajoute l'heure quand le créneau en a une", () => {
    const it = task({ due: "2026-09-06T16:30:00.000Z", allDay: false });
    expect(rangeLabel(it, NOW)).toBe("Aujourd'hui 18:30");
  });

  it("écrit une date courte au-delà de trois jours nommés", () => {
    expect(rangeLabel(task({ due: "2026-09-11T14:00:00.000Z" }), NOW)).toBe("11 sept");
  });

  it("écrit le mois UNE SEULE FOIS quand les deux bornes le partagent", () => {
    const it = task({ startDate: "2026-09-09T08:00:00.000Z", due: "2026-09-11T18:00:00.000Z" });
    expect(rangeLabel(it, NOW)).toBe("9 – 11 sept");
  });

  it("écrit les deux mois quand la plage en change", () => {
    const it = task({ startDate: "2026-09-28T08:00:00.000Z", due: "2026-10-03T18:00:00.000Z" });
    expect(rangeLabel(it, NOW)).toBe("28 sept – 3 oct");
  });

  it("garde le nom relatif sur la borne de gauche", () => {
    const it = task({ startDate: "2026-09-06T08:00:00.000Z", due: "2026-09-08T18:00:00.000Z" });
    expect(rangeLabel(it, NOW)).toBe("Aujourd'hui – 8 sept");
  });

  it("ne rend PAS une plage quand start et due tombent le même jour", () => {
    const it = task({ startDate: "2026-09-08T08:00:00.000Z", due: "2026-09-08T18:00:00.000Z" });
    expect(rangeLabel(it, NOW)).toBe("8 sept");
  });

  it("ignore une plage inversée plutôt que d'afficher « 11 – 9 sept »", () => {
    const it = task({ startDate: "2026-09-11T08:00:00.000Z", due: "2026-09-09T18:00:00.000Z" });
    expect(rangeLabel(it, NOW)).toBe("9 sept");
  });

  it("ignore un startDate illisible", () => {
    const it = task({ startDate: "20260908T080000", due: "2026-09-08T18:00:00.000Z" });
    expect(rangeLabel(it, NOW)).toBe("8 sept");
  });

  it("suit l'occurrence déplacée dans Apple Calendar", () => {
    const it = task({
      due: "2026-09-06T10:00:00.000Z",
      rrule: "FREQ=WEEKLY;BYDAY=SU",
      overrides: { "20260906T100000Z": "20260908T100000Z" },
    });
    expect(rangeLabel(it, NOW)).toBe("8 sept");
  });
});

/* --- groupItems ----------------------------------------------------------- */

const columns: KanbanColumn[] = [
  { id: "c2", name: "En cours", order: 1 },
  { id: "c1", name: "À faire", order: 0 },
  { id: "c3", name: "Terminé", order: 2 },
];

describe("groupItems — mode colonne", () => {
  it("respecte l'ordre des colonnes, pas celui du tableau reçu", () => {
    const groups = groupItems([], "column", columns, NOW);
    expect(groups.map((g) => g.label)).toEqual(["À faire", "En cours", "Terminé"]);
  });

  it("garde les colonnes VIDES — une colonne Kanban vide reste une cible de dépôt", () => {
    const groups = groupItems([task({ columnId: "c1" })], "column", columns, NOW);
    expect(groups).toHaveLength(3);
    expect(groups[1].items).toEqual([]);
  });

  it("range dans « Non placées » une carte sans colonne", () => {
    const groups = groupItems([task({ id: "a" })], "column", columns, NOW);
    expect(groups.at(-1)).toMatchObject({ key: UNPLACED, label: "Non placées" });
  });

  it("rattrape une carte dont la colonne a été supprimée ailleurs", () => {
    // Sans ce repli, la carte n'apparaît dans AUCUN groupe : elle disparaît
    // de l'écran sans erreur.
    const groups = groupItems([task({ id: "a", columnId: "colonne-morte" })], "column", columns, NOW);
    expect(groups.at(-1)?.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("n'ajoute pas « Non placées » quand tout est rangé", () => {
    const groups = groupItems([task({ columnId: "c1" })], "column", columns, NOW);
    expect(groups.some((g) => g.key === UNPLACED)).toBe(false);
  });
});

describe("groupItems — mode temps", () => {
  it("classe par échéance et retire les groupes vides", () => {
    const items = [
      task({ id: "retard", due: "2026-09-01T10:00:00.000Z" }),
      task({ id: "auj", due: "2026-09-06T20:00:00.000Z" }),
      task({ id: "sansdate" }),
    ];
    const groups = groupItems(items, "time", [], NOW);
    expect(groups.map((g) => g.label)).toEqual(["En retard", "Aujourd'hui", "Sans échéance"]);
  });

  it("une échéance illisible tombe dans « Sans échéance », pas dans une case approchée", () => {
    const groups = groupItems([task({ due: "20260908T140000" })], "time", [], NOW);
    expect(groups.map((g) => g.label)).toEqual(["Sans échéance"]);
  });
});

/* --- Chronologie ---------------------------------------------------------- */

describe("timelineRows", () => {
  const days = dayGrid(NOW, 0, 14); // 6 → 19 septembre

  it("un item sans startDate occupe UNE colonne", () => {
    const rows = timelineRows([task({ due: "2026-09-08T18:00:00.000Z" })], days, NOW);
    expect(rows[0]).toMatchObject({ startIndex: 2, span: 1 });
  });

  it("une plage couvre les colonnes de bout en bout, bornes comprises", () => {
    const it = task({ startDate: "2026-09-08T08:00:00.000Z", due: "2026-09-10T18:00:00.000Z" });
    expect(timelineRows([it], days, NOW)[0]).toMatchObject({ startIndex: 2, span: 3 });
  });

  it("omet un item entièrement hors de la fenêtre plutôt que de l'empiler à gauche", () => {
    const it = task({ due: "2026-08-01T10:00:00.000Z" });
    expect(timelineRows([it], days, NOW)).toEqual([]);
  });

  it("omet un item sans échéance", () => {
    expect(timelineRows([task({ startDate: "2026-09-08T08:00:00.000Z" })], days, NOW)).toEqual([]);
  });

  it("coupe une plage qui déborde à gauche et le signale", () => {
    const it = task({ startDate: "2026-08-30T08:00:00.000Z", due: "2026-09-08T18:00:00.000Z" });
    const row = timelineRows([it], days, NOW)[0];
    expect(row).toMatchObject({ startIndex: 0, clippedStart: true, clippedEnd: false });
  });

  it("coupe une plage qui déborde à droite et le signale", () => {
    const it = task({ startDate: "2026-09-08T08:00:00.000Z", due: "2026-10-30T18:00:00.000Z" });
    const row = timelineRows([it], days, NOW)[0];
    expect(row).toMatchObject({ clippedEnd: true, span: 12 });
  });

  it("retombe sur l'échéance seule quand la plage est inversée", () => {
    const it = task({ startDate: "2026-09-12T08:00:00.000Z", due: "2026-09-08T18:00:00.000Z" });
    expect(timelineRows([it], days, NOW)[0]).toMatchObject({ startIndex: 2, span: 1 });
  });
});

describe("timelineDeps", () => {
  const days = dayGrid(NOW, 0, 14);

  it("relie la fin du prédécesseur au début du successeur", () => {
    const a = task({ id: "a", due: "2026-09-07T18:00:00.000Z" });
    const b = task({ id: "b", due: "2026-09-10T18:00:00.000Z", dependsOn: ["a"] });
    const deps = timelineDeps(timelineRows([a, b], days, NOW));
    expect(deps).toEqual([{ fromRow: 0, toRow: 1, fromCol: 2, toCol: 4 }]);
  });

  it("omet une dépendance dont le prédécesseur n'est pas dans la fenêtre", () => {
    const b = task({ id: "b", due: "2026-09-10T18:00:00.000Z", dependsOn: ["absent"] });
    expect(timelineDeps(timelineRows([b], days, NOW))).toEqual([]);
  });
});

/* --- Tableau de bord ------------------------------------------------------ */

describe("dashboardStats", () => {
  it("compte chaque item dans un seul statut", () => {
    const items = [
      task({ id: "a", due: "2026-09-01T10:00:00.000Z" }),
      task({ id: "b", due: "2026-09-30T10:00:00.000Z" }),
      task({ id: "c", doneAt: "2026-09-05T10:00:00.000Z" }),
    ];
    const s = dashboardStats(items, [], NOW);
    expect(s.total).toBe(3);
    expect(s.late + s.atrisk + s.ontrack + s.done).toBe(3);
    expect(s.late).toBe(1);
    expect(s.done).toBe(1);
  });

  it("rend 0 % — jamais NaN — sur un ensemble vide", () => {
    const s = dashboardStats([], [], NOW);
    expect(s.donut.every((d) => d.pct === 0)).toBe(true);
  });

  it("la courbe d'achèvement se termine AUJOURD'HUI", () => {
    const items = [
      task({ id: "a", doneAt: "2026-09-06T09:00:00.000Z" }),
      task({ id: "b", doneAt: "2026-09-05T09:00:00.000Z" }),
    ];
    const s = dashboardStats(items, [], NOW, 3);
    expect(s.completion).toEqual([0, 1, 1]);
  });

  it("reprend les groupes tels quels, ordre compris", () => {
    const groups = [
      { key: "c1", label: "À faire", items: [task({ id: "a" })] },
      { key: "c2", label: "En cours", items: [] },
    ];
    expect(dashboardStats([], groups, NOW).byGroup).toEqual([
      { key: "c1", label: "À faire", count: 1 },
      { key: "c2", label: "En cours", count: 0 },
    ]);
  });
});

describe("donutGradient", () => {
  const color = (s: string) => `#${s}`;

  it("rend la couleur de vide quand il n'y a rien à montrer", () => {
    const donut = dashboardStats([], [], NOW).donut;
    expect(donutGradient(donut, color, "#EEE")).toBe("#EEE");
  });

  it("ferme le cercle exactement à 360° — pas de liseré à la jointure", () => {
    const items = [
      task({ id: "a", due: "2026-09-01T10:00:00.000Z" }),
      task({ id: "b", due: "2026-09-30T10:00:00.000Z" }),
      task({ id: "c", due: "2026-09-30T10:00:00.000Z" }),
    ];
    const g = donutGradient(dashboardStats(items, [], NOW).donut, color, "#EEE");
    expect(g).toContain("0.00deg");
    expect(g).toContain("360.00deg");
  });

  it("saute les parts vides plutôt que d'émettre un arrêt de largeur nulle", () => {
    const items = [task({ id: "a", due: "2026-09-30T10:00:00.000Z" })];
    const g = donutGradient(dashboardStats(items, [], NOW).donut, color, "#EEE");
    expect(g).toBe("conic-gradient(#ontrack 0.00deg 360.00deg)");
  });
});
