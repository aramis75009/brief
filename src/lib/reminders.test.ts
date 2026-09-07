import { afterEach, describe, expect, it, vi } from "vitest";
import { pendingReminders, runReminders } from "./reminders";
import { fakeStore } from "./testing/fake-store";
import * as webpush from "./webpush";
import type { InboxEvent, Item } from "./types";

afterEach(() => vi.restoreAllMocks());

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

  it("une échéance antérieure à seriesAnchor est une occurrence fantôme — ni ready, ni stale", () => {
    // Constaté le 19/08 au soir : due traînait derrière l'ancre fraîchement
    // figée d'une série migrée. Cette occurrence n'a jamais existé sur le
    // vrai calendrier (RFC 5545 : rien avant DTSTART) — pas de push pour elle.
    const ghost = item({
      due: "2026-08-10T09:00:00+02:00",
      seriesAnchor: "2026-08-11T09:00:00+02:00",
      rrule: "FREQ=DAILY",
    });
    const { ready, stale, beforeAnchor } = pendingReminders([ghost], NOW);
    expect(ready).toHaveLength(0);
    expect(stale).toHaveLength(0);
    expect(beforeAnchor.map((i) => i.id)).toEqual(["i1"]);
  });

  it("due === seriesAnchor suit le chemin normal (pas fantôme)", () => {
    const onAnchor = item({
      due: "2026-08-10T09:00:00+02:00",
      seriesAnchor: "2026-08-10T09:00:00+02:00",
    });
    const { ready, beforeAnchor } = pendingReminders([onAnchor], NOW);
    expect(ready.map((i) => i.id)).toEqual(["i1"]);
    expect(beforeAnchor).toHaveLength(0);
  });

  it("sans seriesAnchor, le comportement est inchangé même si due est ancien", () => {
    const noAnchor = item({ due: "2026-08-01T09:00:00+02:00" });
    const { beforeAnchor } = pendingReminders([noAnchor], NOW);
    expect(beforeAnchor).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------------------
 * Le journal — `runReminders` doit y déposer un événement par rappel PARTI.
 *
 * L'écriture est enveloppée dans un `try/catch` (un journal indisponible ne
 * doit pas faire échouer un passage dont les pushs sont déjà partis). Sans les
 * tests ci-dessous, ce `catch` avalerait aussi une régression : la fonction
 * n'écrirait plus rien et tout resterait vert.
 * ------------------------------------------------------------------------ */

describe("runReminders — journal", () => {
  /** Un store minimal, avec un espion sur `appendInbox`. */
  function harness(items: Item[]) {
    const appended: InboxEvent[][] = [];
    const patched: { id: string; patch: Partial<Item> }[][] = [];
    const store = fakeStore({
      readItems: async () => items,
      readSubscriptions: async () => [
        { endpoint: "https://push.example/x", keys: { p256dh: "k", auth: "a" }, createdAt: "2026-08-01T00:00:00Z" },
      ],
      patchItems: async (p) => {
        patched.push(p);
        return p.length;
      },
      appendInbox: async (events) => {
        appended.push(events);
        return events;
      },
    });
    return { store, appended, patched };
  }

  it("dépose un événement quand un rappel est parti", async () => {
    vi.spyOn(webpush, "sendPushToAll").mockResolvedValue([{ ok: true, endpoint: "https://push.example/x" }]);
    const { store, appended } = harness([item()]);

    const run = await runReminders(store, NOW);

    expect(run.sent).toBe(1);
    expect(appended).toHaveLength(1);
    expect(appended[0]).toHaveLength(1);
    expect(appended[0][0]).toMatchObject({ kind: "reminder", itemId: "i1", readAt: null });
  });

  it("n'écrit RIEN au journal quand l'envoi a échoué", async () => {
    // Un rappel qui n'est pas parti ne doit pas être raconté comme parti :
    // c'est exactement le genre de mensonge que la boîte doit éviter.
    vi.spyOn(webpush, "sendPushToAll").mockResolvedValue([
      { ok: false, endpoint: "https://push.example/x", status: 410, error: "refusé", gone: true },
    ]);
    const { store, appended } = harness([item()]);

    const run = await runReminders(store, NOW);

    expect(run.sent).toBe(0);
    expect(appended).toEqual([]);
  });

  it("n'écrit rien quand il n'y a aucun rappel dû", async () => {
    const { store, appended } = harness([item({ due: "2026-08-20T09:00:00+02:00" })]);
    await runReminders(store, NOW);
    expect(appended).toEqual([]);
  });

  it("un journal en panne n'empêche pas le passage de réussir", async () => {
    // Le push est déjà parti : échouer ici le nierait.
    vi.spyOn(webpush, "sendPushToAll").mockResolvedValue([{ ok: true, endpoint: "https://push.example/x" }]);
    const store = fakeStore({
      readItems: async () => [item()],
      readSubscriptions: async () => [
        { endpoint: "https://push.example/x", keys: { p256dh: "k", auth: "a" }, createdAt: "2026-08-01T00:00:00Z" },
      ],
      patchItems: async () => 1,
      appendInbox: async () => {
        throw new Error("disque plein");
      },
    });

    await expect(runReminders(store, NOW)).resolves.toMatchObject({ sent: 1 });
  });
});
