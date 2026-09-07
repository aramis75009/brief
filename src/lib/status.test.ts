import { describe, expect, it } from "vitest";
import {
  effectiveDue,
  effectiveStart,
  healthOf,
  portfolioProjects,
  progressPct,
  statusOf,
  upcomingDue,
} from "./status";
import type { Item, Project } from "./types";

/* --- Fixtures ------------------------------------------------------------- */

const NOW = new Date("2026-09-07T10:00:00.000Z");

function task(over: Partial<Item> = {}): Item {
  return {
    id: "it_1",
    kind: "task",
    title: "Tâche",
    projectId: "p1",
    due: null,
    allDay: false,
    priority: 3,
    rrule: null,
    createdAt: "2026-09-01T08:00:00.000Z",
    remindedAt: null,
    doneAt: null,
    ...over,
  };
}

/* --- statusOf ------------------------------------------------------------- */

describe("statusOf", () => {
  it("rend done dès que doneAt est posé, même sur une échéance dépassée", () => {
    const it = task({ due: "2026-09-01T10:00:00.000Z", doneAt: "2026-09-02T10:00:00.000Z" });
    expect(statusOf(it, NOW)).toBe("done");
  });

  it("rend ontrack sans échéance — on n'invente pas un retard", () => {
    expect(statusOf(task(), NOW)).toBe("ontrack");
  });

  it("rend late quand l'échéance est dépassée", () => {
    expect(statusOf(task({ due: "2026-09-06T10:00:00.000Z" }), NOW)).toBe("late");
  });

  it("rend ontrack pour une échéance lointaine sans dépendance ni sous-tâche", () => {
    expect(statusOf(task({ due: "2026-09-30T10:00:00.000Z" }), NOW)).toBe("ontrack");
  });

  it("rend atrisk quand une dépendance non faite reste dans les 48 h", () => {
    const dep = task({ id: "dep", doneAt: null });
    const byId = new Map([["dep", dep]]);
    const it = task({ due: "2026-09-08T10:00:00.000Z", dependsOn: ["dep"] });
    expect(statusOf(it, NOW, byId)).toBe("atrisk");
  });

  it("ne rend PAS atrisk si la dépendance est faite", () => {
    const dep = task({ id: "dep", doneAt: "2026-09-05T10:00:00.000Z" });
    const byId = new Map([["dep", dep]]);
    const it = task({ due: "2026-09-08T10:00:00.000Z", dependsOn: ["dep"] });
    expect(statusOf(it, NOW, byId)).toBe("ontrack");
  });

  it("ne rend PAS atrisk pour une dépendance au-delà de 48 h", () => {
    const dep = task({ id: "dep" });
    const byId = new Map([["dep", dep]]);
    const it = task({ due: "2026-09-20T10:00:00.000Z", dependsOn: ["dep"] });
    expect(statusOf(it, NOW, byId)).toBe("ontrack");
  });

  it("sans byId, une tâche bloquée n'est pas déclarée à risque — repli prudent", () => {
    const it = task({ due: "2026-09-08T10:00:00.000Z", dependsOn: ["dep"] });
    expect(statusOf(it, NOW)).toBe("ontrack");
  });

  it("rend atrisk quand des sous-tâches restent dans les 24 h", () => {
    const it = task({
      due: "2026-09-07T20:00:00.000Z",
      subtasks: [
        { id: "s1", title: "a", done: true },
        { id: "s2", title: "b", done: false },
      ],
    });
    expect(statusOf(it, NOW)).toBe("atrisk");
  });

  it("ne rend PAS atrisk quand toutes les sous-tâches sont faites", () => {
    const it = task({
      due: "2026-09-07T20:00:00.000Z",
      subtasks: [{ id: "s1", title: "a", done: true }],
    });
    expect(statusOf(it, NOW)).toBe("ontrack");
  });

  it("des sous-tâches restantes à plus de 24 h ne suffisent pas", () => {
    const it = task({
      due: "2026-09-10T10:00:00.000Z",
      subtasks: [{ id: "s1", title: "a", done: false }],
    });
    expect(statusOf(it, NOW)).toBe("ontrack");
  });

  it("une échéance illisible vaut « pas d'échéance », pas un retard", () => {
    expect(statusOf(task({ due: "20260820T140000" }), NOW)).toBe("ontrack");
  });

  it("une occurrence DÉPLACÉE dans Apple Calendar n'est plus en retard", () => {
    // `due` pointe hier, mais l'override la déplace à demain : le calendrier
    // gagne (décision 2026-08-18), donc la tâche n'est pas en retard.
    const it = task({
      due: "2026-09-06T10:00:00.000Z",
      rrule: "FREQ=WEEKLY;BYDAY=SU",
      overrides: { "20260906T100000Z": "20260908T100000Z" },
    });
    expect(statusOf(it, NOW)).toBe("ontrack");
  });

  it("une occurrence SUPPRIMÉE (EXDATE) n'est jamais en retard", () => {
    const it = task({
      due: "2026-09-06T10:00:00.000Z",
      rrule: "FREQ=WEEKLY;BYDAY=SU",
      exdates: ["20260906T100000Z"],
    });
    expect(statusOf(it, NOW)).toBe("ontrack");
  });
});

