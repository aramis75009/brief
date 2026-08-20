import { describe, expect, it } from "vitest";
import { completionPatch } from "./completion";
import type { Item } from "./types";

/**
 * Cocher une tâche a deux façons de rater, et une seule se voit :
 *   - ne rien enregistrer : agaçant, visible, on recoche ;
 *   - éteindre une récurrence : invisible, et la tâche ne revient jamais.
 * Ces tests couvrent surtout la seconde.
 */

const NOW = new Date("2026-08-13T10:00:00+02:00");

function item(over: Partial<Item> = {}): Item {
  return {
    id: "i1",
    kind: "task",
    title: "Sortir les poubelles",
    projectId: "inbox",
    due: "2026-08-11T07:00:00+02:00",
    allDay: false,
    priority: 4,
    rrule: null,
    createdAt: "2026-08-01T00:00:00+02:00",
    remindedAt: null,
    doneAt: null,
    ...over,
  };
}

describe("completionPatch — tâche simple", () => {
  it("pose doneAt à l'instant de la coche", () => {
    const out = completionPatch(item(), true, NOW);
    expect(out.kind).toBe("done");
    expect(out.patch.doneAt).toBe(NOW.toISOString());
  });

  it("décocher efface doneAt", () => {
    const out = completionPatch(item({ doneAt: "2026-08-12T09:00:00+02:00" }), false, NOW);
    expect(out.kind).toBe("reopened");
    expect(out.patch.doneAt).toBeNull();
  });

  it("ne touche ni au titre, ni au projet, ni à la priorité", () => {
    const out = completionPatch(item(), true, NOW);
    expect(out.patch).not.toHaveProperty("title");
    expect(out.patch).not.toHaveProperty("projectId");
    expect(out.patch).not.toHaveProperty("priority");
  });
});

describe("completionPatch — tâche récurrente", () => {
  const weekly = item({ rrule: "FREQ=WEEKLY;BYDAY=TU", due: "2026-08-11T07:00:00+02:00" });

  it("avance à la prochaine occurrence AU LIEU de terminer", () => {
    const out = completionPatch(weekly, true, NOW);
    expect(out.kind).toBe("advanced");
    expect(out.patch.due).toBe(new Date("2026-08-18T07:00:00+02:00").toISOString());
  });

  it("enregistre l'occurrence PRÉCISE cochée quand `due` a déjà été avancé par le cron des rappels", () => {
    // Le rappel de 18:30 a sonné → `due` est déjà au lendemain (ou à la
    // prochaine occurrence), sans que rien n'ait été fait. Cocher l'occurrence
    // du jour (que l'UI connaît et transmet) doit enregistrer CETTE
    // occurrence comme faite, pas le `due` avancé.
    const advanced = item({
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH",
      due: "2026-08-24T16:00:00+02:00", // lundi, avancé par le cron
      overrides: { "20260820T160000Z": "20260820T170000Z" },
    });
    const out = completionPatch(advanced, true, NOW, "2026-08-20T17:00:00+02:00");
    expect(out.kind).toBe("advanced");
    expect(out.patch.lastCompletedOccurrenceAt).toBe(
      new Date("2026-08-20T17:00:00+02:00").toISOString(),
    );
  });

  it("sans occurrence précise, retombe sur `due` (comportement historique)", () => {
    const out = completionPatch(weekly, true, NOW);
    expect(out.patch.lastCompletedOccurrenceAt).toBe(
      new Date("2026-08-11T07:00:00+02:00").toISOString(),
    );
  });

  it("ne pose JAMAIS doneAt sur une récurrence encore vivante", () => {
    const out = completionPatch(weekly, true, NOW);
    // Une récurrence terminée définitivement disparaît des listes pour de bon :
    // c'est la panne silencieuse que ce test existe pour empêcher.
    expect(out.patch.doneAt ?? null).toBeNull();
  });

  it("conserve la règle de récurrence tant que la série continue", () => {
    const out = completionPatch(weekly, true, NOW);
    expect(out.patch.rrule).toBeUndefined();
  });

  it("laisse remindedAt intact — le garde-fou est relatif à l'échéance", () => {
    // `pendingReminders` ignore un item dont `remindedAt >= due`. La nouvelle
    // échéance étant postérieure, le prochain rappel sonnera sans qu'on ait à
    // réinitialiser quoi que ce soit. L'effacer perdrait la trace du dernier envoi.
    const out = completionPatch(weekly, true, NOW);
    expect(out.patch).not.toHaveProperty("remindedAt");
  });

  it("termine pour de bon quand UNTIL est dépassé", () => {
    // ⚠️ La série ne s'épuise QUE par `UNTIL`. `rrule.ts` ne décrémente pas
    // `COUNT` (il ne garde aucun état) et aucun appelant ne suit ce compteur :
    // une règle `COUNT=3` se comporte donc comme une récurrence sans fin.
    // Limitation connue et documentée, pas un défaut de cette fonction.
    const finished = item({ rrule: "FREQ=WEEKLY;BYDAY=TU;UNTIL=20260812T070000Z" });
    const out = completionPatch(finished, true, NOW);
    expect(out.kind).toBe("done");
    expect(out.patch.doneAt).toBe(NOW.toISOString());
    // On retire la récurrence plutôt que de la laisser dériver en silence,
    // exactement comme le fait le planificateur de rappels.
    expect(out.patch.rrule).toBeNull();
  });

  it("traite une échéance illisible comme une tâche simple", () => {
    const broken = item({ rrule: "FREQ=WEEKLY;BYDAY=TU", due: "pas-une-date" });
    const out = completionPatch(broken, true, NOW);
    expect(out.kind).toBe("done");
    expect(out.patch.doneAt).toBe(NOW.toISOString());
  });

  it("traite une récurrence sans échéance comme une tâche simple", () => {
    const out = completionPatch(item({ rrule: "FREQ=WEEKLY;BYDAY=TU", due: null }), true, NOW);
    expect(out.kind).toBe("done");
  });

  it("décocher une récurrence avancée ne rembobine pas l'échéance", () => {
    // Rembobiner supposerait de savoir d'où l'on vient, ce que rien n'enregistre.
    const out = completionPatch(weekly, false, NOW);
    expect(out.patch).not.toHaveProperty("due");
  });
});
