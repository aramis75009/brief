import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { patchItem, readItems } from "./store";
import { shiftDays, zonedParts } from "./zoned";
import type { Item } from "./types";

/**
 * Synchro CalDAV — Brief → calendrier Apple (iCloud).
 *
 * Décision Aramis du 2026-08-17 (DECISIONS.md) : la latence ~15 min est
 * acceptée, les rappels à court terme restent en Web Push dans Brief. Ce
 * module écrit les items datés comme événements dans le calendrier iCloud
 * mappé au projet de l'item (décision Aramis du 2026-08-18, DECISIONS.md) :
 * chaque projet Brief a son calendrier de destination, donc chaque couleur
 * dans l'app Calendrier identifie un domaine d'activité.
 *
 * PROPRIÉTÉS :
 *
 *   1. IDEMPOTENT. L'UID de chaque événement est `brief-<item.id>` : un second
 *      passage écrase au lieu de dupliquer. Un item terminé ou sans date est
 *      retiré du calendrier au passage suivant. Relancer le sync est inoffensif.
 *
 *   2. GARDE-FOU. Un vrai passage réseau au plus toutes les SYNC_INTERVAL_MS
 *      (timestamp persistant dans BRIEF_DATA_DIR). Le cron peut appeler la
 *      route chaque minute : en-deçà de l'intervalle, elle sort sans réseau.
 *      En cas d'échec réseau, le timestamp n'est pas écrit → le passage
 *      suivant réessaie, pas de trou silencieux.
 *
 *   3. DÉCOUVERTE. Le principal et le calendar-home-set sont découverts par
 *      PROPFIND (iCloud peut changer de serveur : l'URL en dur se casserait).
 *      La liste des calendriers du compte est lue une fois par passage, et
 *      chaque item est routé vers le calendrier de son projet (par displayname).
 *      Un projet sans calendrier connu retombe sur « Personnel » (home/).
 */

const CALDAV_ROOT = process.env.BRIEF_CALDAV_ROOT || "https://caldav.icloud.com/";
const CALDAV_USER = process.env.BRIEF_CALDAV_USER;
const CALDAV_PASSWORD = process.env.BRIEF_CALDAV_PASSWORD;
const CALENDAR_PATH = process.env.BRIEF_CALDAV_CALENDAR_PATH;
const UID_PREFIX = "brief-";
const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20 * 1000;
const DATA_DIR = process.env.BRIEF_DATA_DIR || join(process.cwd(), ".data");
const LAST_SYNC_FILE = "caldav-last-sync.json";

/**
 * Mapping projet Brief → nom du calendrier iCloud de destination.
 * Décision Aramis du 2026-08-18 : chaque projet a son calendrier (sa couleur).
 * Surchargeable par `BRIEF_CALDAV_MAPPING` (JSON) dans l'environnement.
 * Tout projet absent de la table retombe sur « Personnel » (home/).
 */
const DEFAULT_CALENDAR_MAPPING: Record<string, string> = {
  "frip-trend": "Vinted Frip&Trend",
  "my-flip": "My Flip",
  perso: "Personnel",
  sport: "Sport",
  webacademie: "Web@académie",
  ia: "IA",
};

const FALLBACK_CALENDAR = "Personnel";

function loadCalendarMapping(): Record<string, string> {
  try {
    const raw = process.env.BRIEF_CALDAV_MAPPING;
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // mapping invalide → on garde le défaut, jamais de crash silencieux
  }
  return DEFAULT_CALENDAR_MAPPING;
}

/** Nom du calendrier cible pour un projet. `null` (pas de projet) → fallback. */
export function calendarForProject(projectId: string | null | undefined): string {
  if (!projectId) return FALLBACK_CALENDAR;
  return loadCalendarMapping()[projectId] ?? FALLBACK_CALENDAR;
}

export type CalDavSyncRun = {
  skipped: boolean;
  nextSyncInSec: number | null;
  discoveredCalendar: string | null;
  desired: number;
  existing: number;
  put: number;
  adopted: number;
  deleted: number;
  /** Items marqués `doneAt` parce que leur événement a disparu du calendrier. */
  completedFromCalendar: number;
  failures: { uid: string; error: string }[];
};

