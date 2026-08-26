import { describe, expect, it } from "vitest";
import {
  filterActiveByState,
  filterAgendaItems,
  filterTasks,
  groupByProject,
  leastUrgentId,
  mondayOf,
  overdueItems,
  priorityBreakdown,
  weekOpenCounts,
  weekProgressByProject,
} from "./desktopDashboard";
import type { Item, Project } from "./types";

// Jeudi 20 août 2026, 10h Paris.
const NOW = new Date("2026-08-20T10:00:00+02:00");

function item(over: Partial<Item> = {}): Item {
  return {
    id: "i1",
    kind: "task",
    title: "Sortir les poubelles",
    projectId: "frip",
    due: "2026-08-20T09:00:00+02:00",
    allDay: false,
    priority: 3,
    rrule: null,
    status: "active",
    createdAt: "2026-08-01T00:00:00+02:00",
    remindedAt: null,
    doneAt: null,
    ...over,
  };
}

const PROJECTS: Project[] = [
  { id: "frip", name: "Frip & Trend", tint: 1 },
  { id: "flip", name: "My Flip", tint: 2 },
  { id: "perso", name: "Perso", tint: 4 },
];

describe("mondayOf", () => {
  it("renvoie le lundi de la semaine pour un jeudi", () => {
    expect(mondayOf(NOW)).toEqual({ y: 2026, m: 8, d: 17 });
  });

  it("un lundi renvoie lui-même", () => {
    const monday = new Date("2026-08-17T08:00:00+02:00");
    expect(mondayOf(monday)).toEqual({ y: 2026, m: 8, d: 17 });
  });

  it("un dimanche renvoie le lundi précédent", () => {
    const sunday = new Date("2026-08-23T22:00:00+02:00");
    expect(mondayOf(sunday)).toEqual({ y: 2026, m: 8, d: 17 });
  });
});

