import { PROJECTS, dueOpt } from "./mock";
import type { ParsedTask, PrioKey } from "./types";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/* -------------------------------------------------------------------------
 * parseNote(text) — STUB DE STRUCTURATION
 *
 * Découpe une note vocale brute en tâches exploitables, par heuristiques :
 *   1. segmentation sur les connecteurs de l'oral (puis, ensuite, et aussi,
 *      également, virgules, ponctuation) ;
 *   2. détection d'une expression temporelle -> dueKey + dueText verbatim
 *      (on garde le français naturel, ex. "demain 14h") ;
 *   3. détection de priorité (urgent -> p1, important / dès que possible -> p2) ;
 *   4. mapping mots-clés -> projet mocké (fallback : projet par défaut) ;
 *   5. nettoyage du titre (fillers, expressions consommées, capitalisation).
 *
 * ⚠️ Provisoire : sera remplacé par un appel LLM (PARSE_MODEL). Le contrat de
 * sortie est stable et sérialisable pour que le swap soit indolore.
 * ---------------------------------------------------------------------- */
export function parseNote(text: string, defaultProjectId: string): ParsedTask[] {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const SPLIT =
    /\s*(?:,|;|\.|!|\?|\bpuis\b|\bensuite\b|\bet aussi\b|\bet également\b|\bégalement\b|\bet egalement\b|\bapr[eè]s [cç]a\b|\bd'?ailleurs\b|\bet il faut\b|\bpar ailleurs\b)\s*/i;
  const fragments = raw
    .split(SPLIT)
    .map((f) => f.trim())
    .filter((f) => norm(f).replace(/[^a-z0-9]/g, "").length > 3);

  // Expressions temporelles — ordre important (les plus spécifiques d'abord).
  // Le texte capturé est réinjecté tel quel dans la string Quick Add.
  const HOUR =
    "(?:\\s+(?:matin|midi|soir|apr[eè]s-midi))?(?:\\s+(?:[àa]\\s*)?\\d{1,2}\\s*h(?:\\d{2})?)?";
  const TIME = [
    { re: new RegExp("\\bapr[eè]s-?\\s?demain" + HOUR, "i"), key: "day2" },
    { re: new RegExp("\\bdemain" + HOUR, "i"), key: "tomorrow" },
    { re: /\bavant vendredi\b/i, key: "beforefriday" },
    { re: new RegExp("\\bvendredi" + HOUR, "i"), key: "friday" },
    { re: /\bfin de (?:la )?semaine\b|\bcette semaine\b/i, key: "beforefriday" },
    { re: /\b(?:la )?semaine prochaine\b/i, key: "nextweek" },
    { re: /\bfin (?:de|du) mois\b/i, key: "eom" },
    { re: /\bce soir\b|\bcet apr[eè]s-midi\b/i, key: "tonight" },
    { re: new RegExp("\\baujourd'?hui" + HOUR, "i"), key: "today" },
    { re: new RegExp("\\blundi" + HOUR, "i"), key: "monday" },
  ];

  const PRIO: { re: RegExp; value: PrioKey }[] = [
    { re: /\b(?:urgent|urgence|asap|au plus vite|imp[eé]rativement|absolument)\b/i, value: "p1" },
    { re: /\b(?:important|prioritaire|d[eè]s que possible|(?:ne pas|pas) oublier|surtout)\b/i, value: "p2" },
  ];

  const FILLERS =
    /^(?:et\s+|aussi\s+|alors\s+|donc\s+|il faut\s+|faut\s+|je dois\s+|on doit\s+|penser [àa]\s+|ne pas oublier de\s+|il faudrait\s+)+/i;

  const tasks: ParsedTask[] = [];
  for (const fragment of fragments) {
    let title = fragment;

    let dueKey = "none";
    let dueText = "";
    for (const t of TIME) {
      const m = title.match(t.re);
      if (m) {
        dueKey = t.key;
        dueText = m[0].trim().toLowerCase();
        title = title.replace(t.re, " ");
        break;
      }
    }

    let prio: PrioKey = "p4";
    for (const p of PRIO) {
      if (p.re.test(title)) {
        prio = p.value;
        title = title.replace(p.re, " ");
        break;
      }
    }

    const n = norm(title);
    let best: string | null = null;
    let bestScore = 0;
    for (const p of PROJECTS) {
      const score = p.kw.reduce((acc, k) => acc + (n.includes(k) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        best = p.id;
      }
    }

    title = title.replace(/\bc'?est\s*$/i, "").replace(/\s+/g, " ").replace(FILLERS, "").trim();
    title = title.replace(/^[,;:\-–\s]+|[,;:\-–\s]+$/g, "");
    if (title.length < 3) continue;
    title = title.charAt(0).toUpperCase() + title.slice(1);

    tasks.push({
      title,
      projectId: best ?? defaultProjectId,
      dueKey,
      dueText: dueText || dueOpt(dueKey).text,
      prio,
    });
    if (tasks.length >= 5) break; // 2 à 5 cartes en revue
  }

  if (!tasks.length) {
    const t = raw.replace(FILLERS, "").trim();
    tasks.push({
      title: t.charAt(0).toUpperCase() + t.slice(1),
      projectId: defaultProjectId,
      dueKey: "none",
      dueText: "",
      prio: "p4",
    });
  }
  return tasks;
}

/* -------------------------------------------------------------------------
 * toQuickAdd(task) — sérialisation vers la syntaxe Quick Add de Todoist :
 *   "<titre> <date en français> #<Projet> <p1..p4>"
 * La date reste en langage naturel : c'est Todoist qui la résout côté serveur.
 * ⚠️ Provisoire aussi — un LLM pourra produire la string directement.
 * ---------------------------------------------------------------------- */
export function toQuickAdd(task: Pick<ParsedTask, "title" | "projectId" | "dueKey" | "dueText" | "prio">): string {
  const p = PROJECTS.find((x) => x.id === task.projectId) ?? PROJECTS[0];
  const due = task.dueText || dueOpt(task.dueKey).text;
  return [task.title || "Nouvelle tâche", due, "#" + p.tag, task.prio]
    .filter(Boolean)
    .join(" ");
}