function base64(plain: string): string {
  return Buffer.from(plain, "utf8").toString("base64");
}

function authHeader(): string {
  if (!CALDAV_USER || !CALDAV_PASSWORD) {
    throw new Error("BRIEF_CALDAV_USER / BRIEF_CALDAV_PASSWORD ne sont pas configurés.");
  }
  return `Basic ${base64(`${CALDAV_USER}:${CALDAV_PASSWORD}`)}`;
}

async function caldavFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: authHeader(),
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function escapeText(text: string): string {
  // RFC 5545 §3.3.11 : les retours à la ligne, virgules et points-virgules
  // sont échappés dans les valeurs TEXT.
  return text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** `20260818` — la date calendaire d'un instant, DANS Europe/Paris (règle zoned.ts). */
function icalDate(date: Date): string {
  const { y, m, d } = zonedParts(date);
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

/** `20260818T090000Z` — l'instant en UTC, format iCalendar. */
function icalUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * Construit l'événement iCalendar d'un item Brief.
 *
 * `task` datée → événement journée entière (sauf heure précise) ;
 * `event` → conserve son heure. Terminé ou sans date → `null` (rien à écrire).
 */
export function buildEventIcs(item: Item): string | null {
  if (item.doneAt) return null;
  if (!item.due) return null;

  const due = new Date(item.due);
  if (Number.isNaN(due.getTime())) return null;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Brief//FR",
    "BEGIN:VEVENT",
    `UID:${UID_PREFIX}${item.id}`,
    `DTSTAMP:${icalUtc(new Date())}`,
  ];

  if (item.allDay) {
    const end = shiftDays(zonedParts(due), 1);
    lines.push(`DTSTART;VALUE=DATE:${icalDate(due)}`);
    lines.push(
      `DTEND;VALUE=DATE:${end.y}${String(end.m).padStart(2, "0")}${String(end.d).padStart(2, "0")}`,
    );
  } else {
    lines.push(`DTSTART:${icalUtc(due)}`);
    // Durée du créneau en minutes (décision 18/08 : « toutes les tâches
    // doivent avoir un temps ») ; 60 min par défaut si absente.
    const minutes = item.durationMinutes && item.durationMinutes > 0 ? item.durationMinutes : 60;
    lines.push(`DTEND:${icalUtc(new Date(due.getTime() + minutes * 60 * 1000))}`);
  }

  lines.push(`SUMMARY:${escapeText(item.title)}`);
  if (item.notes) lines.push(`DESCRIPTION:${escapeText(item.notes)}`);
  if (item.rrule) lines.push(`RRULE:${item.rrule}`);
  // Occurrences supprimées dans l'app Calendrier (adoptées depuis le master) :
  // sans elles, le PUT suivant les réécrirait et la suppression réapparaîtrait.
  if (item.exdates && item.exdates.length > 0) {
    lines.push(`EXDATE:${item.exdates.join(",")}`);
  }
  // Priorité 1 (Brief) = priorité 1 (RFC 5545, la plus haute).
  lines.push(`PRIORITY:${item.priority}`);

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/* --- Découverte ---------------------------------------------------------- */

function propfindXml(props: { ns: "d" | "c"; name: string }[]): string {
  const prop = props.map((p) => `<${p.ns}:${p.name}/>`).join("");
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">` +
    `<d:prop>${prop}</d:prop></d:propfind>`
  );
}

function firstHref(xml: string, prop: string): string | null {
  const m = xml.match(new RegExp(`<${prop}[^>]*>\\s*<href[^>]*>([^<]*)</href>`, "i"));
  return m?.[1] ?? null;
}

/** Principal URL de l'utilisateur, ex. `/16391108573/principal/`. */
export async function discoverPrincipal(): Promise<string> {
  const res = await caldavFetch(CALDAV_ROOT, {
    method: "PROPFIND",
    headers: { Depth: "0", "Content-Type": "application/xml" },
    body: propfindXml([{ ns: "d", name: "current-user-principal" }]),
  });
  if (!res.ok) throw new Error(`PROPFIND principal HTTP ${res.status}`);
  const href = firstHref(await res.text(), "current-user-principal");
  if (!href) throw new Error("current-user-principal introuvable.");
  return href;
}

/** calendar-home-set, ex. `https://p127-caldav.icloud.com:443/16391108573/calendars/`. */
export async function discoverCalendarHome(principalHref: string): Promise<string> {
  const url = new URL(principalHref, CALDAV_ROOT).toString();
  const res = await caldavFetch(url, {
    method: "PROPFIND",
    headers: { Depth: "0", "Content-Type": "application/xml" },
    body: propfindXml([{ ns: "c", name: "calendar-home-set" }]),
  });
  if (!res.ok) throw new Error(`PROPFIND home HTTP ${res.status}`);
  const href = firstHref(await res.text(), "calendar-home-set");
  if (!href) throw new Error("calendar-home-set introuvable.");
  return href;
}

/** Calendrier cible : chemin forcé par env, sinon le calendrier `home/`. */
export async function discoverCalendarUrl(homeHref: string): Promise<string> {
  if (CALENDAR_PATH) return new URL(CALENDAR_PATH, homeHref).toString();
  // Le calendrier par défaut d'iCloud s'appelle `home/` (affiché « Personnel »).
  return new URL("home/", homeHref).toString();
}

/** Décodage des entités XML : iCloud renvoie le displayname encodé
 * (`Vinted Frip&amp;Trend` → `Vinted Frip&Trend`). */
function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Liste tous les calendriers du compte : displayname (décodé) → URL absolue.
 * Les dossiers système (inbox/outbox/notification) sont exclus.
 */
export async function discoverCalendars(homeHref: string): Promise<Map<string, string>> {
  const res = await caldavFetch(homeHref, {
    method: "PROPFIND",
    headers: { Depth: "1", "Content-Type": "application/xml" },
    body:
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" ` +
      `xmlns:ic="http://apple.com/ns/ical/">` +
      `<d:prop><d:resourcetype/><d:displayname/><ic:calendar-color/></d:prop></d:propfind>`,
  });
  if (!res.ok) throw new Error(`PROPFIND calendars HTTP ${res.status}`);

  const xml = await res.text();
  const out = new Map<string, string>();
  const responseRe = /<response[^>]*>([\s\S]*?)<\/response>/g;
  let block: RegExpExecArray | null;
  while ((block = responseRe.exec(xml)) !== null) {
    const body = block[1];
    const href = body.match(/<href[^>]*>([^<]*)<\/href>/)?.[1];
    const nameRaw = body.match(/<displayname[^>]*>([^<]*)<\/displayname>/i)?.[1];
    const isCalendar = body.includes("<collection/>") && body.includes("urn:ietf:params:xml:ns:caldav");
    if (!href || !nameRaw || !isCalendar) continue;
    const name = decodeXml(nameRaw.trim());
    // Le href peut être absolu (`/16391108573/calendars/X/`) ou relatif
    // (`home/`). `new URL(href, homeHref)` résout les deux : un href qui
    // commence par `/` s'ancre sur l'ORIGINE, pas sur le chemin du home. Il ne
    // faut PAS dépouiller ce `/` de tête, sinon on duplique le chemin du home
    // (`/16391.../calendars/16391.../`) et iCloud répond 400 au calendar-query.
    const abs = /^https?:/i.test(href) ? href : new URL(href, homeHref).toString();
    out.set(name, abs);
  }
  return out;
}

/* --- Lecture de l'existant ------------------------------------------------- */

export type RemoteEvent = { href: string; uid: string; ics: string };

/** Liste les événements déjà présents dont l'UID commence par `brief-`. */
export async function listBriefEvents(calendarUrl: string): Promise<RemoteEvent[]> {
  const res = await caldavFetch(calendarUrl, {
    method: "REPORT",
    headers: { Depth: "1", "Content-Type": "application/xml" },
    body:
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">` +
      `<d:prop><d:getetag/><c:calendar-data/></d:prop>` +
      `<c:filter><c:comp-filter name="VCALENDAR">` +
      `<c:comp-filter name="VEVENT"/></c:comp-filter></c:filter></c:calendar-query>`,
  });
  if (!res.ok) throw new Error(`calendar-query HTTP ${res.status}`);

  const xml = await res.text();
  const events: RemoteEvent[] = [];
  const responseRe = /<response[^>]*>([\s\S]*?)<\/response>/g;
  let block: RegExpExecArray | null;
  while ((block = responseRe.exec(xml)) !== null) {
    const body = block[1];
    const href = body.match(/<href[^>]*>([^<]*)<\/href>/)?.[1];
    if (!href) continue;
    // L'UID est dans le calendar-data ; on ne garde que les nôtres.
    const uid = body.match(/UID:([^\r\n]+)/)?.[1];
    if (!uid?.startsWith(UID_PREFIX)) continue;
    // On garde l'ICS complet (désencodé) : c'est la vérité qu'Aramis a posée
    // dans l'app Calendrier — elle peut différer de celle de Brief.
    const data = body.match(/<calendar-data[^>]*>([\s\S]*?)<\/calendar-data>/i);
    events.push({ href, uid, ics: data ? decodeXml(data[1]) : "" });
  }
  return events;
}

/* --- « Le calendrier gagne » (décision Aramis 18/08) -------------------- */

/** Dé-escape une valeur TEXT RFC 5545 : `\,` `\;` `\\` `\n`. */
export function unescapeText(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\([\\,;])/g, "$1");
}

