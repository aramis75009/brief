import { describe, expect, it } from "vitest";
import { groupItemsByTimeSections, sortItems } from "./tasks";
import type { Item } from "./types";

function mockItem(partial: Partial<Item>): Item {
  return {
    id: "it_test",
    kind: "task",
    title: "Test item",
    projectId: "frip-trend",
    due: null,
    allDay: false,
    priority: 3,
    rrule: null,
    createdAt: "2026-08-14T10:00:00.000Z",
    remindedAt: null,
    doneAt: null,
    ...partial,
  };
}

describe("tasks sorting", () => {
  it("sorts by urgency placing earlier deadlines first and prioritizing p1 over p4", () => {
    const itemA = mockItem({ id: "a", title: "A", due: "2026-08-16T12:00:00+02:00", priority: 3 });
    const itemB = mockItem({ id: "b", title: "B", due: "2026-08-15T10:00:00+02:00", priority: 2 });
    const itemC = mockItem({ id: "c", title: "C", due: "2026-08-15T10:00:00+02:00", priority: 1 });
    const itemD = mockItem({ id: "d", title: "D", due: null, priority: 1 });

    const sorted = sortItems([itemA, itemB, itemC, itemD], "urgency");
    expect(sorted.map((i) => i.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("sorts by due date placing items with deadline first in chronological order", () => {
    const item1 = mockItem({ id: "1", due: "2026-08-20T10:00:00+02:00" });
    const item2 = mockItem({ id: "2", due: null });
    const item3 = mockItem({ id: "3", due: "2026-08-15T10:00:00+02:00" });

    const sorted = sortItems([item1, item2, item3], "due");
    expect(sorted.map((i) => i.id)).toEqual(["3", "1", "2"]);
  });

  it("sorts by priority with p1 first down to p4", () => {
    const itemP1 = mockItem({ id: "p1", priority: 1 });
    const itemP2 = mockItem({ id: "p2", priority: 2 });
    const itemP3 = mockItem({ id: "p3", priority: 3 });
    const itemP4 = mockItem({ id: "p4", priority: 4 });

    const sorted = sortItems([itemP4, itemP2, itemP1, itemP3], "priority");
    expect(sorted.map((i) => i.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("groups items into time sections accurately", () => {
    const fixedNow = new Date("2026-08-15T12:00:00+02:00");
    const overdue = mockItem({ id: "o", due: "2026-08-14T10:00:00+02:00" });
    const today = mockItem({ id: "t", due: "2026-08-15T18:00:00+02:00" });
    const tomorrow = mockItem({ id: "tm", due: "2026-08-16T09:00:00+02:00" });
    const later = mockItem({ id: "l", due: "2026-08-25T15:00:00+02:00" });
    const none = mockItem({ id: "n", due: null });

    const sections = groupItemsByTimeSections([overdue, today, tomorrow, later, none], fixedNow);
    expect(sections.map((s) => s.key)).toEqual(["overdue", "today", "tomorrow", "later", "none"]);
    expect(sections[0].items[0].id).toBe("o");
    expect(sections[1].items[0].id).toBe("t");
    expect(sections[2].items[0].id).toBe("tm");
  });
});
