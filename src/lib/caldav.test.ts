import { describe, expect, it } from "vitest";
import { buildEventIcs, calendarForProject } from "./caldav";
import {
  agendaWindow,
  calendarPatch,
  decideExternalSync,
  decideSync,
  parseRemoteEvent,
  postPutPatch,
  projectForCalendar,
  remoteDiffers,
  remoteDueToItem,
  toCalendarEvent,
  unescapeText,
} from "./caldav";
import type { RemoteEvent } from "./caldav";
import type { Item } from "./types";

/**
 * La conversion item Brief → événement iCalendar est ce que voit Aramis dans
 * son calendrier Apple. Une date décalée ne se voit pas dans les logs — elle
 * se voit le jour où le résumé du matin sert un rendez-vous à la mauvaise
 * date. La suite tourne en UTC (vitest.config.mts) : si ces tests passent,
 * la conversion est indépendante du fuseau de la machine.
 */

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "it_123",
    kind: "task",
    title: "Préparer la réunion",
    projectId: "p1",
    due: "2026-08-18T09:00:00+02:00",
    allDay: true,
    priority: 1,
    rrule: null,
    notes: undefined,
    createdAt: "2026-08-17T10:00:00+02:00",
    remindedAt: null,
    doneAt: null,
    ...overrides,
  };
}

describe("buildEventIcs", () => {
  it("renvoie null pour un item terminé — il disparaît du calendrier", () => {
    expect(buildEventIcs(item({ doneAt: "2026-08-17T10:05:00+02:00" }))).toBeNull();
  });

  it("renvoie null pour un item sans échéance — rien à dater", () => {
    expect(buildEventIcs(item({ due: null }))).toBeNull();
  });

  it("renvoie null pour une échéance illisible — jamais un événement approximatif", () => {
    expect(buildEventIcs(item({ due: "pas-une-date" }))).toBeNull();
  });

  it("écrit l'UID `brief-<id>` — la synchro en dépend pour l'idempotence", () => {
    const ics = buildEventIcs(item());
    expect(ics).toContain("UID:brief-it_123");
  });

  it("une tâche journée entière utilise VALUE=DATE avec la date de Paris", () => {
    const ics = buildEventIcs(item());
    // 2026-08-18T09:00:00+02:00 = le 18 août à Paris → journée du 18.
    expect(ics).toContain("DTSTART;VALUE=DATE:20260818");
    // La journée entière se termine le lendemain, exclusif.
    expect(ics).toContain("DTEND;VALUE=DATE:20260819");
  });

  it("un rende-vous horaire écrit DTSTART/DTEND en UTC avec une durée d'une heure", () => {
    const ics = buildEventIcs(
      item({
        kind: "event",
        allDay: false,
        // 14h00 à Paris (+02:00) = 12h00 UTC.
        due: "2026-08-18T14:00:00+02:00",
      }),
    );
    expect(ics).toContain("DTSTART:20260818T120000Z");
    expect(ics).toContain("DTEND:20260818T130000Z");
  });

  it("respecte durationMinutes pour un créneau de 30 minutes (décision 18/08)", () => {
    const ics = buildEventIcs(
      item({
        kind: "event",
        allDay: false,
        // 17h30 à Paris (+02:00) = 15h30 UTC → fin 16h00 UTC (30 min).
        due: "2026-08-18T17:30:00+02:00",
        durationMinutes: 30,
      }),
    );
    expect(ics).toContain("DTSTART:20260818T153000Z");
    expect(ics).toContain("DTEND:20260818T160000Z");
  });

  it("échappe les virgules, points-virgules et retours à la ligne du titre", () => {
    const ics = buildEventIcs(item({ title: "Résumé, suite ; suite\nsuite" }));
    expect(ics).toContain("SUMMARY:Résumé\\, suite \\; suite\\nsuite");
  });

  it("transmet la récurrence RFC 5545 telle quelle", () => {
    const ics = buildEventIcs(item({ rrule: "FREQ=WEEKLY;BYDAY=TU" }));
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU");
  });

  it("une série récurrente écrit son ANCRE STABLE comme DTSTART, pas `due` — le bug du 2026-08-19", () => {
    // `due` a déjà avancé (rappel du jour envoyé, cron des rappels) mais
    // l'ancre, elle, reste au premier jour de la série. Réécrire le DTSTART
    // sur `due` ferait disparaître du calendrier l'occurrence du jour dès
    // l'envoi de son rappel (RFC 5545 : rien avant DTSTART).
    const ics = buildEventIcs(
      item({
        kind: "event",
        allDay: false,
        rrule: "FREQ=WEEKLY;BYDAY=WE,SA",
        due: "2026-08-22T14:00:00Z", // avancé au samedi suivant
        seriesAnchor: "2026-08-19T14:00:00Z", // le mercredi d'origine
      }),
    );
    expect(ics).toContain("DTSTART:20260819T140000Z");
    expect(ics).not.toContain("DTSTART:20260822T140000Z");
  });

  it("une série récurrente SANS ancre encore posée se rabat sur `due` — item pas encore synchronisé", () => {
    const ics = buildEventIcs(
      item({
        kind: "event",
        allDay: false,
        rrule: "FREQ=WEEKLY;BYDAY=WE,SA",
        due: "2026-08-19T14:00:00Z",
      }),
    );
    expect(ics).toContain("DTSTART:20260819T140000Z");
  });

  it("un item non récurrent ignore `seriesAnchor` même s'il est posé — seul `due` compte", () => {
    const ics = buildEventIcs(
      item({
        kind: "event",
        allDay: false,
        rrule: null,
        due: "2026-08-19T14:00:00Z",
        seriesAnchor: "2026-08-10T09:00:00Z",
      }),
    );
    expect(ics).toContain("DTSTART:20260819T140000Z");
  });

  it("écrit la priorité Brief (1 = la plus haute) en PRIORITY iCalendar", () => {
    expect(buildEventIcs(item({ priority: 1 }))).toContain("PRIORITY:1");
    expect(buildEventIcs(item({ priority: 4 }))).toContain("PRIORITY:4");
  });
});