/** Champs éditables d'un événement posé dans l'app Calendrier. */
export type RemoteEventFields = {
  summary: string;
  dtstart: string | null;
  dtend: string | null;
  rrule: string | null;
  /** Occurrences supprimées (EXDATE), en UTC RFC 5545. */
  exdates: string[];
};

export function parseRemoteEvent(ics: string): RemoteEventFields {
  const title = ics.match(/^SUMMARY:([^\r\n]*)/m);
  const dt = ics.match(/^DTSTART(?:;[^:]*)?:([^\r\n]+)/m);
  const de = ics.match(/^DTEND(?:;[^:]*)?:([^\r\n]+)/m);
  const rr = ics.match(/^RRULE:([^\r\n]+)/m);
  // EXDATE peut être une ligne unique (`EXDATE:20260818T160000Z`) ou une
  // ligne pliée RFC 5545 (`EXDATE:20260818T160000Z,20260819T160000Z`).
  const exdates = (ics.match(/^EXDATE(?:;[^:]*)?:([^\r\n]+)/gm) ?? [])
    .flatMap((line) => line.replace(/^EXDATE(?:;[^:]*)?:/, "").split(","))
    .map((v) => v.trim())
    .filter((v) => /^\d{8}T\d{6}Z?$/.test(v));
  return {
    summary: title ? unescapeText(title[1].trim()) : "",
    dtstart: dt ? dt[1].trim() : null,
    dtend: de ? de[1].trim() : null,
    rrule: rr ? rr[1].trim() : null,
    exdates,
  };
}

