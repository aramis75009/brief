import { requirePin } from "@/lib/guard";
import { PROJECT_HINTS, inboxIdOf, isPrioValue } from "@/lib/todoist";
import type { PrioValue, Project, TodoistTask } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 40_000;
const MAX_TASKS = 8;

function systemPrompt(projects: Project[]): string {
  const list = projects
    .map((p) => {
      const hints = PROJECT_HINTS[p.name.trim().toLowerCase()];
      return hints?.length
        ? `- id "${p.id}" — ${p.name} — concerne : ${hints.join(", ")}`
        : `- id "${p.id}" — ${p.name}`;
    })
    .join("\n");

  return `Tu convertis une note vocale en français en tâches Todoist.

Projets disponibles (recopie l'identifiant EXACTEMENT ; c'est une chaîne alphanumérique, jamais un nombre) :
${list}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour ni bloc de code :
{"tasks":[{"content":"...","due_string":"...","due_lang":"fr","priority":1,"project_id":"..."}]}

Règles :
- content : la tâche COMPLÈTE et actionnable — verbe à l'infinitif SUIVI de son complément d'objet.
  Jamais un verbe seul. Écris "Photographier le lot de polos Ralph Lauren", pas "photographier".
  N'y mets NI la date, NI le nom du projet, NI la priorité.
- due_string : la date en français naturel telle qu'elle est dite ("demain", "demain 14h",
  "avant vendredi", "lundi"). Omets complètement le champ s'il n'y a pas d'échéance.
- due_lang : toujours "fr".
- priority : 4 si c'est urgent, 3 si c'est important, 1 sinon.
- project_id : choisis le projet dont le domaine décrit ci-dessus correspond au contenu de la tâche.
  N'utilise l'Inbox que si aucun autre projet ne colle.
- Une tâche par intention distincte. N'invente aucune tâche absente de la note.

Exemple.
Note : "ce soir faut que je trie les cintres du dépôt-vente, et lundi rendre mon exercice React"
Réponse : {"tasks":[
{"content":"Trier les cintres du dépôt-vente","due_string":"ce soir","due_lang":"fr","priority":1,"project_id":"<id du projet friperie>"},
{"content":"Rendre l'exercice React","due_string":"lundi","due_lang":"fr","priority":1,"project_id":"<id du projet école>"}]}`;
}

/** Le modèle encadre parfois sa réponse de ```json … ``` malgré la consigne. */
function stripFences(raw: string): string {
  const t = raw.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  // Sinon : on isole le premier objet JSON complet.
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return start !== -1 && end > start ? t.slice(start, end + 1) : t;
}

type RawTask = {
  content?: unknown;
  due_string?: unknown;
  priority?: unknown;
  project_id?: unknown;
};

function coerce(rows: RawTask[], projects: Project[]): TodoistTask[] {
  const known = new Set(projects.map((p) => p.id));
  const inbox = inboxIdOf(projects);

  return rows
    .map((r): TodoistTask | null => {
      const content = String(r.content ?? "").trim();
      if (!content) return null;

      const priority: PrioValue = isPrioValue(r.priority) ? r.priority : 1;

      // project_id est une chaîne : on compare tel quel, sans conversion.
      const rawId = r.project_id == null ? "" : String(r.project_id);
      // Un identifiant hors liste ne fait pas échouer la note : on range en Inbox.
      const project_id = known.has(rawId) ? rawId : inbox;

      const due = String(r.due_string ?? "").trim();

      const task: TodoistTask = { content, due_lang: "fr", priority, project_id };
      if (due) task.due_string = due;
      return task;
    })
    .filter((t): t is TodoistTask => t !== null)
    .slice(0, MAX_TASKS);
}

async function callGroq(text: string, projects: Project[], key: string, model: string) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt(projects) },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq a répondu ${res.status}. ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function POST(req: Request) {
  const denied = requirePin(req);
  if (denied) return denied;

  let body: { text?: unknown; projects?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const text = String(body.text ?? "").trim();
  if (!text) {
    return Response.json({ error: "Aucun texte à structurer." }, { status: 400 });
  }

  const projects = Array.isArray(body.projects)
    ? (body.projects as { id?: unknown; name?: unknown }[])
        .map((p) => ({ id: String(p.id ?? ""), name: String(p.name ?? "") }))
        .filter((p) => p.id && p.name)
    : [];
  if (!projects.length) {
    return Response.json({ error: "Aucun projet fourni." }, { status: 400 });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return Response.json({ error: "GROQ_API_KEY absente côté serveur." }, { status: 503 });
  }
  const model = process.env.PARSE_MODEL || "openai/gpt-oss-20b";

  // Une seule reprise : un JSON mal formé est presque toujours transitoire.
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callGroq(text, projects, key, model);
      const parsed = JSON.parse(stripFences(raw)) as { tasks?: unknown };
      const rows = Array.isArray(parsed.tasks) ? (parsed.tasks as RawTask[]) : [];
      const tasks = coerce(rows, projects);

      if (!tasks.length) {
        lastError = "Le modèle n'a extrait aucune tâche.";
        continue;
      }
      return Response.json({ tasks });
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Structuration impossible.";
      console.error(`[parse] tentative ${attempt} :`, lastError);
    }
  }

  return Response.json(
    { error: `Structuration impossible. ${lastError}`.trim() },
    { status: 502 },
  );
}
