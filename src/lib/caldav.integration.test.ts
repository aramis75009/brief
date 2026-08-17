import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Test d'INTÉGRATION réseau vers iCloud — LECTURE SEULE. Il ne tourne que si
 * un `.env.local` avec les identifiants CalDAV est présent (fichier gitignoré,
 * rempli par Aramis le 2026-08-17). Sans lui, le test est sauté : la suite
 * doit rester verte sans réseau ni secret.
 *
 * Il vérifie que le code réel (pas un curl) découvre le calendrier et lit les
 * événements — sans rien écrire. L'écriture, elle, passe par le cron et n'a
 * pas sa place dans une suite de test automatique.
 */

const ENV_PATH = join(process.cwd(), ".env.local");

function loadLocalEnv(): Record<string, string> | null {
  try {
    const raw = readFileSync(ENV_PATH, "utf8");
    const vars: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) vars[m[1]] = m[2];
    }
    return Object.keys(vars).length ? vars : null;
  } catch {
    return null;
  }
}

const env = loadLocalEnv();
const credsPresent = !!(env?.["BRIEF_CALDAV_USER"] && env?.["BRIEF_CALDAV_PASSWORD"]);
const describeNet = credsPresent ? describe : describe.skip;

describeNet("intégration CalDAV iCloud (lecture seule, non lancée sans .env.local)", () => {
  it("découvre le principal et le home, et lit le calendrier sans erreur", async () => {
    process.env.BRIEF_CALDAV_USER = env!["BRIEF_CALDAV_USER"];
    process.env.BRIEF_CALDAV_PASSWORD = env!["BRIEF_CALDAV_PASSWORD"];
    process.env.BRIEF_CALDAV_CALENDAR_PATH = env!["BRIEF_CALDAV_CALENDAR_PATH"] || "";

    const { discoverPrincipal, discoverCalendarHome, discoverCalendarUrl, listBriefEvents } =
      await import("./caldav");

    const principal = await discoverPrincipal();
    expect(principal).toMatch(/principal/i);

    const home = await discoverCalendarHome(principal);
    expect(home).toContain("/calendars/");

    const calendarUrl = await discoverCalendarUrl(home);
    // Lecture seule : lister ce qui existe déjà (normalement rien, sinon des
    // restes du test curl — tous supprimés à 204).
    const events = await listBriefEvents(calendarUrl);
    expect(Array.isArray(events)).toBe(true);
  }, 30_000);
});