/** Le champ d'horodatage que Brief écrirait pour cet item (comparaison canonique). */
function canonicalDueField(item: Item): string | null {
  if (!item.due) return null;
  const due = new Date(item.due);
  if (Number.isNaN(due.getTime())) return null;
  return item.allDay ? icalDate(due) : icalUtc(due);
}

/** Durée en minutes d'un événement distant (DTEND − DTSTART), ou null si illisible. */
export function remoteDurationMinutes(remote: RemoteEventFields): number | null {
  if (!remote.dtstart || !remote.dtend) return null;
  const start = remote.dtstart.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  const end = remote.dtend.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!start || !end) return null;
  const s = Date.UTC(+start[1], +start[2] - 1, +start[3], +start[4], +start[5], +start[6]);
  const e = Date.UTC(+end[1], +end[2] - 1, +end[3], +end[4], +end[5], +end[6]);
  const minutes = Math.round((e - s) / 60000);
  return minutes > 0 ? minutes : null;
}

/**
 * Le DTSTART à comparer au calendrier pour savoir si Aramis l'a édité à la
 * main : `caldavSyncedDue` (ce que Brief a réellement écrit au dernier
 * passage) s'il est connu.
 *
 * S'il ne l'est pas encore (item jamais passé par cette version du code) :
 * pour une série, se rabattre sur `remote.dtstart` — on ne peut pas savoir si
 * l'écart vient d'une édition ou de l'avancement interne, et se rabattre sur
 * `due` reproduirait le bug du 18/08 (la série reculerait à chaque passage) ;
 * pour un item simple, `due` ne bouge jamais tout seul, donc s'y rabattre est
 * sûr — c'est ce qui faisait déjà fonctionner l'adoption avant ce champ.
 */