describe("calendarForProject", () => {
  it("route chaque projet Brief vers son calendrier Apple", () => {
    expect(calendarForProject("frip-trend")).toBe("Vinted Frip&Trend");
    expect(calendarForProject("my-flip")).toBe("My Flip");
    expect(calendarForProject("perso")).toBe("Personnel");
    expect(calendarForProject("sport")).toBe("Sport");
    expect(calendarForProject("webacademie")).toBe("Web@académie");
    expect(calendarForProject("ia")).toBe("IA");
  });

  it("retombe sur Personnel pour un projet inconnu ou absent", () => {
    expect(calendarForProject("projet-inconnu")).toBe("Personnel");
    expect(calendarForProject(null)).toBe("Personnel");
    expect(calendarForProject(undefined)).toBe("Personnel");
  });
});

describe("« le calendrier gagne » — édition faite dans l'app Calendrier (décision 18/08)", () => {
  it("parse les champs éditables d'un événement distant", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:brief-x\r\n" +
      "DTSTART;VALUE=DATE:20260819\r\nSUMMARY:Séance push\r\n" +
      "RRULE:FREQ=WEEKLY;BYDAY=MO,TH,SU\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(parseRemoteEvent(ics)).toEqual({
      summary: "Séance push",
      dtstart: "20260819",
      dtend: null,
      rrule: "FREQ=WEEKLY;BYDAY=MO,TH,SU",
      exdates: [],
    });
  });

  it("parse les EXDATE (occurrences supprimées dans l'app Calendrier), y compris pliées", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:brief-x\r\n" +
      "DTSTART:20260817T160000Z\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH\r\n" +
      "EXDATE:20260818T160000Z,20260819T160000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(parseRemoteEvent(ics).exdates).toEqual([
      "20260818T160000Z",
      "20260819T160000Z",
    ]);
  });

  it("détecte qu'un horaire distant discorde de celui de Brief (édition manuelle)", () => {
    const it = item({ allDay: false, due: "2026-08-18T14:00:00+02:00" });
    expect(remoteDiffers(it, { summary: it.title, dtstart: "20260818T120000Z", dtend: "20260818T130000Z", rrule: null, exdates: [] })).toBe(false);
    expect(remoteDiffers(it, { summary: it.title, dtstart: "20260818T150000Z", dtend: "20260818T160000Z", rrule: null, exdates: [] })).toBe(true);
  });

  it("détecte une occurrence supprimée dans le calendrier (EXDATE) — le bug des tâches réapparues", () => {
    const it = item({
      allDay: false,
      due: "2026-08-17T16:00:00Z",
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH",
      durationMinutes: 30,
    });
    const remote = {
      summary: it.title,
      dtstart: "20260817T160000Z",
      dtend: "20260817T163000Z",
      rrule: it.rrule,
      exdates: ["20260818T160000Z"],
    };
    expect(remoteDiffers(it, remote)).toBe(true);
    const patch = calendarPatch(it, remote);
    expect(patch).toEqual({ exdates: ["20260818T160000Z"] });
  });

  it("produit le patch qui aligne Brief sur le calendrier (horaire décalé)", () => {
    const it = item({ allDay: false, due: "2026-08-18T14:00:00+02:00" });
    const patch = calendarPatch(it, { summary: it.title, dtstart: "20260818T180000Z", dtend: "20260818T190000Z", rrule: null, exdates: [] });
    expect(patch).toEqual({
      due: "2026-08-18T18:00:00Z",
      allDay: false,
      caldavSyncedDue: "20260818T180000Z",
    });
  });

  it("adopte un horaire édité dans le calendrier pour une SÉRIE, si ça diffère du dernier envoi connu de Brief", () => {
    // Contrairement à l'ancien comportement (18/08), une série n'est plus
    // exclue de l'adoption : `caldavSyncedDue` (posé au dernier PUT réussi)
    // sert de référence à la place de `due`, qui lui avance tout seul.
    const it = item({
      allDay: false,
      due: "2026-08-19T16:00:00Z",
      rrule: "FREQ=WEEKLY;BYDAY=WE,SA",
      durationMinutes: 60,
      caldavSyncedDue: "20260819T160000Z",
    });
    const remote = {
      summary: it.title,
      // Aramis a décalé la séance du jour de 18h à 19h (Paris).
      dtstart: "20260819T170000Z",
      dtend: "20260819T180000Z",
      rrule: it.rrule,
      exdates: [],
    };
    expect(remoteDiffers(it, remote)).toBe(true);
    expect(calendarPatch(it, remote)).toEqual({
      due: "2026-08-19T17:00:00Z",
      allDay: false,
      caldavSyncedDue: "20260819T170000Z",
      // Le nouveau DTSTART devient aussi la nouvelle ancre stable de la
      // série (sinon le prochain avancement interne de `due` la ferait
      // dériver vers l'ancienne valeur qu'on vient de remplacer).
      seriesAnchor: "2026-08-19T17:00:00Z",
    });
  });

  it("ignore l'avancement interne d'une série même avec caldavSyncedDue posé, tant que le calendrier n'a pas rattrapé", () => {
    // `due` a avancé (cron des rappels) mais Brief n'a pas encore réécrit
    // iCloud à ce passage-ci : le calendrier reflète encore l'ancien envoi.
    // Ce n'est pas une édition d'Aramis — dtstartBaseline doit l'ignorer.
    const it = item({
      allDay: false,
      due: "2026-08-20T16:00:00Z",
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH",
      durationMinutes: 30,
      caldavSyncedDue: "20260819T160000Z",
    });
    const remote = {
      summary: it.title,
      dtstart: "20260819T160000Z",
      dtend: "20260819T163000Z",
      rrule: it.rrule,
      exdates: [],
    };
    expect(remoteDiffers(it, remote)).toBe(false);
    expect(calendarPatch(it, remote)).toBeNull();
  });

  it("une édition manuelle du DTSTART d'une série fige la nouvelle valeur comme ancre stable", () => {
    // Aramis décale la séance à la main : le calendrier gagne, et le nouveau
    // DTSTART devient la référence pour tous les PUT futurs — sinon le
    // prochain avancement interne de `due` la ferait dériver à nouveau.
    const it = item({
      allDay: false,
      due: "2026-08-19T16:00:00Z",
      rrule: "FREQ=WEEKLY;BYDAY=WE,SA",
      durationMinutes: 60,
      caldavSyncedDue: "20260819T160000Z",
      seriesAnchor: "2026-08-19T16:00:00Z",
    });
    const remote = {
      summary: it.title,
      dtstart: "20260819T170000Z",
      dtend: "20260819T180000Z",
      rrule: it.rrule,
      exdates: [],
    };
    expect(calendarPatch(it, remote)).toEqual({
      due: "2026-08-19T17:00:00Z",
      allDay: false,
      caldavSyncedDue: "20260819T170000Z",
      seriesAnchor: "2026-08-19T17:00:00Z",
    });
  });

  it("l'adoption d'un item non récurrent ne pose jamais `seriesAnchor`", () => {
    const it = item({ allDay: false, due: "2026-08-18T14:00:00+02:00" });
    const remote = {
      summary: it.title,
      dtstart: "20260818T180000Z",
      dtend: "20260818T190000Z",
      rrule: null,
      exdates: [],
    };
    const patch = calendarPatch(it, remote);
    expect(patch).not.toBeNull();
    expect(patch?.seriesAnchor).toBeUndefined();
  });

  it("ajoute la récurrence posée dans le calendrier", () => {
    const it = item();
    const patch = calendarPatch(it, {
      summary: it.title,
      dtstart: "20260818",
      dtend: null,
      rrule: "FREQ=WEEKLY;BYDAY=WE,SA",
      exdates: [],
    });
    expect(patch).toEqual({ rrule: "FREQ=WEEKLY;BYDAY=WE,SA" });
  });

  it("renvoie null si le calendrier est identique à Brief (rien à adopter)", () => {
    const it = item();
    expect(calendarPatch(it, { summary: it.title, dtstart: "20260818", dtend: null, rrule: null, exdates: [] })).toBeNull();
  });

  it("ne réadopte PAS l'ancre DTSTART d'une série avancée — le bug des tâches bloquées sur hier", () => {
    // Le cron a avancé `due` à l'occurrence courante (19/08) ; le master
    // iCloud garde l'ancre d'origine (17/08). Réadopter l'ancre ramènerait
    // la série en arrière à chaque passage.
    const it = item({
      allDay: false,
      due: "2026-08-19T16:00:00Z",
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH",
      durationMinutes: 30,
    });
    const remote = {
      summary: it.title,
      dtstart: "20260817T160000Z",
      dtend: "20260817T163000Z",
      rrule: it.rrule,
      exdates: [],
    };
    expect(remoteDiffers(it, remote)).toBe(false);
    expect(calendarPatch(it, remote)).toBeNull();
  });

  it("écrit les EXDATE dans l'ICS — le PUT ne réécrit plus les occurrences supprimées", () => {
    const ics = buildEventIcs(
      item({
        allDay: false,
        due: "2026-08-17T16:00:00Z",
        rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH",
        exdates: ["20260818T160000Z"],
      }),
    );
    expect(ics).toContain("EXDATE:20260818T160000Z");
  });

  it("dé-escape les titres RFC 5545", () => {
    expect(unescapeText("A\\, B \\; C \\n D")).toBe("A, B ; C \n D");
    expect(remoteDueToItem("20260819T140000Z")).toBe("2026-08-19T14:00:00Z");
    expect(remoteDueToItem("20260819")).toBe("2026-08-19T09:00:00+02:00");
  });

  it("convertit un DTSTART flottant (sans Z) en ISO avec l'heure de Paris — ne renvoie jamais une chaîne que new Date() ne sait pas lire", () => {
    expect(remoteDueToItem("20260820T140000")).toBe("2026-08-20T14:00:00+02:00");
    expect(remoteDueToItem("20260901T000000")).toBe("2026-09-01T00:00:00+02:00");
  });
});

