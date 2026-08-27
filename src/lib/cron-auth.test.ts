import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireMachineToken } from "./cron-auth";

/**
 * Garde des routes machine (cron, capture, digest).
 *
 * Le query token (`?token=`) est un OPT-IN par route, réservé aux routes de
 * LECTURE machine (digest) : un appelant comme claude.ai ne peut poser que
 * des URLs nues, pas de header. Le PIN n'est jamais accepté en query, et
 * aucune route d'écriture n'active l'option.
 */

const TOKEN = "secret-digest-token-1234567890";

function makeReq(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

beforeEach(() => {
  process.env.BRIEF_DIGEST_TOKEN = TOKEN;
});

afterEach(() => {
  delete process.env.BRIEF_DIGEST_TOKEN;
  vi.unstubAllEnvs();
});

describe("requireMachineToken — header Bearer (comportement historique)", () => {
  it("accepte un Bearer valide", () => {
    const denied = requireMachineToken(
      makeReq("https://brief.example/api/digest", {
        authorization: `Bearer ${TOKEN}`,
      }),
      "BRIEF_DIGEST_TOKEN",
    );
    expect(denied).toBeNull();
  });

  it("rejette un Bearer invalide", () => {
    const denied = requireMachineToken(
      makeReq("https://brief.example/api/digest", {
        authorization: "Bearer mauvais-token",
      }),
      "BRIEF_DIGEST_TOKEN",
    );
    expect(denied?.status).toBe(401);
  });

  it("rejette sans aucun secret", () => {
    const denied = requireMachineToken(
      makeReq("https://brief.example/api/digest"),
      "BRIEF_DIGEST_TOKEN",
    );
    expect(denied?.status).toBe(401);
  });

  it("renvoie 503 si la variable d'environnement n'est pas configurée", () => {
    delete process.env.BRIEF_DIGEST_TOKEN;
    const denied = requireMachineToken(
      makeReq("https://brief.example/api/digest", {
        authorization: `Bearer ${TOKEN}`,
      }),
      "BRIEF_DIGEST_TOKEN",
    );
    expect(denied?.status).toBe(503);
  });
});

describe("requireMachineToken — query token (opt-in, lecture seule)", () => {
  it("accepte ?token= quand allowQueryToken est activé", () => {
    const denied = requireMachineToken(
      makeReq(`https://brief.example/api/digest?token=${TOKEN}`),
      "BRIEF_DIGEST_TOKEN",
      { allowQueryToken: true },
    );
    expect(denied).toBeNull();
  });

  it("rejette ?token= invalide même avec allowQueryToken", () => {
    const denied = requireMachineToken(
      makeReq("https://brief.example/api/digest?token=mauvais"),
      "BRIEF_DIGEST_TOKEN",
      { allowQueryToken: true },
    );
    expect(denied?.status).toBe(401);
  });

  it("ignore ?token= quand allowQueryToken n'est PAS activé (défaut)", () => {
    // Sans l'option, le query token ne doit pas ouvrir la porte : la requête
    // n'a pas de header → 401.
    const denied = requireMachineToken(
      makeReq(`https://brief.example/api/digest?token=${TOKEN}`),
      "BRIEF_DIGEST_TOKEN",
    );
    expect(denied?.status).toBe(401);
  });

  it("préfère le header Bearer quand les deux sont présents", () => {
    const denied = requireMachineToken(
      makeReq(`https://brief.example/api/digest?token=mauvais`, {
        authorization: `Bearer ${TOKEN}`,
      }),
      "BRIEF_DIGEST_TOKEN",
      { allowQueryToken: true },
    );
    expect(denied).toBeNull();
  });
});
