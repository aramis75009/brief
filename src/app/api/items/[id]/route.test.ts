import { describe, expect, it } from "vitest";
import { sanitizePatch } from "./route";

/**
 * `sanitizePatch` est le seul endroit qui décide ce qu'un PATCH `/api/items/[id]`
 * a le droit de changer. Le bug corrigé ici : `status` (idée / active / archivée)
 * n'était lu nulle part — `updateItem(id, { status: "active" })` (bouton
 * « Convertir en tâche » de l'écran Idées) partait donc pour rien, sans jamais
 * persister côté serveur. Voir `docs/handoffs/` pour le contexte complet.
 */

const KNOWN = new Set(["perso", "sport"]);
const FALLBACK = "perso";

describe("sanitizePatch — status (conversion de type)", () => {
  it("applique status: idea", () => {
    const out = sanitizePatch({ status: "idea" }, KNOWN, FALLBACK);
    expect(out.status).toBe("idea");
  });

  it("applique status: active (idée → tâche/RDV)", () => {
    const out = sanitizePatch({ status: "active" }, KNOWN, FALLBACK);
    expect(out.status).toBe("active");
  });

  it("applique status: archived", () => {
    const out = sanitizePatch({ status: "archived" }, KNOWN, FALLBACK);
    expect(out.status).toBe("archived");
  });

  it("ignore une valeur de status invalide", () => {
    const out = sanitizePatch({ status: "bogus" }, KNOWN, FALLBACK);
    expect(out.status).toBeUndefined();
  });

  it("status absent du body ne touche pas le champ", () => {
    const out = sanitizePatch({ title: "Test" }, KNOWN, FALLBACK);
    expect(out.status).toBeUndefined();
  });
});

describe("sanitizePatch — kind (task ⇄ event)", () => {
  it("applique kind: event", () => {
    expect(sanitizePatch({ kind: "event" }, KNOWN, FALLBACK).kind).toBe("event");
  });

  it("applique kind: task", () => {
    expect(sanitizePatch({ kind: "task" }, KNOWN, FALLBACK).kind).toBe("task");
  });

  it("ignore un kind invalide", () => {
    expect(sanitizePatch({ kind: "idea" }, KNOWN, FALLBACK).kind).toBeUndefined();
  });
});

describe("sanitizePatch — notes", () => {
  it("applique des notes", () => {
    expect(sanitizePatch({ notes: "Contexte utile" }, KNOWN, FALLBACK).notes).toBe(
      "Contexte utile",
    );
  });

  it("notes absentes ne touchent pas le champ", () => {
    expect(sanitizePatch({ title: "Test" }, KNOWN, FALLBACK).notes).toBeUndefined();
  });
});

describe("sanitizePatch — conversion complète type + champs associés", () => {
  it("tâche → rendez-vous avec due", () => {
    const out = sanitizePatch(
      { kind: "event", due: "2026-08-20T14:00:00+02:00", allDay: false },
      KNOWN,
      FALLBACK,
    );
    expect(out).toMatchObject({
      kind: "event",
      due: "2026-08-20T14:00:00+02:00",
      allDay: false,
    });
  });

  it("tâche/RDV → idée", () => {
    const out = sanitizePatch({ status: "idea" }, KNOWN, FALLBACK);
    expect(out).toMatchObject({ status: "idea" });
  });

  it("idée → tâche avec projet et échéance", () => {
    const out = sanitizePatch(
      { status: "active", kind: "task", projectId: "sport", due: "2026-08-21T09:00:00+02:00" },
      KNOWN,
      FALLBACK,
    );
    expect(out).toMatchObject({
      status: "active",
      kind: "task",
      projectId: "sport",
      due: "2026-08-21T09:00:00+02:00",
    });
  });
});
