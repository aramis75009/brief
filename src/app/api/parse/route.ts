import { TIMEZONE, resolveDue, toIsoWithOffset } from "@/lib/due";
import { shiftDays, weekdayOf, zonedParts, zonedTime } from "@/lib/zoned";
import { requirePin } from "@/lib/guard";
import { fallbackProjectId, isPriority } from "@/lib/projects";
import { readProjects } from "@/lib/store";
import type { DraftItem, ItemKind, Priority, Project } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 40_000;
const MAX_ITEMS = 8;

/**
 * Prompt de structuration.
 *
 * Deux changements de fond depuis le pivot :
 *
 * 1. **`now` est injecté.** Avant, la date en français partait telle quelle vers
 *    un service tiers qui la résolvait. Ce service n'existe plus : c'est le
 *    modèle qui doit rendre une date absolue, et il ne peut pas le faire sans
 *    savoir quel jour on est.
 *
 * 2. **Le modèle classe tâche ou rendez-vous.** Un rendez-vous occupe un
 *    créneau, une tâche a une échéance. Une erreur de classement n'est signalée
 *    par rien : c'est l'écran de revue qui doit la rendre visible.
 */
function systemPrompt(projects: Project[], now: Date): string {
  const list = projects
    .map((p) =>
      p.hints?.length
        ? `- id "${p.id}" — ${p.name} — concerne : ${p.hints.join(", ")}`
        : `- id "${p.id}" — ${p.name}`,
    )
    .join("\n");

  const nowIso = toIsoWithOffset(now);
  const today = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  });

  return `Tu convertis une note vocale en français en items d'organisation.

Nous sommes le ${today}. Instant courant : ${nowIso} (fuseau ${TIMEZONE}).

Projets disponibles (recopie l'identifiant EXACTEMENT) :
${list}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour ni bloc de code :
{"items":[{"kind":"task","title":"...","due":"2026-08-12T14:00:00+02:00","allDay":false,"priority":3,"projectId":"...","rrule":null,"status":null}]}

Règles :
- kind : "event" si c'est un rendez-vous qui occupe un créneau (réunion, déjeuner,
  médecin, appel planifié). "task" si c'est quelque chose à faire avant une échéance.
  Dans le doute, "task".
- status : "idea" si la note est une pensée en passant, SANS action ni échéance
  claire (« il faudrait repenser au logo un jour », « idée : proposer un abonnement »).
  null dans tous les autres cas — l'utilisateur peut toujours corriger le type à la
  revue, ce champ n'est qu'une proposition, pas une décision définitive.
- title : l'item COMPLET et actionnable — verbe à l'infinitif SUIVI de son complément.
  Jamais un verbe seul. Écris "Photographier le lot de polos", pas "photographier".
  N'y mets NI la date, NI le nom du projet, NI la priorité.
- due : date ABSOLUE au format ISO 8601 avec décalage, calculée à partir de l'instant
  courant ci-dessus. "demain 14h" devient une vraie date. null s'il n'y a pas d'échéance.
- allDay : true si aucune heure n'est dite. Mets alors une heure à 09:00.
- priority : 1 = urgent, 2 = important, 3 = normal, 4 = par défaut. ATTENTION : 1 est
  la priorité la PLUS HAUTE.
- projectId : l'identifiant EXACT d'un projet de la liste ci-dessus, jamais un
  identifiant inventé. Si aucun ne correspond vraiment, prends le plus proche —
  l'utilisateur corrigera à la revue, alors qu'un identifiant inconnu se perdrait.
- rrule : règle de récurrence RFC 5545 si la note en décrit une ("tous les mardis"
  donne "FREQ=WEEKLY;BYDAY=TU"), sinon null.
- Un item par intention distincte. N'invente rien qui ne soit pas dans la note.

Exemple, si nous étions le lundi 10 août 2026 :
Note : "ce soir trier les cintres, déjeuner avec Paul jeudi midi, tous les mardis sortir les poubelles, et il faudrait repenser le logo un jour"
Réponse : {"items":[
{"kind":"task","title":"Trier les cintres du dépôt-vente","due":"2026-08-10T19:00:00+02:00","allDay":false,"priority":3,"projectId":"<projet friperie>","rrule":null,"status":null},
{"kind":"event","title":"Déjeuner avec Paul","due":"2026-08-13T12:00:00+02:00","allDay":false,"priority":3,"projectId":"<projet le plus proche>","rrule":null,"status":null},
{"kind":"task","title":"Sortir les poubelles","due":"2026-08-11T09:00:00+02:00","allDay":true,"priority":4,"projectId":"<projet le plus proche>","rrule":"FREQ=WEEKLY;BYDAY=TU","status":null},
{"kind":"task","title":"Repenser le logo","due":null,"allDay":true,"priority":4,"projectId":"<projet le plus proche>","rrule":null,"status":"idea"}]}`;
}

/** Le modèle encadre parfois sa réponse de ```json … ``` malgré la consigne. */
function stripFences(raw: string): string {
  const t = raw.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return start !== -1 && end > start ? t.slice(start, end + 1) : t;
}

type RawItem = {
  kind?: unknown;
  title?: unknown;
  due?: unknown;
  allDay?: unknown;
  priority?: unknown;
  projectId?: unknown;
  rrule?: unknown;
  status?: unknown;
};

