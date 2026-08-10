import { describe, expect, it } from "vitest";
import { pendingReminders } from "./reminders";
import type { Item } from "./types";

/**
 * Le planificateur a deux façons de rater, et une seule se voit :
 *   - envoyer deux fois : agaçant, visible, corrigeable ;
 *   - ne pas envoyer : invisible, et c'est tout l'intérêt du produit qui tombe.
 * Ces tests couvrent surtout la seconde.
 */

const NOW = new Date("2026-08-10T10:00:00+02:00");

function item(over: Partial<Item> = {}): Item {
  return {
    id: "i1",
    kind: "task",
    title: "Sortir les poubelles",
    projectId: "inbox",
    due: "2026-08-10T09:00:00+02:00",
    allDay: false,
    priority: 4,
    rrule: null,
    createdAt: "2026-08-01T00:00:00+02:00",
    remindedAt: null,
    doneAt: null,
    ...over,
  };
}

describe("pendingReminders", () => {
  it("retient un item dont l'échéance vient de passer", () => {
    const { ready } = pendingReminders([item()], NOW);
    expect(ready.map((i) => i.id)).toEqual(["i1"]);
  });

  it("ignore une échéance future — un rappel en avance est un rappel raté", () => {
    const { ready } = pendingReminders([item({ due: "2026-08-10T18:00:00+02:00" })], NOW);
    expect(ready).toHaveLength(0);
  });

  it("ignore un item sans échéance", () => {
    expect(pendingReminders([item({ due: null })], NOW).ready).toHaveLength(0);
  });

  it("ignore un item terminé", () => {
    const done = item({ doneAt: "2026-08-10T09:30:00+02:00" });
    expect(pendingReminders([done], NOW).ready).toHaveLength(0);
  });

  it("ne renvoie pas deux fois le même rappel", () => {
    // `remindedAt` postérieur à l'échéance : déjà traité.
    const already = item({ remindedAt: "2026-08-10T09:00:30+02:00" });
    expect(pendingReminders([already], NOW).ready).toHaveLength(0);
  });

  it("renvoie un item dont le remindedAt est ANTÉRIEUR à l'échéance courante", () => {
    // Cas d'une récurrence : notifié la semaine dernière, l'échéance a avancé.
    const recurring = item({
      due: "2026-08-10T09:00:00+02:00",
      remindedAt: "2026-08-03T09:00:10+02:00",
      rrule: "FREQ=WEEKLY;BYDAY=MO",
    });
    expect(pendingReminders([recurring], NOW).ready.map((i) => i.id)).toEqual(["i1"]);
  });

  it("rattrape un rappel manqué de deux heures — cron en panne, VPS redémarré", () => {
    const missed = item({ due: "2026-08-10T08:00:00+02:00" });
    expect(pendingReminders([missed], NOW).ready).toHaveLength(1);
  });

  it("abandonne EXPLICITEMENT un rappel de plus de six heures de retard", () => {
    // On préfère un rappel abandonné et compté à un rappel qui sonne à
    // contretemps le lendemain matin.
    const stale = item({ due: "2026-08-09T20:00:00+02:00" });
    const { ready, stale: dropped } = pendingReminders([stale], NOW);
    expect(ready).toHaveLength(0);
    expect(dropped.map((i) => i.id)).toEqual(["i1"]);
  });

  it("ignore une échéance illisible plutôt que de planter le passage entier", () => {
    const broken = item({ due: "n'importe quoi" });
    const { ready, stale } = pendingReminders([broken, item({ id: "i2" })], NOW);
    expect(ready.map((i) => i.id)).toEqual(["i2"]);
    expect(stale).toHaveLength(0);
  });
});