function dtstartBaseline(item: Item, remote: RemoteEventFields): string | null {
  if (item.caldavSyncedDue !== undefined && item.caldavSyncedDue !== null) {
    return item.caldavSyncedDue;
  }
  return item.rrule ? remote.dtstart : canonicalDueField(item);
}

/** Vrai si l'événement distant diffère de ce que Brief écrirait → Aramis l'a édité. */
export function remoteDiffers(item: Item, remote: RemoteEventFields): boolean {
  const remoteMinutes = remoteDurationMinutes(remote);
  const itemMinutes = item.durationMinutes && item.durationMinutes > 0 ? item.durationMinutes : 60;
  const itemExdates = item.exdates ?? [];
  const exdatesDiffer =
    remote.exdates.length !== itemExdates.length ||
    remote.exdates.some((d) => !itemExdates.includes(d)) ||
    itemExdates.some((d) => !remote.exdates.includes(d));
  return (
    remote.summary !== item.title ||
    (remote.rrule ?? null) !== (item.rrule ?? null) ||
    (remote.dtstart ?? null) !== dtstartBaseline(item, remote) ||
    (remoteMinutes !== null && remoteMinutes !== itemMinutes) ||
    exdatesDiffer
  );
}

/** `20260819T140000Z` → `2026-08-19T14:00:00Z` ; `20260819` → `2026-08-19T09:00:00+02:00` (allDay Brief). */
export function remoteDueToItem(dtstart: string): string {
  const utc = dtstart.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utc) {
    return `${utc[1]}-${utc[2]}-${utc[3]}T${utc[4]}:${utc[5]}:${utc[6]}Z`;
  }
  const day = dtstart.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (day) {
    return `${day[1]}-${day[2]}-${day[3]}T09:00:00+02:00`;
  }
  return dtstart;
}

/**
 * Patch Brief qui aligne l'item sur la version du calendrier (ou null si identique).
 *
 * Le DTSTART n'est adopté que s'il diffère de `dtstartBaseline` — ce que
 * Brief a réellement écrit au dernier passage (`caldavSyncedDue`), pas `due`
 * lui-même. `due` avance tout seul pour une série (cron des rappels, coche) ;
 * comparer à cette avance ferait passer un simple rattrapage interne pour une
 * édition d'Aramis. Comparer au dernier écrit CONNU permet, à l'inverse,
 * d'adopter une vraie édition manuelle même sur une série — le calendrier
 * gagne (décision 18/08), y compris pour les tâches récurrentes.
 */