describe("overdueItems", () => {
  it("exclut les items faits, en idée, archivés ou sans échéance passée", () => {
    const items = [
      item({ id: "late", due: "2026-08-18T09:00:00+02:00" }),
      item({ id: "done-late", due: "2026-08-18T09:00:00+02:00", doneAt: "2026-08-18T09:30:00+02:00" }),
      item({ id: "idea-late", due: "2026-08-18T09:00:00+02:00", status: "idea" }),
      item({ id: "today", due: "2026-08-20T09:00:00+02:00" }),
      item({ id: "no-due", due: null }),
    ];
    const out = overdueItems(items, NOW);
    expect(out.map((i) => i.id)).toEqual(["late"]);
  });

  it("trie du plus ancien au plus récent", () => {
    const items = [
      item({ id: "a", due: "2026-08-17T09:00:00+02:00" }),
      item({ id: "b", due: "2026-08-15T09:00:00+02:00" }),
    ];
    expect(overdueItems(items, NOW).map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("weekProgressByProject", () => {
  it("compte faites/total par projet sur la semaine en cours, projets les plus chargés d'abord", () => {
    const items = [
      item({ id: "f1", projectId: "frip", due: "2026-08-17T09:00:00+02:00", doneAt: "2026-08-17T10:00:00+02:00" }),
      item({ id: "f2", projectId: "frip", due: "2026-08-19T09:00:00+02:00" }),
      item({ id: "f3", projectId: "frip", due: "2026-08-21T09:00:00+02:00" }),
      item({ id: "p1", projectId: "perso", due: "2026-08-18T09:00:00+02:00" }),
      // Hors semaine (lundi suivant) — ne doit pas compter.
      item({ id: "out", projectId: "frip", due: "2026-08-24T09:00:00+02:00" }),
    ];
    const out = weekProgressByProject(items, PROJECTS, NOW);
    expect(out).toEqual([
      { project: PROJECTS[0], done: 1, total: 3 },
      { project: PROJECTS[2], done: 0, total: 1 },
    ]);
  });

  it("compte aussi les RDV (kind event) dans le total et le fait", () => {
    const items = [
      item({ id: "e1", projectId: "frip", kind: "event", due: "2026-08-18T09:00:00+02:00", doneAt: "2026-08-18T10:00:00+02:00" }),
      item({ id: "e2", projectId: "frip", kind: "event", due: "2026-08-19T09:00:00+02:00" }),
      item({ id: "t1", projectId: "frip", due: "2026-08-20T09:00:00+02:00" }),
      // Idée — jamais comptée.
      item({ id: "i1", projectId: "frip", status: "idea", due: "2026-08-19T09:00:00+02:00" }),
    ];
    const out = weekProgressByProject(items, PROJECTS, NOW);
    expect(out[0]).toEqual({ project: PROJECTS[0], done: 1, total: 3 });
  });

  it("compte les OCCURRENCES des séries récurrentes (2/6 pour le sport mer+sam, lun+jeu, mar+ven)", () => {
    // Semaine du 17 au 23 août 2026 (NOW = jeudi 20). Séries :
    // - courir : mer + sam → occurrences 19 (mer), 22 (sam) — pas encore cochée
    // - push : lun + jeu → 17 (lun), 20 (jeu) — lundi fait
    // - pull : mar + ven → 18 (mar), 21 (ven) — mardi fait
    // → 2 faits sur 6, comme l'attend Aramis (« sport doit être 2/6 »).
    const items = [
      item({ id: "run", projectId: "frip", kind: "event", due: "2026-08-19T09:00:00+02:00", rrule: "FREQ=WEEKLY;BYDAY=WE,SA", seriesAnchor: "2026-08-19T09:00:00+02:00" }),
      item({ id: "push", projectId: "frip", kind: "event", due: "2026-08-17T09:00:00+02:00", rrule: "FREQ=WEEKLY;BYDAY=MO,TH", seriesAnchor: "2026-08-17T09:00:00+02:00", lastCompletedOccurrenceAt: "2026-08-17T09:00:00+02:00" }),
      item({ id: "pull", projectId: "frip", kind: "event", due: "2026-08-18T09:00:00+02:00", rrule: "FREQ=WEEKLY;BYDAY=TU,FR", seriesAnchor: "2026-08-18T09:00:00+02:00", lastCompletedOccurrenceAt: "2026-08-18T09:00:00+02:00" }),
    ];
    const out = weekProgressByProject(items, PROJECTS, NOW);
    expect(out[0]).toEqual({ project: PROJECTS[0], done: 2, total: 6 });
  });

  it("une coche en fin de semaine compte aussi les occurrences précédentes de la série (fait jusqu'à maintenant)", () => {
    // Coche du samedi → l'occurrence du mercredi de la même semaine est faite aussi.
    const items = [
      item({ id: "run", projectId: "frip", kind: "event", due: "2026-08-19T09:00:00+02:00", rrule: "FREQ=WEEKLY;BYDAY=WE,SA", seriesAnchor: "2026-08-19T09:00:00+02:00", lastCompletedOccurrenceAt: "2026-08-22T09:00:00+02:00" }),
    ];
    const out = weekProgressByProject(items, PROJECTS, NOW);
    expect(out[0]).toEqual({ project: PROJECTS[0], done: 2, total: 2 });
  });

  it("respecte la limite", () => {
    const items = [
      item({ id: "f1", projectId: "frip", due: "2026-08-17T09:00:00+02:00" }),
      item({ id: "p1", projectId: "perso", due: "2026-08-18T09:00:00+02:00" }),
      item({ id: "l1", projectId: "flip", due: "2026-08-19T09:00:00+02:00" }),
    ];
    expect(weekProgressByProject(items, PROJECTS, NOW, 2)).toHaveLength(2);
  });
});

describe("weekOpenCounts", () => {
  it("compte les tâches et RDV ouverts de la semaine lundi→dimanche, hors faits et idées", () => {
    const items = [
      item({ id: "t1", due: "2026-08-17T09:00:00+02:00" }),
      item({ id: "t2", due: "2026-08-19T09:00:00+02:00" }),
      item({ id: "t-done", due: "2026-08-18T09:00:00+02:00", doneAt: "2026-08-18T10:00:00+02:00" }),
      item({ id: "e1", kind: "event", due: "2026-08-20T09:00:00+02:00" }),
      item({ id: "idea", status: "idea", due: "2026-08-19T09:00:00+02:00" }),
      item({ id: "out", due: "2026-08-24T09:00:00+02:00" }),
    ];
    expect(weekOpenCounts(items, NOW)).toEqual({ tasks: 2, events: 1 });
  });
});

describe("filterAgendaItems", () => {
  const items = [
    item({ id: "t1" }),
    item({ id: "e1", kind: "event" }),
    item({ id: "idea", status: "idea" }),
    item({ id: "archived", status: "archived" }),
  ];

  it("all garde tâches + RDV, exclut idées et archivés", () => {
    expect(filterAgendaItems(items, "all").map((i) => i.id)).toEqual(["t1", "e1"]);
  });

  it("task ne garde que les tâches actives", () => {
    expect(filterAgendaItems(items, "task").map((i) => i.id)).toEqual(["t1"]);
  });

  it("event ne garde que les RDV", () => {
    expect(filterAgendaItems(items, "event").map((i) => i.id)).toEqual(["e1"]);
  });
});

describe("filterActiveByState", () => {
  const items = [
    item({ id: "t-today", due: "2026-08-20T09:00:00+02:00" }),
    item({ id: "e-today", kind: "event", due: "2026-08-20T09:00:00+02:00" }),
    item({ id: "t-late", due: "2026-08-18T09:00:00+02:00" }),
    item({ id: "t-done", due: "2026-08-19T09:00:00+02:00", doneAt: "2026-08-19T10:00:00+02:00" }),
    item({ id: "idea", status: "idea", due: "2026-08-20T09:00:00+02:00" }),
  ];

  it("all exclut les faites et les idées, garde tâches ET RDV", () => {
    expect(filterActiveByState(items, "all", NOW).map((i) => i.id)).toEqual(["t-today", "e-today", "t-late"]);
  });

  it("today garde les tâches et RDV du jour, non faits", () => {
    expect(filterActiveByState(items, "today", NOW).map((i) => i.id)).toEqual(["t-today", "e-today"]);
  });

  it("overdue garde les tâches et RDV en retard", () => {
    expect(filterActiveByState(items, "overdue", NOW).map((i) => i.id)).toEqual(["t-late"]);
  });

  it("done garde les faites", () => {
    expect(filterActiveByState(items, "done", NOW).map((i) => i.id)).toEqual(["t-done"]);
  });
});

describe("leastUrgentId", () => {
  it("choisit la priorité numériquement la plus haute (4 = la moins urgente)", () => {
    const out = leastUrgentId([
      { id: "urgent", priority: 1, due: "2026-08-20T09:00:00+02:00" },
      { id: "basse", priority: 4, due: "2026-08-20T10:00:00+02:00" },
      { id: "normale", priority: 3, due: "2026-08-20T08:00:00+02:00" },
    ]);
    expect(out).toBe("basse");
  });

  it("à égalité de priorité, l'échéance la plus tardive gagne", () => {
    const out = leastUrgentId([
      { id: "tot", priority: 2, due: "2026-08-20T08:00:00+02:00" },
      { id: "tard", priority: 2, due: "2026-08-20T18:00:00+02:00" },
    ]);
    expect(out).toBe("tard");
  });

  it("liste vide renvoie null", () => {
    expect(leastUrgentId([])).toBeNull();
  });
});

describe("filterTasks", () => {
  const items = [
    item({ id: "task-today", kind: "task", due: "2026-08-20T09:00:00+02:00" }),
    item({ id: "task-late", kind: "task", due: "2026-08-18T09:00:00+02:00" }),
    item({ id: "task-done", kind: "task", due: "2026-08-19T09:00:00+02:00", doneAt: "2026-08-19T10:00:00+02:00" }),
    item({ id: "event-today", kind: "event", due: "2026-08-20T09:00:00+02:00" }),
    item({ id: "task-idea", kind: "task", status: "idea", due: null }),
  ];

  it("all exclut les RDV, les idées et les faites", () => {
    expect(filterTasks(items, "all", NOW).map((i) => i.id)).toEqual(["task-today", "task-late"]);
  });

  it("today ne garde que l'échéance du jour, non faite", () => {
    expect(filterTasks(items, "today", NOW).map((i) => i.id)).toEqual(["task-today"]);
  });

  it("overdue ne garde que le retard, non fait", () => {
    expect(filterTasks(items, "overdue", NOW).map((i) => i.id)).toEqual(["task-late"]);
  });

  it("done ne garde que les faites", () => {
    expect(filterTasks(items, "done", NOW).map((i) => i.id)).toEqual(["task-done"]);
  });
});

describe("groupByProject", () => {
  it("regroupe dans l'ordre des projets, sans les projets vides", () => {
    const items = [
      item({ id: "a", projectId: "perso" }),
      item({ id: "b", projectId: "frip" }),
      item({ id: "c", projectId: "frip" }),
    ];
    const out = groupByProject(items, PROJECTS);
    expect(out.map((g) => g.project.id)).toEqual(["frip", "perso"]);
    expect(out[0].rows.map((i) => i.id)).toEqual(["b", "c"]);
  });
});

describe("priorityBreakdown", () => {
  it("compte les tâches ouvertes par priorité et calcule le pourcentage", () => {
    const items = [
      item({ id: "a", priority: 1 }),
      item({ id: "b", priority: 1 }),
      item({ id: "c", priority: 3 }),
      item({ id: "d", priority: 3, doneAt: "2026-08-19T10:00:00+02:00" }),
      item({ id: "e", kind: "event", priority: 2 }),
    ];
    const out = priorityBreakdown(items);
    expect(out).toEqual([
      { priority: 1, count: 2, pct: 67 },
      { priority: 2, count: 0, pct: 0 },
      { priority: 3, count: 1, pct: 33 },
      { priority: 4, count: 0, pct: 0 },
    ]);
  });
});
