import { describe, expect, it } from "vitest";
import { itemType, typeLabel, typeColors } from "./item-type";

describe("itemType", () => {
  it("task actif → task", () => {
    expect(itemType({ kind: "task", status: "active" })).toBe("task");
  });

  it("event actif → event", () => {
    expect(itemType({ kind: "event", status: "active" })).toBe("event");
  });

  it("status idea prime sur kind task", () => {
    expect(itemType({ kind: "task", status: "idea" })).toBe("idea");
  });

  it("status idea prime sur kind event", () => {
    expect(itemType({ kind: "event", status: "idea" })).toBe("idea");
  });

  it("status absent (undefined) équivaut à actif : lit kind", () => {
    expect(itemType({ kind: "task", status: undefined })).toBe("task");
  });

  it("status archived : pas une idée, retombe sur kind", () => {
    expect(itemType({ kind: "event", status: "archived" })).toBe("event");
  });
});

describe("typeLabel", () => {
  it("libellés français attendus", () => {
    expect(typeLabel("task")).toBe("Tâche");
    expect(typeLabel("event")).toBe("Rendez-vous");
    expect(typeLabel("idea")).toBe("Idée");
  });
});

describe("typeColors", () => {
  it("une paire bg/fg distincte par type", () => {
    const task = typeColors("task");
    const event = typeColors("event");
    const idea = typeColors("idea");
    expect(task.bg).not.toBe(event.bg);
    expect(event.bg).not.toBe(idea.bg);
    expect(task.bg).not.toBe(idea.bg);
  });
});
