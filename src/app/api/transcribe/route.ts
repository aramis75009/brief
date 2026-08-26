import { requireSession } from "@/lib/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

/** Vocabulaire propre à l'utilisateur — réduit nettement les fautes sur les noms. */
const PROMPT =
  "Vinted, Vestiaire Collective, Frip & Trend, Ralph Lauren, Tommy Hilfiger, Bottega Veneta, Balenciaga, URSSAF, Web@cadémie, Epitech, My Flip, Supabase, SKU";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Requête multipart invalide." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Aucun fichier audio reçu." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Enregistrement trop volumineux." }, { status: 413 });
  }

  // Le client envoie le mimeType réellement produit par MediaRecorder
  // (mp4 sur Safari iOS, webm ailleurs) — on ne le devine jamais.
  const mimeType = String(form.get("mimeType") || file.type || "audio/webm");

  const provider = process.env.TRANSCRIBE_PROVIDER || "groq";

  try {
    const text =
      provider === "voicebox"
        ? await transcribeVoicebox(file, mimeType)
        : await transcribeGroq(file, mimeType);
    return Response.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transcription impossible.";
    console.error("[transcribe]", provider, message);
    return Response.json({ error: message }, { status: 502 });
  }
}

async function transcribeGroq(file: File, mimeType: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY absente côté serveur.");

  const model = process.env.TRANSCRIBE_MODEL || "whisper-large-v3";

  const body = new FormData();
  body.append("file", new File([await file.arrayBuffer()], file.name || "audio", { type: mimeType }));
  body.append("model", model);
  body.append("language", "fr");
  body.append("response_format", "json");
  body.append("prompt", PROMPT);

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq a répondu ${res.status}. ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text || "").trim();
}

/**
 * Bascule locale vers Voicebox. Implémentée mais NON testée : VOICEBOX_URL
 * n'est pas posée sur Vercel (le service tourne sur le LAN, injoignable depuis
 * le cloud). Ne sert donc qu'en développement.
 */
async function transcribeVoicebox(file: File, mimeType: string): Promise<string> {
  const base = process.env.VOICEBOX_URL;
  if (!base) throw new Error("VOICEBOX_URL absente côté serveur.");

  const body = new FormData();
  body.append("file", new File([await file.arrayBuffer()], file.name || "audio", { type: mimeType }));
  body.append("mimeType", mimeType);

  const res = await fetch(`${base.replace(/\/+$/, "")}/transcribe`, { method: "POST", body });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Voicebox a répondu ${res.status}. ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text || "").trim();
}