let counter = 0;
function newId(): string {
  counter += 1;
  return `it_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/** Codes de jour RFC 5545 → index JavaScript (dimanche = 0). */
const BYDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/**
 * Recale la première occurrence sur le jour que la récurrence annonce.
 *
 * ⚠️ Ce garde-fou existe parce que le défaut a été observé, pas anticipé :
 * pour « tous les mardis », le modèle a rendu `FREQ=WEEKLY;BYDAY=TU` avec une
 * date de départ tombant un samedi. Rien ne l'aurait signalé — la tâche serait
 * simplement apparue le mauvais jour, chaque semaine.
 *
 * On fait confiance à la RÈGLE plutôt qu'à la date : le jour de la semaine est
 * ce que l'utilisateur a dit, la date de départ est ce que le modèle a calculé.
 * L'heure est conservée.
 */
function alignToRrule(due: string, rrule: string): string {
  const match = rrule.match(/BYDAY=([A-Z,]+)/i);
  if (!match) return due;

  const targets = match[1]
    .split(",")
    .map((code) => BYDAY[code.trim().toUpperCase().slice(-2)])
    .filter((d): d is number => d !== undefined);
  if (!targets.length) return due;

  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return due;

  // ⚠️ Le jour de la semaine se lit dans TIMEZONE, pas sur la machine : une
  // échéance entre minuit et 2 h à Paris tombe la veille en UTC, et le serveur
  // recalerait alors sur le mauvais jour.
  const start = zonedParts(date);
  if (targets.includes(start.weekday)) return due;

  // Prochain jour correspondant, en avançant au plus de six jours.
  for (let shift = 1; shift <= 6; shift++) {
    const cal = shiftDays(start, shift);
    if (targets.includes(weekdayOf(cal))) {
      return toIsoWithOffset(zonedTime(cal.y, cal.m, cal.d, start.hour, start.minute));
    }
  }
  return due;
}

/**
 * Normalise la sortie du modèle.
 *
 * Une date que le modèle invente mal (« 2026-02-31 ») est rejetée et l'item
 * repart sans échéance plutôt qu'avec une date fausse : un rappel qui ne part
 * pas se voit, un rappel qui part au mauvais moment ne se voit pas.
 */
function coerce(rows: RawItem[], projects: Project[], now: Date): DraftItem[] {
  const known = new Set(projects.map((p) => p.id));
  const fallback = fallbackProjectId(projects);

  return rows
    .map((r): DraftItem | null => {
      const title = String(r.title ?? "").trim();
      if (!title) return null;

      const kind: ItemKind = r.kind === "event" ? "event" : "task";
      const priority: Priority = isPriority(r.priority) ? r.priority : 4;

      const rawProject = r.projectId == null ? "" : String(r.projectId);
      const projectId = known.has(rawProject) ? rawProject : fallback;

      let due: string | null = null;
      let allDay = r.allDay === true;
      const rawDue = typeof r.due === "string" ? r.due.trim() : "";
      if (rawDue) {
        const resolved = resolveDue(rawDue, now);
        if (resolved) {
          due = resolved.due;
          if (r.allDay === undefined) allDay = resolved.allDay;
        }
      }

      const rrule =
        typeof r.rrule === "string" && /^FREQ=/i.test(r.rrule.trim()) ? r.rrule.trim() : null;

      if (rrule && due) due = alignToRrule(due, rrule);

      // Proposition du modèle, jamais définitive : l'utilisateur peut toujours
      // changer le type à la revue (`TypeSegmented` de `CaptureSheet`).
      const status = r.status === "idea" ? "idea" : undefined;

      return { id: newId(), kind, title, projectId, due, allDay, priority, rrule, status };
    })
    .filter((i): i is DraftItem => i !== null)
    .slice(0, MAX_ITEMS);
}

async function callGroq(text: string, projects: Project[], now: Date, key: string, model: string) {
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
        { role: "system", content: systemPrompt(projects, now) },
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

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const text = String(body.text ?? "").trim();
  if (!text) {
    return Response.json({ error: "Aucun texte à structurer." }, { status: 400 });
  }

  // Les projets viennent du serveur et non du client : c'est lui qui les possède.
  const projects = await readProjects();

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return Response.json({ error: "GROQ_API_KEY absente côté serveur." }, { status: 503 });
  }
  const model = process.env.PARSE_MODEL || "openai/gpt-oss-20b";
  const now = new Date();

  // Une seule reprise : un JSON mal formé est presque toujours transitoire.
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callGroq(text, projects, now, key, model);
      const parsed = JSON.parse(stripFences(raw)) as { items?: unknown };
      const rows = Array.isArray(parsed.items) ? (parsed.items as RawItem[]) : [];
      const items = coerce(rows, projects, now);

      if (!items.length) {
        lastError = "Le modèle n'a extrait aucun item.";
        continue;
      }
      return Response.json({ items });
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Structuration impossible.";
      console.error(`[parse] tentative ${attempt} :`, lastError);
    }
  }

  return Response.json({ error: `Structuration impossible. ${lastError}`.trim() }, { status: 502 });
}
