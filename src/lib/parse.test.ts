import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { structureText } from "./parse";
import type { Project } from "./types";

/**
 * `structureText` est le cœur de la structuration, appelé par DEUX portes :
 * `/api/parse` (l'app, session par cookie) et `/api/capture` (raccourci iOS,
 * jeton machine). Ces tests portent sur ce que les deux partagent : la clé
 * absente, la reprise unique, et l'échec qui doit rendre une erreur chiffrée
 * plutôt que lever.
 *
 * L'appel réseau à Groq est remplacé par un `fetch` global simulé — rien ne
 * sort de la machine pendant la suite.
 */

const PROJECTS: Project[] = [
  { id: "inbox", name: "Inbox", tint: 1, shape: "disc" },
  { id: "perso", name: "Perso", tint: 4, shape: "disc" },
];

/** Réponse Groq minimale : le contenu du message est du JSON en clair. */
function groqReply(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GROQ_API_KEY", "test-key");
  fetchMock.mockReset();
  // Les échecs de tentative sont journalisés : on garde la sortie de test lisible.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("structureText — clé absente", () => {
  it("rend 503 sans appeler Groq", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const out = await structureText("trier les cintres", PROJECTS);
    expect(out).toEqual({ error: "GROQ_API_KEY absente côté serveur.", status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("structureText — chemin nominal", () => {
  it("rend les items normalisés du modèle", async () => {
    fetchMock.mockResolvedValueOnce(
      groqReply(
        JSON.stringify({
          items: [
            {
              kind: "task",
              title: "Trier les cintres",
              due: "2026-08-12T14:00:00+02:00",
              allDay: false,
              priority: 2,
              projectId: "perso",
              rrule: null,
              status: null,
              subtasks: [],
            },
          ],
        }),
      ),
    );

    const out = await structureText("trier les cintres demain 14h", PROJECTS);
    expect("items" in out).toBe(true);
    if (!("items" in out)) return;
    expect(out.items).toHaveLength(1);
    expect(out.items[0].title).toBe("Trier les cintres");
    expect(out.items[0].projectId).toBe("perso");
    expect(out.items[0].priority).toBe(2);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("accepte une réponse encadrée de ```json et retombe sur un projet connu", async () => {
    fetchMock.mockResolvedValueOnce(
      groqReply(
        "```json\n" +
          JSON.stringify({
            items: [
              { kind: "event", title: "Déjeuner avec Paul", due: null, projectId: "inconnu" },
            ],
          }) +
          "\n```",
      ),
    );

    const out = await structureText("déjeuner avec Paul", PROJECTS);
    if (!("items" in out)) throw new Error("attendu : des items");
    expect(out.items[0].kind).toBe("event");
    // Un identifiant inventé par le modèle ne doit jamais sortir tel quel.
    expect(PROJECTS.map((p) => p.id)).toContain(out.items[0].projectId);
  });
});

describe("structureText — reprise puis échec", () => {
  it("réessaie une fois quand la première réponse est illisible", async () => {
    fetchMock
      .mockResolvedValueOnce(groqReply("ceci n'est pas du JSON"))
      .mockResolvedValueOnce(
        groqReply(JSON.stringify({ items: [{ kind: "task", title: "Sortir les poubelles" }] })),
      );

    const out = await structureText("sortir les poubelles", PROJECTS);
    if (!("items" in out)) throw new Error("attendu : des items après reprise");
    expect(out.items[0].title).toBe("Sortir les poubelles");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rend 502 après deux tentatives ratées, sans lever", async () => {
    // Une réponse NEUVE à chaque tentative : un `Response` ne se lit qu'une fois.
    fetchMock.mockImplementation(async () => new Response("boom", { status: 500 }));

    const out = await structureText("peu importe", PROJECTS);
    expect("error" in out).toBe(true);
    if (!("error" in out)) return;
    expect(out.status).toBe(502);
    expect(out.error).toContain("Structuration impossible.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rend 502 quand le modèle n'extrait aucun item", async () => {
    fetchMock.mockImplementation(async () => groqReply(JSON.stringify({ items: [] })));

    const out = await structureText("hmm", PROJECTS);
    if (!("error" in out)) throw new Error("attendu : une erreur");
    expect(out.status).toBe(502);
    expect(out.error).toContain("aucun item");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
