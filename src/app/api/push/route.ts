import { requirePin } from "@/lib/guard";
import { isPrioValue } from "@/lib/todoist";
import type { PrioValue, PushResult, TodoistTask } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const TODOIST_TASKS = "https://api.todoist.com/api/v1/tasks";
const TIMEOUT_MS = 12_000;
const MAX_TASKS = 20;

/**
 * Crée les tâches UNE PAR UNE et renvoie un résultat par tâche.
 *
 * Pas de tout-ou-rien : si la 3e échoue, les deux premières restent créées et
 * le client sait exactement laquelle réessayer. Ne jamais transformer ça en
 * `Promise.all` qui rejette, ni annuler les suivantes sur un échec.
 *
 * ⚠️ Cet endpoint n'interprète PAS la syntaxe Quick Add : ni `#projet`, ni `p2`,
 * ni date dans le texte. Tout passe par les champs, et `due_lang: "fr"` est
 * obligatoire — sans lui Todoist lit « demain 14h » en anglais et l'ignore.
 */
/**
 * Message d'échec destiné à l'écran : Todoist répond en JSON verbeux, on n'en
 * garde que la partie utile plutôt que de déverser le corps brut dans l'UI.
 */
async function readError(res: Response): Promise<string> {
  if (res.status === 401 || res.status === 403) return "Todoist a refusé le jeton d'accès.";
  if (res.status === 429) return "Todoist limite les appels. Réessaie dans un instant.";

  const body = await res.text().catch(() => "");
  try {
    const j = JSON.parse(body) as { error?: string; error_extra?: { argument?: string } };
    const arg = j.error_extra?.argument;
    if (j.error) {
      return arg
        ? `Todoist a refusé le champ « ${arg} » : ${j.error}.`
        : `Todoist : ${j.error}.`;
    }
  } catch {
    /* réponse non-JSON : on retombe sur le texte brut tronqué */
  }
  return `Todoist a répondu ${res.status}. ${body.slice(0, 120)}`.trim();
}

async function createTask(task: TodoistTask, token: string): Promise<PushResult> {
  try {
    const priority: PrioValue = isPrioValue(task.priority) ? task.priority : 1;

    const payload: TodoistTask = {
      content: task.content,
      due_lang: "fr",
      priority,
      // Chaîne alphanumérique — aucune conversion numérique.
      project_id: String(task.project_id),
    };
    if (task.due_string) payload.due_string = task.due_string;

    const res = await fetch(TODOIST_TASKS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      return { ok: false, error: await readError(res) };
    }

    const created = (await res.json()) as { id?: unknown };
    return { ok: true, id: String(created.id ?? "") };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "TimeoutError";
    return {
      ok: false,
      error: aborted ? "Todoist n'a pas répondu à temps." : "Todoist est injoignable.",
    };
  }
}

export async function POST(req: Request) {
  const denied = requirePin(req);
  if (denied) return denied;

  const token = process.env.TODOIST_API_TOKEN;
  if (!token) {
    return Response.json(
      { error: "TODOIST_API_TOKEN absente côté serveur." },
      { status: 503 },
    );
  }

  let body: { tasks?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const tasks = Array.isArray(body.tasks) ? (body.tasks as TodoistTask[]) : [];
  if (!tasks.length) {
    return Response.json({ error: "Aucune tâche à envoyer." }, { status: 400 });
  }
  if (tasks.length > MAX_TASKS) {
    return Response.json({ error: `Maximum ${MAX_TASKS} tâches par envoi.` }, { status: 400 });
  }

  const results: PushResult[] = [];
  for (const task of tasks) {
    results.push(await createTask(task, token));
  }

  const created = results.filter((r) => r.ok).length;
  // 207 : succès partiel. Le client lit `results`, pas le code seul.
  const status = created === results.length ? 200 : created > 0 ? 207 : 502;

  return Response.json({ results, created, total: results.length }, { status });
}