describe("decideSync — réconciliation Apple Calendar ↔ Brief", () => {
  function remote(overrides: Partial<RemoteEvent> = {}): RemoteEvent {
    return { href: "/x.ics", uid: "brief-it_123", ics: "BEGIN:VEVENT\r\nEND:VEVENT", ...overrides };
  }

  it("n'écrase pas le calendrier quand rien n'a changé — sinon la synchro n'est jamais idempotente", () => {
    // DTSTART allDay identique à ce que Brief écrirait pour ce même item.
    const it2 = item(); // due 2026-08-18T09:00:00+02:00, allDay
    const remoteIcs =
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:brief-it_123\r\n" +
      "DTSTART;VALUE=DATE:20260818\r\nSUMMARY:Préparer la réunion\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(decideSync(it2, remote({ ics: remoteIcs }))).toEqual({ action: "skip" });
  });

  it("adopte une édition manuelle détectée dans le calendrier (horaire décalé)", () => {
    const it2 = item({ allDay: false, due: "2026-08-18T14:00:00+02:00" });
    const remoteIcs =
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:brief-it_123\r\n" +
      "DTSTART:20260818T180000Z\r\nDTEND:20260818T190000Z\r\nSUMMARY:Préparer la réunion\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const decision = decideSync(it2, remote({ ics: remoteIcs }));
    expect(decision.action).toBe("adopt");
    if (decision.action === "adopt") {
      expect(decision.patch).toEqual({
        due: "2026-08-18T18:00:00Z",
        allDay: false,
        caldavSyncedDue: "20260818T180000Z",
      });
    }
  });

  it("le bug des tâches réapparues : un item absent du calendrier mais JAMAIS synchronisé n'est pas marqué terminé", () => {
    // `caldavSyncedDue` absent = ce passage écrirait l'événement pour la
    // première fois : son absence ne veut PAS dire qu'Aramis l'a supprimé.
    const it2 = item({ caldavSyncedDue: undefined });
    expect(decideSync(it2, undefined)).toEqual({ action: "create" });
  });

  it("un item disparu du calendrier après avoir été synchronisé est adopté comme terminé, pas recréé", () => {
    const it2 = item({ caldavSyncedDue: "20260818" });
    const decision = decideSync(it2, undefined);
    expect(decision.action).toBe("complete");
    if (decision.action === "complete") {
      expect(decision.patch.doneAt).toBeTruthy();
      expect(decision.patch.rrule).toBeUndefined();
    }
  });

  it("une SÉRIE disparue entièrement du calendrier arrête la récurrence au lieu de la recréer", () => {
    const it2 = item({
      rrule: "FREQ=WEEKLY;BYDAY=WE,SA",
      caldavSyncedDue: "20260819T160000Z",
    });
    const decision = decideSync(it2, undefined);
    expect(decision.action).toBe("complete");
    if (decision.action === "complete") {
      expect(decision.patch.rrule).toBeNull();
      expect(decision.patch.doneAt).toBeTruthy();
    }
  });

  it("répare (recrée) un événement distant qui diffère sans rien avoir d'adoptable (résumé distant vide)", () => {
    const it2 = item();
    const remoteIcs =
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:brief-it_123\r\n" +
      "DTSTART;VALUE=DATE:20260818\r\nEND:VEVENT\r\nEND:VCALENDAR"; // pas de SUMMARY
    expect(decideSync(it2, remote({ ics: remoteIcs }))).toEqual({ action: "create" });
  });

  it("une deuxième synchro sans rien changer ne PUT plus rien (idempotence) : create puis skip", () => {
    const it2 = item({ allDay: false, due: "2026-08-18T14:00:00+02:00" });
    // Passage 1 : rien côté calendrier → création.
    expect(decideSync(it2, undefined).action).toBe("create");
    // Passage 2 : l'événement écrit au passage 1 existe maintenant, identique.
    const synced = { ...it2, caldavSyncedDue: "20260818T120000Z" };
    const remoteIcs =
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:brief-it_123\r\n" +
      "DTSTART:20260818T120000Z\r\nDTEND:20260818T130000Z\r\nSUMMARY:Préparer la réunion\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(decideSync(synced, remote({ ics: remoteIcs })).action).toBe("skip");
  });
});

