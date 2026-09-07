import { describe, expect, it } from "vitest";
import { captureEvent, caldavEvent, newlyUnblocked, reminderEvent, unblockedEvent } from "./inbox";
import type { Item } from "./types";

const AT = new Date("2026-09-07T10:00:00.000Z");

function task(id: string, over: Partial<Item> = {}): Item {
  return {
    id,
    kind: "task",
    title: `Tâche ${id}`,
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

/* --- Dédoublonnage : la propriété qui compte -------------------------------
 *
 * Le cron passe toutes les 60 s sur les mêmes items. Un id instable produirait
 * une ligne par passage, et le journal serait inutilisable en une heure.
 * ------------------------------------------------------------------------ */

describe("stabilité des identifiants", () => {
  it("deux passages sur le même rappel donnent le MÊME id", () => {
    const it = task("a", { due: "2026-09-07T10:00:00.000Z" });
    const first = reminderEvent(it, new Date("2026-09-07T10:00:05.000Z"));
    const second = reminderEvent(it, new Date("2026-09-07T10:00:58.000Z"));
    expect(first.id).toBe(second.id);
  });

  it("deux occurrences DIFFÉRENTES de la même série donnent deux ids", () => {
    const a = reminderEvent(task("a", { due: "2026-09-07T10:00:00.000Z" }), AT);
    const b = reminderEvent(task("a", { due: "2026-09-14T10:00:00.000Z" }), AT);
    expect(a.id).not.toBe(b.id);
  });

  it("une tâche débloquée ne l'est qu'une fois, même relue plus tard", () => {
    const it = task("a");
    expect(unblockedEvent(it, AT).id).toBe(unblockedEvent(it, new Date("2026-10-01T00:00:00.000Z")).id);
  });

  it("rejouer la même dictée réutilise l'id de son premier item", () => {
    const items = [task("i1"), task("i2")];
    expect(captureEvent(items, AT)!.id).toBe(captureEvent(items, new Date("2026-09-08T00:00:00.000Z"))!.id);
  });

  it("deux adoptions CalDAV de nature différente ne se confondent pas", () => {
    const it = task("a");
    expect(caldavEvent(it, "horaire déplacé", AT).id).not.toBe(caldavEvent(it, "titre modifié", AT).id);
  });
});

/* --- Contenu -------------------------------------------------------------- */

describe("contenu des événements", () => {
  it("un rappel porte l'item et le projet, pour que la boîte puisse l'ouvrir", () => {
    const e = reminderEvent(task("a", { projectId: "sport" }), AT);
    expect(e).toMatchObject({ kind: "reminder", itemId: "a", projectId: "sport", readAt: null });
  });

  it("la dictée compte séparément les tâches et les rendez-vous", () => {
    const e = captureEvent([task("i1"), task("i2"), task("i3", { kind: "event" })], AT);
    expect(e!.body).toBe("2 tâches et 1 rendez-vous extraits de ta capture.");
  });

  it("accorde le participe : une tâche seule est « extraite »", () => {
    expect(captureEvent([task("i1")], AT)!.body).toBe("1 tâche extraite de ta capture.");
  });

  it("accorde au masculin pour des rendez-vous seuls", () => {
    const e = captureEvent([task("i1", { kind: "event" })], AT);
    expect(e!.body).toBe("1 rendez-vous extrait de ta capture.");
  });

  it("accorde au pluriel féminin pour plusieurs tâches", () => {
    expect(captureEvent([task("i1"), task("i2")], AT)!.body).toBe("2 tâches extraites de ta capture.");
  });

  it("une dictée sans item ne produit AUCUN événement", () => {
    expect(captureEvent([], AT)).toBeNull();
  });

  it("tout événement naît non lu", () => {
    expect(reminderEvent(task("a"), AT).readAt).toBeNull();
    expect(unblockedEvent(task("a"), AT).readAt).toBeNull();
    expect(caldavEvent(task("a"), "x", AT).readAt).toBeNull();
  });
});

/* --- newlyUnblocked -------------------------------------------------------- */

describe("newlyUnblocked", () => {
  it("détecte la tâche dont la dernière dépendance vient d'être cochée", () => {
    const before = [task("dep"), task("b", { dependsOn: ["dep"] })];
    const after = [task("dep", { doneAt: AT.toISOString() }), task("b", { dependsOn: ["dep"] })];
    expect(newlyUnblocked(before, after).map((i) => i.id)).toEqual(["b"]);
  });

  it("n'annonce RIEN quand la tâche était déjà prête — sinon chaque passage crie", () => {
    const before = [task("dep", { doneAt: AT.toISOString() }), task("b", { dependsOn: ["dep"] })];
    expect(newlyUnblocked(before, before)).toEqual([]);
  });

  it("ne débloque pas tant qu'une SECONDE dépendance reste à faire", () => {
    const before = [task("d1"), task("d2"), task("b", { dependsOn: ["d1", "d2"] })];
    const after = [task("d1", { doneAt: AT.toISOString() }), task("d2"), task("b", { dependsOn: ["d1", "d2"] })];
    expect(newlyUnblocked(before, after)).toEqual([]);
  });

  it("ignore une tâche sans dépendance", () => {
    const before = [task("a")];
    const after = [task("a")];
    expect(newlyUnblocked(before, after)).toEqual([]);
  });

  it("ignore une tâche qui vient elle-même d'être cochée", () => {
    // Elle n'attend plus rien parce qu'elle est finie, pas parce que sa
    // chaîne s'est libérée.
    const before = [task("dep"), task("b", { dependsOn: ["dep"] })];
    const after = [
      task("dep", { doneAt: AT.toISOString() }),
      task("b", { dependsOn: ["dep"], doneAt: AT.toISOString() }),
    ];
    expect(newlyUnblocked(before, after)).toEqual([]);
  });

  it("ignore une tâche qui vient d'être CRÉÉE déjà prête", () => {
    const before = [task("dep", { doneAt: AT.toISOString() })];
    const after = [task("dep", { doneAt: AT.toISOString() }), task("neuve", { dependsOn: ["dep"] })];
    expect(newlyUnblocked(before, after)).toEqual([]);
  });

  it("traite une dépendance vers un item DISPARU comme non faite, donc bloquante", () => {
    // Prudent : on n'annonce pas « débloquée » sur la foi d'un id qu'on ne
    // sait pas résoudre.
    const before = [task("b", { dependsOn: ["fantome"] })];
    const after = [task("b", { dependsOn: ["fantome"] })];
    expect(newlyUnblocked(before, after)).toEqual([]);
  });
});
