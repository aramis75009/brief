import { requireSession } from "@/lib/guard";
import { readItems, readProjects } from "@/lib/store";
import { zonedParts } from "@/lib/zoned";
import { TIMEZONE } from "@/lib/due";
import type { Item, Project } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const OLLAMA_URL = "https://ollama.com/v1/chat/completions";
const TIMEOUT_MS = 30_000;

/**
 * Construit le prompt système injecté à chaque échange.
 *
 * Le contexte vient du serveur, jamais du client : c'est lui qui possède les
 * données. On ne renvoie que ce qui aide l'assistant — pas tout l'historique,
 * juste aujourd'hui et les projets.
 */
function buildSystemPrompt(items: Item[], projects: Project[], now: Date): string {
  const todayParts = zonedParts(now);
  const todayKey = `${todayParts.y}-${String(todayParts.m).padStart(2, "0")}-${String(todayParts.d).padStart(2, "0")}`;

  // Tâches et rendez-vous d'aujourd'hui, non terminés.
  const todayItems = items.filter((it) => {
    if (it.doneAt) return false;
    if (!it.due) return false;
    const d = new Date(it.due);
    if (Number.isNaN(d.getTime())) return false;
    const p = zonedParts(d);
    return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}` === todayKey;
  });

  const tasks = todayItems.filter((i) => i.kind === "task");
  const events = todayItems.filter((i) => i.kind === "event");

  const fmtDate = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIMEZONE,
  });

  const lines: string[] = [];
  lines.push("Tu es l'assistant de Brief, l'organiseur personnel d'Aramis.");
  lines.push("");
  lines.push(`Nous sommes le ${fmtDate} (fuseau ${TIMEZONE}).`);
  lines.push("");

  lines.push("Tâches prévues aujourd'hui :");
  if (tasks.length === 0) {
    lines.push("- (aucune)");
  } else {
    for (const t of tasks) {
      const projectName = projects.find((p) => p.id === t.projectId)?.name ?? "Sans projet";
      const time = t.allDay
        ? "journée"
        : new Date(t.due!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE });
      lines.push(`- ${t.title} (${projectName}${t.allDay ? "" : `, ${time}`})`);
    }
  }
  lines.push("");

  lines.push("Rendez-vous prévus aujourd'hui :");
  if (events.length === 0) {
    lines.push("- (aucun)");
  } else {
    for (const e of events) {
      const time = e.allDay
        ? "journée"
        : new Date(e.due!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE });
      lines.push(`- ${e.title} (${time})`);
    }
  }
  lines.push("");

  lines.push("Projets :");
  if (projects.length === 0) {
    lines.push("- (aucun)");
  } else {
    for (const p of projects) {
      lines.push(`- ${p.name}`);
    }
  }
  lines.push("");

  lines.push("Instructions :");
  lines.push("- Réponds en français, de façon concise et utile.");
  lines.push("- Tu peux suggérer la création de tâches, une réorganisation, ou des priorités.");
  lines.push("- Tu n'as accès qu'au contexte ci-dessus. Ne prétends pas voir ce que tu ne vois pas.");
  lines.push("- Si Aramis te demande de créer une tâche, propose-lui la formulation et dis-lui de la dicter ou de l'ajouter via la capture.");

  return lines.join("\n");
}

export async function POST(req: Request): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  // On ne garde que role + content lisibles. On exclut tout message système
  // entrant — le système est construit côté serveur, jamais confiance au
  // client pour le fournir.
  const userMessages: { role: string; content: string }[] = [];
  for (const m of rawMessages) {
    if (!m || typeof m !== "object") continue;
    const role = String((m as { role?: unknown }).role ?? "");
    const content = String((m as { content?: unknown }).content ?? "");
    if (!role || !content) continue;
    // On ne garde que user et assistant — pas de system entrant.
    if (role === "user" || role === "assistant") {
      userMessages.push({ role, content });
    }
  }

  if (userMessages.length === 0) {
    return Response.json({ error: "Aucun message à envoyer." }, { status: 400 });
  }

  const key = process.env.OLLAMA_API_KEY;
  if (!key) {
    return Response.json({ error: "OLLAMA_API_KEY absente côté serveur." }, { status: 503 });
  }

  const model = process.env.CHAT_MODEL || "deepseek-v4-flash:0731";
  const now = new Date();

  const [items, projects] = await Promise.all([readItems(), readProjects()]);
  const system = buildSystemPrompt(items, projects, now);

  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...userMessages],
        stream: false,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json(
        { error: `Ollama a répondu ${res.status}. ${detail.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return Response.json({ error: "Réponse vide du modèle." }, { status: 502 });
    }

    return Response.json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Échec de la communication avec Ollama.";
    return Response.json({ error: msg }, { status: 502 });
  }
}