/* --- effectiveDue / effectiveStart ---------------------------------------- */

describe("effectiveDue", () => {
  it("rend null sans échéance", () => {
    expect(effectiveDue(task())).toBeNull();
  });

  it("rend null sur une chaîne non parseable", () => {
    expect(effectiveDue(task({ due: "pas une date" }))).toBeNull();
  });

  it("ignore les overrides d'un item non récurrent", () => {
    const it = task({
      due: "2026-09-06T10:00:00.000Z",
      overrides: { "20260906T100000Z": "20260908T100000Z" },
    });
    expect(effectiveDue(it)?.toISOString()).toBe("2026-09-06T10:00:00.000Z");
  });
});

describe("effectiveStart", () => {
  it("rend null quand startDate est absent — on n'en fabrique pas", () => {
    expect(effectiveStart(task({ due: "2026-09-08T10:00:00.000Z" }))).toBeNull();
  });

  it("rend null sur une chaîne illisible plutôt qu'une date approchée", () => {
    expect(effectiveStart(task({ startDate: "20260908T100000" }))).toBeNull();
  });

  it("rend la date quand elle est lisible", () => {
    const it = task({ startDate: "2026-09-05T08:00:00.000Z" });
    expect(effectiveStart(it)?.toISOString()).toBe("2026-09-05T08:00:00.000Z");
  });
});

/* --- upcomingDue ---------------------------------------------------------- */

describe("upcomingDue", () => {
  it("rend l'échéance telle quelle quand elle est à venir", () => {
    const it = task({ due: "2026-09-10T10:00:00.000Z" });
    expect(upcomingDue(it, NOW)?.toISOString()).toBe("2026-09-10T10:00:00.000Z");
  });

  it("avance une série dont le due est passé", () => {
    const it = task({
      due: "2026-08-31T10:00:00.000Z",
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      seriesAnchor: "2026-08-31T10:00:00.000Z",
    });
    const next = upcomingDue(it, NOW);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThanOrEqual(NOW.getTime());
  });

  it("laisse une tâche simple en retard telle quelle", () => {
    const it = task({ due: "2026-09-01T10:00:00.000Z" });
    expect(upcomingDue(it, NOW)?.toISOString()).toBe("2026-09-01T10:00:00.000Z");
  });
});

/* --- healthOf / progressPct ----------------------------------------------- */

describe("healthOf", () => {
  it("un seul retard suffit à mettre le portefeuille en retard", () => {
    const items = [
      task({ id: "a", due: "2026-09-30T10:00:00.000Z" }),
      task({ id: "b", due: "2026-09-01T10:00:00.000Z" }),
    ];
    expect(healthOf(items, NOW)).toBe("late");
  });

  it("à risque quand rien n'est en retard mais qu'une tâche l'est", () => {
    const items = [
      task({ id: "a", due: "2026-09-30T10:00:00.000Z" }),
      task({
        id: "b",
        due: "2026-09-07T20:00:00.000Z",
        subtasks: [{ id: "s", title: "s", done: false }],
      }),
    ];
    expect(healthOf(items, NOW)).toBe("atrisk");
  });

  it("un portefeuille vide est dans les délais", () => {
    expect(healthOf([], NOW)).toBe("ontrack");
  });

  it("les tâches faites ne dégradent pas la santé", () => {
    const items = [task({ due: "2026-09-01T10:00:00.000Z", doneAt: "2026-09-02T00:00:00.000Z" })];
    expect(healthOf(items, NOW)).toBe("ontrack");
  });
});

describe("progressPct", () => {
  it("un ensemble vide vaut 0 %, jamais 100 %", () => {
    expect(progressPct([])).toBe(0);
  });

  it("compte les tâches faites", () => {
    const items = [
      task({ id: "a", doneAt: "2026-09-01T00:00:00.000Z" }),
      task({ id: "b" }),
      task({ id: "c" }),
      task({ id: "d" }),
    ];
    expect(progressPct(items)).toBe(25);
  });
});

/* --- portfolioProjects ---------------------------------------------------- */

describe("portfolioProjects", () => {
  const projects: Project[] = [
    { id: "p1", name: "Frip & Trend", tint: 1 },
    { id: "p2", name: "My Flip", tint: 2 },
    { id: "p3", name: "Archivé", tint: 3, archived: true },
  ];

  it("garde l'ordre du portefeuille, pas celui des projets", () => {
    expect(portfolioProjects(["p2", "p1"], projects).map((p) => p.id)).toEqual(["p2", "p1"]);
  });

  it("écarte un id inconnu sans lever", () => {
    expect(portfolioProjects(["p1", "disparu"], projects).map((p) => p.id)).toEqual(["p1"]);
  });

  it("écarte les projets archivés", () => {
    expect(portfolioProjects(["p3"], projects)).toEqual([]);
  });
});