describe("postPutPatch — ce que Brief mémorise juste après un PUT réussi", () => {
  it("fige `due` comme ancre stable au tout premier PUT d'une série — plus jamais réécrite ensuite", () => {
    const it = item({
      allDay: false,
      due: "2026-08-19T16:00:00Z",
      rrule: "FREQ=WEEKLY;BYDAY=WE,SA",
      durationMinutes: 60,
    });
    expect(postPutPatch(it)).toEqual({
      caldavSyncedDue: "20260819T160000Z",
      seriesAnchor: "2026-08-19T16:00:00Z",
    });
  });

  it("ne touche plus `seriesAnchor` une fois posé, même quand `due` a avancé", () => {
    // Le cron des rappels a avancé `due` au samedi ; l'ancre, elle, reste au
    // mercredi d'origine — sinon le calendrier perdrait l'occurrence du jour.
    const it = item({
      allDay: false,
      due: "2026-08-22T14:00:00Z",
      rrule: "FREQ=WEEKLY;BYDAY=WE,SA",
      durationMinutes: 60,
      caldavSyncedDue: "20260819T140000Z",
      seriesAnchor: "2026-08-19T14:00:00Z",
    });
    expect(postPutPatch(it)).toBeNull();
  });

  it("un item non récurrent ne pose jamais `seriesAnchor`", () => {
    const it = item({ allDay: false, due: "2026-08-18T14:00:00+02:00" });
    expect(postPutPatch(it)).toEqual({ caldavSyncedDue: "20260818T120000Z" });
  });
});