export function calendarPatch(item: Item, remote: RemoteEventFields): Partial<Item> | null {
  const patch: Partial<Item> = {};
  if (remote.summary !== "" && remote.summary !== item.title) patch.title = remote.summary;
  if (remote.dtstart !== null && remote.dtstart !== dtstartBaseline(item, remote)) {
    patch.due = remoteDueToItem(remote.dtstart);
    patch.allDay = !remote.dtstart.includes("T");
    patch.caldavSyncedDue = remote.dtstart;
  }
  if (remote.rrule !== null && remote.rrule !== (item.rrule ?? null)) {
    patch.rrule = remote.rrule || null;
  }
  const remoteMinutes = remoteDurationMinutes(remote);
  const itemMinutes = item.durationMinutes && item.durationMinutes > 0 ? item.durationMinutes : 60;
  if (remoteMinutes !== null && remoteMinutes !== itemMinutes) {
    patch.durationMinutes = remoteMinutes;
  }
  const itemExdates = item.exdates ?? [];
  const exdatesDiffer =
    remote.exdates.length !== itemExdates.length ||
    remote.exdates.some((d) => !itemExdates.includes(d)) ||
    itemExdates.some((d) => !remote.exdates.includes(d));
  if (exdatesDiffer) {
    patch.exdates = remote.exdates.length > 0 ? remote.exdates : undefined;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/* --- Réconciliation --------------------------------------------------------
 *
 * Ce que fait `runCalDavSync` pour CHAQUE item désiré (daté, non terminé) face
 * à ce qui existe réellement dans son calendrier cible — extrait en fonction
 * pure pour être testable sans réseau, comme `remoteDiffers`/`calendarPatch`.
 * -------------------------------------------------------------------------- */

export type SyncAction =
  | { action: "create" }
  | { action: "adopt"; patch: Partial<Item> }
  | { action: "skip" }
  | { action: "complete"; patch: Partial<Item> };

/**
 * Décide quoi faire pour un item désiré face à l'événement distant (ou son
 * absence). Trois cas :
 *
 *   1. AUCUN événement distant, mais `caldavSyncedDue` est posé (Brief l'a
 *      déjà écrit avec succès à un passage précédent) → Aramis l'a supprimé
 *      dans l'app Calendrier. On ne le RECRÉE PAS — ce serait annuler sa
 *      suppression à chaque passage — on l'interprète comme « fait » côté
 *      Brief. Une série récurrente supprimée entièrement perd sa récurrence
 *      (elle ne « avance » pas, elle s'arrête), un item simple devient
 *      simplement terminé — même sémantique que `completionPatch`.
 *
 *   2. AUCUN événement distant, jamais synchronisé (`caldavSyncedDue` absent)
 *      → première écriture, `create`.
 *
 *   3. Événement distant présent : s'il diffère de ce que Brief écrirait,
 *      Aramis l'a édité à la main → `adopt` (ou `create` pour RÉPARER un
 *      distant qui diffère sans qu'aucun champ ne soit adoptable, ex. un
 *      résumé distant vide). S'il est identique, rien à faire → `skip` — sans
 *      ce cas, chaque passage réécrivait TOUS les événements même sans
 *      changement (`DTSTAMP` renouvelé à chaque PUT), ce qui n'est pas
 *      l'idempotence promise par le module.
 */
export function decideSync(item: Item, remote: RemoteEvent | undefined): SyncAction {
  if (!remote) {
    if (item.caldavSyncedDue) {
      const now = new Date().toISOString();
      return {
        action: "complete",
        patch: item.rrule ? { doneAt: now, rrule: null } : { doneAt: now },
      };
    }
    return { action: "create" };
  }

  if (!remote.ics) {
    // Trouvé par la requête mais sans `calendar-data` exploitable (réponse
    // CalDAV partielle) : impossible de savoir si Aramis l'a édité ou si
    // c'est un accroc de lecture. On réécrit, comme avant ce module — jamais
    // de `doneAt` posé sur un doute.
    return { action: "create" };
  }

  const fields = parseRemoteEvent(remote.ics);
  if (remoteDiffers(item, fields)) {
    const patch = calendarPatch(item, fields);
    if (patch) return { action: "adopt", patch };
    return { action: "create" };
  }

  return { action: "skip" };
}

/* --- Garde-fou ------------------------------------------------------------ */

async function readLastSync(): Promise<number> {
  try {
    const raw = await readFile(join(DATA_DIR, LAST_SYNC_FILE), "utf8");
    return Number(JSON.parse(raw).lastSyncAt ?? 0);
  } catch {
    return 0;
  }
}

async function writeLastSync(): Promise<void> {
  const path = join(DATA_DIR, LAST_SYNC_FILE);
  const tmp = `${path}.${process.pid}.tmp`;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(tmp, JSON.stringify({ lastSyncAt: Date.now() }), "utf8");
  await rename(tmp, path);
}

/* --- Synchro -------------------------------------------------------------- */

async function putEvent(calendarUrl: string, item: Item): Promise<void> {
  const ics = buildEventIcs(item);
  if (!ics) return;
  const uid = `${UID_PREFIX}${item.id}`;
  const res = await caldavFetch(new URL(`${uid}.ics`, calendarUrl).toString(), {
    method: "PUT",
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
    body: ics,
  });
  if (!res.ok) throw new Error(`PUT HTTP ${res.status}`);
}

async function deleteEvent(calendarUrl: string, href: string): Promise<void> {
  const res = await caldavFetch(new URL(href, calendarUrl).toString(), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`DELETE HTTP ${res.status}`);
}

/**
 * Un passage complet sur TOUS les calendriers cibles. Retourne un compte-rendu
 * chiffré, comme le cron des rappels : une sortie vide ne permettrait pas de
 * distinguer « rien à faire » de « cassé depuis trois jours ».
 */
export async function runCalDavSync(): Promise<CalDavSyncRun> {
  const lastSync = await readLastSync();
  const elapsedMs = Date.now() - lastSync;

  if (lastSync > 0 && elapsedMs < SYNC_INTERVAL_MS) {
    return {
      skipped: true,
      nextSyncInSec: Math.ceil((SYNC_INTERVAL_MS - elapsedMs) / 1000),
      discoveredCalendar: null,
      desired: 0,
      existing: 0,
      put: 0,
      adopted: 0,
      deleted: 0,
      completedFromCalendar: 0,
      failures: [],
    };
  }

  const items = await readItems();
  // Tous les items datés et non terminés, avec leur calendrier cible.
  const desired = items
    .map((i) => ({ item: i, ics: buildEventIcs(i) }))
    .filter((d): d is { item: Item; ics: string } => d.ics !== null);

  // Grouper par calendrier cible (nom) — chaque item va dans le calendrier de
  // son projet (fallback « Personnel »).
  const byCalendar = new Map<string, Item[]>();
  // uid -> calendrier cible (nom) : dit où chaque événement `brief-*` DOIT
  // vivre. Un événement trouvé ailleurs — ou dont l'uid a disparu (tâche
  // cochée, supprimée, dédatée) — est retiré du calendrier qui le contient.
  const targetByUid = new Map<string, string>();
  for (const d of desired) {
    const calName = calendarForProject(d.item.projectId);
    targetByUid.set(`${UID_PREFIX}${d.item.id}`, calName);
    const list = byCalendar.get(calName) ?? [];
    list.push(d.item);
    byCalendar.set(calName, list);
  }

  const principal = await discoverPrincipal();
  const home = await discoverCalendarHome(principal);
  const calendars = await discoverCalendars(home);
  // Le calendrier « Personnel » a toujours l'URL par défaut `home/`, même si
  // la découverte par displayname ne le remonte pas proprement.
  if (!calendars.has(FALLBACK_CALENDAR)) {
    calendars.set(FALLBACK_CALENDAR, await discoverCalendarUrl(home));
  }

  const failures: { uid: string; error: string }[] = [];
  let put = 0;
  let adopted = 0;
  let deleted = 0;
  let existing = 0;
  let completedFromCalendar = 0;
  const touched: string[] = [];

  // On balaie TOUS les calendriers découverts (pas seulement ceux qui ont
  // encore des items à écrire) : une tâche cochée qui était la dernière de son
  // calendrier doit quand même en disparaître, et un item dont le projet a
  // changé doit quitter l'ancien calendrier. `targetByUid` décide : un
  // événement `brief-*` resté dans un calendrier != sa cible est supprimé.
  const toSweep = new Set<string>([...byCalendar.keys(), ...calendars.keys()]);

  // PHASE 1 — nettoyage. On retire d'abord de chaque calendrier tout
  // événement qui n'y a plus sa place, AVANT d'écrire les nouveaux : iCloud
  // renvoie 412 (conflit) si un même UID existe déjà sur le compte (ex. l'item
  // créé à l'ancien emplacement « Personnel » puis routé vers son projet).
  // Deux passages distincts garantissent un seul exemplaire par UID.
  const readFailed = new Set<string>();
  // uid -> événement distant (avec son ICS) par calendrier : sert à la phase 2
  // pour détecter les éditions qu'Aramis a faites dans l'app Calendrier.
  const remoteByCal = new Map<string, Map<string, RemoteEvent>>();
  for (const calName of toSweep) {
    const calUrl = calendars.get(calName);
    if (!calUrl) continue;
    touched.push(calName);

    let remote: RemoteEvent[];
    try {
      remote = await listBriefEvents(calUrl);
    } catch (e) {
      readFailed.add(calName);
      const items = byCalendar.get(calName) ?? [];
      for (const it of items) {
        failures.push({ uid: `${UID_PREFIX}${it.id}`, error: e instanceof Error ? e.message : "lecture échouée" });
      }
      continue;
    }
    existing += remote.length;
    remoteByCal.set(calName, new Map(remote.map((ev) => [ev.uid, ev])));

    for (const ev of remote) {
      if (targetByUid.get(ev.uid) === calName) continue;
      try {
        await deleteEvent(calUrl, ev.href);
        deleted += 1;
      } catch (e) {
        failures.push({ uid: ev.uid, error: e instanceof Error ? e.message : "DELETE échoué" });
      }
    }
  }

  // PHASE 2 — écriture, sauf quand « le calendrier gagne » : si l'événement
  // déjà présent dans le calendrier diffère de ce que Brief écrirait, c'est
  // qu'Aramis l'a édité à la main (décalé, renommé, récurrence modifiée) →
  // on ADOPTE sa version dans l'item Brief au lieu de l'écraser.
  for (const [calName, calItems] of byCalendar) {
    const calUrl = calendars.get(calName);
    if (!calUrl) {
      // Calendrier attendu mais introuvable : on signale plutôt que d'écrire
      // n'importe où.
      for (const it of calItems) {
        failures.push({ uid: `${UID_PREFIX}${it.id}`, error: `calendrier « ${calName} » introuvable` });
      }
      continue;
    }
    if (readFailed.has(calName)) continue; // non lisible → rien à faire en phase 2

    const remotes = remoteByCal.get(calName);
    for (const it of calItems) {
      const remote = remotes?.get(`${UID_PREFIX}${it.id}`);
      const decision = decideSync(it, remote);

      if (decision.action === "skip") continue;

      if (decision.action === "complete") {
        // Supprimé par Aramis dans l'app Calendrier : on l'adopte comme
        // terminé plutôt que de le recréer au prochain passage.
        try {
          const updated = await patchItem(it.id, decision.patch);
          if (updated) completedFromCalendar += 1;
        } catch (e) {
          failures.push({
            uid: `${UID_PREFIX}${it.id}`,
            error: e instanceof Error ? e.message : "complétion échouée",
          });
        }
        continue;
      }

      if (decision.action === "adopt") {
        try {
          const updated = await patchItem(it.id, decision.patch);
          if (updated) {
            adopted += 1;
            continue; // le calendrier est déjà la vérité : rien à réécrire
          }
        } catch (e) {
          failures.push({
            uid: `${UID_PREFIX}${it.id}`,
            error: e instanceof Error ? e.message : "adoption échouée",
          });
          continue;
        }
      }

      try {
        await putEvent(calUrl, it);
        put += 1;
        // Mémorise ce que Brief vient d'écrire, pour que le prochain passage
        // distingue un futur avancement interne (due bouge, ceci ne bouge
        // pas) d'une vraie édition dans l'app Calendrier (voir dtstartBaseline).
        const synced = canonicalDueField(it);
        if (synced !== null && synced !== (it.caldavSyncedDue ?? null)) {
          await patchItem(it.id, { caldavSyncedDue: synced });
        }
      } catch (e) {
        failures.push({ uid: `${UID_PREFIX}${it.id}`, error: e instanceof Error ? e.message : "PUT échoué" });
      }
    }
  }

  // On ne marque le passage réussi qu'une fois TOUT terminé : un échec réseau
  // laisse le timestamp ancien et le passage suivant réessaie.
  if (failures.length === 0) {
    await writeLastSync();
  }

  return {
    skipped: false,
    nextSyncInSec: null,
    discoveredCalendar: touched.join(", ") || null,
    desired: desired.length,
    existing,
    put,
    adopted,
    deleted,
    completedFromCalendar,
    failures,
  };
}
