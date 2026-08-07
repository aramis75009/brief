"use client";

import { PIN_HEADER, UnauthorizedError, clearPin, getPin } from "./pin";
import type { Project, PushResult, TodoistTask } from "./types";

/** Erreur porteuse d'un message déjà lisible en français. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

const TIMEOUTS = {
  projects: 12_000,
  transcribe: 90_000,
  parse: 50_000,
  push: 70_000,
} as const;

async function jsonFetch<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const pin = getPin();
  const headers = new Headers(init.headers);
  if (pin) headers.set(PIN_HEADER, pin);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new ApiError("Le serveur n'a pas répondu à temps. Réessaie.");
    }
    throw new ApiError("Réseau indisponible. Vérifie ta connexion.");
  }

  if (res.status === 401) {
    clearPin();
    throw new UnauthorizedError();
  }

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && res.status !== 207) {
    throw new ApiError(data.error || `Le serveur a répondu ${res.status}.`);
  }
  return data;
}

export type ProjectsSource = "todoist" | "cache" | "fallback";

/**
 * Le corps reste le tableau `[{id, name}]` attendu ; la provenance est lue dans
 * l'en-tête `x-brief-source` pour que Réglages puisse afficher « en ligne » ou
 * « repli » sans deuxième appel.
 */
export async function fetchProjects(): Promise<{ projects: Project[]; source: ProjectsSource }> {
  const pin = getPin();
  const headers = new Headers();
  if (pin) headers.set(PIN_HEADER, pin);

  let res: Response;
  try {
    res = await fetch("/api/projects", {
      headers,
      signal: AbortSignal.timeout(TIMEOUTS.projects),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new ApiError("La liste des projets n'a pas répondu à temps.");
    }
    throw new ApiError("Réseau indisponible. Vérifie ta connexion.");
  }

  if (res.status === 401) {
    clearPin();
    throw new UnauthorizedError();
  }
  if (!res.ok) throw new ApiError(`Impossible de charger les projets (${res.status}).`);

  const projects = (await res.json()) as Project[];
  const source = (res.headers.get("x-brief-source") as ProjectsSource | null) ?? "fallback";
  return { projects, source };
}

export async function parseNote(text: string, projects: Project[]): Promise<TodoistTask[]> {
  const data = await jsonFetch<{ tasks: TodoistTask[] }>(
    "/api/parse",
    { method: "POST", body: JSON.stringify({ text, projects }) },
    TIMEOUTS.parse,
  );
  return data.tasks ?? [];
}

export async function pushTasks(
  tasks: TodoistTask[],
): Promise<{ results: PushResult[]; created: number; total: number }> {
  return jsonFetch(
    "/api/push",
    { method: "POST", body: JSON.stringify({ tasks }) },
    TIMEOUTS.push,
  );
}

/**
 * Envoi de l'audio en XHR — et non en fetch — pour distinguer réellement deux
 * phases : `uploading` tant que le corps monte, `transcribing` une fois qu'il
 * est parti. Avec fetch, cette bascule ne serait qu'une temporisation inventée.
 */
export function transcribeAudio(
  blob: Blob,
  mimeType: string,
  onUploaded: () => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    const ext = mimeType.includes("mp4") ? "m4a" : "webm";
    form.append("file", blob, `note.${ext}`);
    form.append("mimeType", mimeType);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/transcribe");
    xhr.timeout = TIMEOUTS.transcribe;

    const pin = getPin();
    if (pin) xhr.setRequestHeader(PIN_HEADER, pin);

    xhr.upload.onload = () => onUploaded();

    xhr.onload = () => {
      let data: { text?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText) as typeof data;
      } catch {
        /* réponse illisible : traitée ci-dessous */
      }
      if (xhr.status === 401) {
        clearPin();
        reject(new UnauthorizedError());
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(data.error || `La transcription a échoué (${xhr.status}).`));
        return;
      }
      resolve((data.text || "").trim());
    };

    xhr.onerror = () => reject(new ApiError("Réseau indisponible pendant l'envoi de l'audio."));
    xhr.ontimeout = () =>
      reject(new ApiError("La transcription a mis trop de temps. Réessaie."));
    xhr.onabort = () => reject(new ApiError("Envoi interrompu."));

    xhr.send(form);
  });
}