describe("toCalendarEvent — événements posés directement dans l'app Calendrier", () => {
  function remoteEvent(ics: string, uid = "91A2AEE9-AD19-42EB-AD7E-ABFF79178A86"): RemoteEvent {
    return { href: `/${uid}.ics`, uid, ics };
  }

  it("reconnaît un événement posé DIRECTEMENT dans l'app Calendrier (pas d'UID brief-*)", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n" +
      "UID:91A2AEE9-AD19-42EB-AD7E-ABFF79178A86\r\n" +
      "DTSTART;VALUE=DATE:20260820\r\nSUMMARY:Rentre Jeanne\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const ev = toCalendarEvent(remoteEvent(ics), "Personnel");
    expect(ev).toEqual({
      uid: "91A2AEE9-AD19-42EB-AD7E-ABFF79178A86",
      briefItemId: null,
      calendar: "Personnel",
      title: "Rentre Jeanne",
      start: "2026-08-20T07:00:00.000Z", // 09:00 Paris par défaut pour une journée entière
      allDay: true,
      durationMinutes: null,
      rrule: null,
    });
  });

  it("reconnaît un événement `brief-*` et retrouve l'id de l'item", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:brief-it_123\r\n" +
      "DTSTART:20260820T140000Z\r\nDTEND:20260820T150000Z\r\nSUMMARY:Séance push\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const ev = toCalendarEvent(remoteEvent(ics, "brief-it_123"), "Sport");
    expect(ev?.briefItemId).toBe("it_123");
    expect(ev?.durationMinutes).toBe(60);
    expect(ev?.allDay).toBe(false);
  });

  it("rend null pour un événement sans DTSTART ou sans titre — jamais un fantôme daté au hasard", () => {
    const noStart = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nSUMMARY:Sans date\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(toCalendarEvent(remoteEvent(noStart), "Personnel")).toBeNull();

    const noTitle = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nDTSTART:20260820T140000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(toCalendarEvent(remoteEvent(noTitle), "Personnel")).toBeNull();
  });

  it("rend null pour un ICS vide (réponse CalDAV partielle)", () => {
    expect(toCalendarEvent(remoteEvent(""), "Personnel")).toBeNull();
  });

  it("porte la RRULE telle quelle, pour que l'agenda l'étende lui-même", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nDTSTART:20260817T140000Z\r\n" +
      "SUMMARY:Séance pull\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,TH\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(toCalendarEvent(remoteEvent(ics), "Sport")?.rrule).toBe("FREQ=WEEKLY;BYDAY=MO,TH");
  });
});

describe("agendaWindow — l'incident du 2026-08-19 (145 tâches parasites)", () => {
  it("borne à 30 jours dans le passé et 180 jours dans le futur — jamais l'historique entier d'un calendrier", () => {
    const now = new Date("2026-08-19T18:00:00Z");
    const { start, end } = agendaWindow(now);
    expect(start.toISOString()).toBe("2026-07-20T18:00:00.000Z");
    expect(end.toISOString()).toBe("2027-02-15T18:00:00.000Z");
  });
});

describe("projectForCalendar", () => {
  it("route chaque calendrier connu vers son projet — l'inverse de calendarForProject", () => {
    expect(projectForCalendar("Personnel")).toBe("perso");
    expect(projectForCalendar("Sport")).toBe("sport");
    expect(projectForCalendar("Web@académie")).toBe("webacademie");
  });

  it("rend null pour un calendrier inconnu (Permis, Fake, Fêtes de France…)", () => {
    expect(projectForCalendar("Permis")).toBeNull();
  });
});

describe("decideExternalSync — adoption des événements posés dans Calendrier (décision Aramis 2026-08-19)", () => {
  function remoteEvent(ics: string, uid = "91A2AEE9-AD19-42EB-AD7E-ABFF79178A86"): RemoteEvent {
    return { href: `/${uid}.ics`, uid, ics };
  }
  function adopted(overrides: Partial<Item> = {}): Item {
    return {
      id: "caldav-91A2AEE9-AD19-42EB-AD7E-ABFF79178A86",
      kind: "task",
      title: "Rentre Jeanne",
      projectId: "perso",
      due: "2026-08-20T09:00:00+02:00",
      allDay: true,
      priority: 4,
      rrule: null,
      createdAt: "2026-08-19T18:00:00Z",
      remindedAt: null,
      doneAt: null,
      externalUid: "91A2AEE9-AD19-42EB-AD7E-ABFF79178A86",
      externalCalendar: "Personnel",
      ...overrides,
    };
  }

  it("adopte un événement jamais vu comme une VRAIE tâche Brief — pas de tri bruit/signal", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:91A2AEE9-AD19-42EB-AD7E-ABFF79178A86\r\n" +
      "DTSTART;VALUE=DATE:20260820\r\nSUMMARY:Rentre Jeanne\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const decision = decideExternalSync(undefined, remoteEvent(ics), "Personnel", "perso");
    expect(decision.action).toBe("create");
    if (decision.action === "create") {
      expect(decision.item).toMatchObject({
        kind: "task",
        title: "Rentre Jeanne",
        projectId: "perso",
        allDay: true,
        externalUid: "91A2AEE9-AD19-42EB-AD7E-ABFF79178A86",
        externalCalendar: "Personnel",
      });
    }
  });

  it("UID tombstoné (item adopté supprimé côté Brief) → supprime l'événement distant au lieu de le recréer", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:91A2AEE9-AD19-42EB-AD7E-ABFF79178A86\r\n" +
      "DTSTART;VALUE=DATE:20260820\r\nSUMMARY:Rentre Jeanne\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const decision = decideExternalSync(undefined, remoteEvent(ics), "Personnel", "perso", true);
    expect(decision).toEqual({ action: "delete-remote" });
  });

  it("UID tombstoné mais événement déjà absent → noop, rien à supprimer", () => {
    expect(decideExternalSync(undefined, undefined, "Personnel", "perso", true)).toEqual({ action: "noop" });
  });

  it("ne fait rien si l'événement est illisible et jamais adopté — jamais de tâche fantôme", () => {
    const noTitle = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nDTSTART:20260820T090000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(decideExternalSync(undefined, remoteEvent(noTitle), "Personnel", "perso")).toEqual({ action: "noop" });
    expect(decideExternalSync(undefined, undefined, "Personnel", "perso")).toEqual({ action: "noop" });
  });

  it("le calendrier gagne TOUJOURS pour un item adopté actif — titre édité dans Calendrier", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:91A2AEE9-AD19-42EB-AD7E-ABFF79178A86\r\n" +
      "DTSTART;VALUE=DATE:20260820\r\nSUMMARY:Rentre Jeanne (vol retardé)\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const decision = decideExternalSync(adopted(), remoteEvent(ics), "Personnel", "perso");
    expect(decision).toEqual({ action: "update", patch: { title: "Rentre Jeanne (vol retardé)" } });
  });

  it("rien à faire si l'item adopté et l'événement sont déjà identiques", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:91A2AEE9-AD19-42EB-AD7E-ABFF79178A86\r\n" +
      "DTSTART;VALUE=DATE:20260820\r\nSUMMARY:Rentre Jeanne\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(decideExternalSync(adopted(), remoteEvent(ics), "Personnel", "perso")).toEqual({ action: "noop" });
  });

  it("le bug « Relancer Anais » côté externe : événement disparu de Calendrier → item adopté marqué terminé, jamais recréé", () => {
    expect(decideExternalSync(adopted(), undefined, "Personnel", "perso")).toEqual({ action: "complete" });
  });

  it("item adopté coché dans Brief, événement encore présent → supprime l'événement d'origine", () => {
    const done = adopted({ doneAt: "2026-08-19T20:00:00Z" });
    const ics =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:91A2AEE9-AD19-42EB-AD7E-ABFF79178A86\r\n" +
      "DTSTART;VALUE=DATE:20260820\r\nSUMMARY:Rentre Jeanne\r\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(decideExternalSync(done, remoteEvent(ics), "Personnel", "perso")).toEqual({ action: "delete-remote" });
  });

  it("item adopté coché ET événement déjà absent → convergé, rien à faire", () => {
    const done = adopted({ doneAt: "2026-08-19T20:00:00Z" });
    expect(decideExternalSync(done, undefined, "Personnel", "perso")).toEqual({ action: "noop" });
  });

  it("un item `brief-*` n'est JAMAIS écrit dans le calendrier — buildEventIcs l'exclut", () => {
    const it = adopted({ externalUid: "91A2AEE9-AD19-42EB-AD7E-ABFF79178A86" });
    expect(buildEventIcs(it)).toBeNull();
  });
});