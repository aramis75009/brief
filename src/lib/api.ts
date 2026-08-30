"use client";

import type { AgendaItem } from "./agenda";
import type { DraftItem, Item, KanbanBoard, Objective, ObjectiveHorizon, Overview, Project, SaveResult, Tag } from "./types";

/** Erreur porteuse d'un message déjà lisible en français. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** 401 : session absente ou expirée — l'appelant doit réafficher AuthGate. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Session expirée");
    this.name = "UnauthorizedError";
  }
}

/** fetch vers /api/* — les cookies de session suivent automatiquement (same-origin). */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) throw new UnauthorizedError();
  return res;
}

const TIMEOUTS = {
  projects: 12_000,
  transcribe: 90_000,
  parse: 50_000,
  save: 30_000,
  items: 15_000,
  overview: 15_000,
  agenda: 15_000,
  caldavStatus: 10_000,
} as const;

async function jsonFetch<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const headers = new Headers(init.headers);
  // Ne PAS forcer Content-Type sur FormData : le navigateur doit set
  // multipart/form-data avec son boundary. Forcer application/json casse l'upload.
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");

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
    throw new UnauthorizedError();
  }

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && res.status !== 207) {
    throw new ApiError(data.error || `Le serveur a répondu ${res.status}.`);
  }
  return data;
}

/** Les projets appartiennent à Brief : plus aucune provenance externe à afficher. */
export async function fetchProjects(): Promise<Project[]> {
  return jsonFetch<Project[]>("/api/projects", {}, TIMEOUTS.projects);
}

/** Crée un projet. La teinte et la forme sont choisies par le serveur. */
export async function createProject(name: string): Promise<Project> {
  return jsonFetch<Project>(
    "/api/projects",
    { method: "POST", body: JSON.stringify({ name }) },
    TIMEOUTS.projects,
  );
}

/**
 * Supprime un projet. `orphaned` compte les items ouverts qui pointaient dessus.
 *
 * Ces items ne sont PAS supprimés : ils basculent sous « Autre » dans l'écran
 * Tâches. L'appelant doit le dire à l'utilisateur, sinon la suppression donne
 * l'impression d'avoir emporté des tâches avec elle.
 */
export async function deleteProject(id: string): Promise<{ ok: boolean; orphaned: number }> {
  return jsonFetch(
    "/api/projects",
    { method: "DELETE", body: JSON.stringify({ id }) },
    TIMEOUTS.projects,
  );
}

/** Les items déjà enregistrés, pour l'écran Tâches et la vision globale. */
export async function fetchItems(): Promise<Item[]> {
  const data = await jsonFetch<{ items: Item[] }>("/api/items", {}, TIMEOUTS.items);
  return data.items ?? [];
}

/**
 * La vision globale, calculée par le serveur.
 *
 * Un seul appel sert les deux représentations de l'onglet Vision ET le relevé
 * du jour de l'écran Capture. Agréger côté client obligerait à télécharger tous
 * les items pour n'en afficher que des totaux.
 */
export async function fetchOverview(): Promise<Overview> {
  return jsonFetch<Overview>("/api/overview", {}, TIMEOUTS.overview);
}

/**
 * Le Rendez-vous d'UN jour (`AAAA-MM-JJ`), fusionné côté serveur : items
 * Brief actifs + événements posés directement dans l'app Calendrier. Voir
 * `src/lib/agenda.ts` — c'est la même fonction que la route appelle, jamais
 * une seconde logique côté client.
 */
export async function fetchAgendaDay(date: string): Promise<AgendaItem[]> {
  const data = await jsonFetch<{ events: AgendaItem[] }>(
    `/api/agenda?date=${encodeURIComponent(date)}`,
    {},
    TIMEOUTS.agenda,
  );
  return data.events ?? [];
}

/** Âge réel du dernier passage CalDAV — `null` si jamais synchronisé. */
export async function fetchCalDavStatus(): Promise<{ lastSyncAt: number | null }> {
  return jsonFetch("/api/caldav-status", {}, TIMEOUTS.caldavStatus);
}

/**
 * Envoie l'audio brut à `/api/audio` pour stockage persistant.
 * Retourne l'id et l'URL de l'audio enregistré — à rattacher aux items.
 */
export async function uploadAudio(
  blob: Blob,
  mimeType: string,
): Promise<{ id: string; url: string }> {
  return jsonFetch<{ id: string; url: string }>(
    "/api/audio",
    {
      method: "POST",
      body: (() => {
        const form = new FormData();
        const ext = mimeType.includes("mp4") ? "m4a" : "webm";
        form.append("file", blob, `note.${ext}`);
        form.append("mimeType", mimeType);
        return form;
      })(),
    },
    TIMEOUTS.transcribe,
  );
}

/** Les projets ne transitent plus par le client : le serveur les possède. */
export async function parseNote(text: string): Promise<DraftItem[]> {
  const data = await jsonFetch<{ items: DraftItem[] }>(
    "/api/parse",
    { method: "POST", body: JSON.stringify({ text }) },
    TIMEOUTS.parse,
  );
  return data.items ?? [];
}

export async function saveItems(
  items: DraftItem[],
): Promise<{ results: SaveResult[]; saved: number; total: number }> {
  return jsonFetch(
    "/api/items",
    { method: "POST", body: JSON.stringify({ items }) },
    TIMEOUTS.save,
  );
}

/**
 * Coche ou décoche un item.
 *
 * `completedAt` : l'occurrence PRÉCISE cochée (heure effective affichée dans
 * la liste du jour). Sur une récurrence dont le rappel a déjà sonné, le cron
 * a avancé `due` au-delà de l'occurrence qu'on coche — sans cette précision,
 * le serveur enregistrerait la mauvaise occurrence comme faite.
 *
 * Renvoie l'item tel que le serveur l'a écrit, jamais une reconstruction
 * locale : sur une tâche récurrente c'est le serveur qui calcule la nouvelle
 * échéance, et `outcome` dit laquelle des deux choses vient de se produire.
 */
export async function setItemDone(
  id: string,
  done: boolean,
  completedAt?: string | null,
): Promise<{ item: Item; outcome: "advanced" | "done" | "reopened" }> {
  return jsonFetch(
    "/api/items",
    {
      method: "PATCH",
      body: JSON.stringify(completedAt ? { id, done, completedAt } : { id, done }),
    },
    TIMEOUTS.save,
  );
}

/** Suppression définitive. Rien n'en garde de trace — contrairement à la coche. */
export async function deleteItem(id: string): Promise<{ ok: boolean; id: string }> {
  return jsonFetch(
    `/api/items/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    TIMEOUTS.save,
  );
}

/**
 * Envoie l'historique de conversation à l'assistant Brief et renvoie la
 * réponse textuelle du modèle. Le contexte (tâches, projets) est construit
 * côté serveur — le client ne fournit que les messages user/assistant.
 */
export async function chatWithAssistant(messages: { role: string; content: string }[]): Promise<string> {
  const data = await jsonFetch<{ reply: string }>(
    "/api/chat",
    { method: "POST", body: JSON.stringify({ messages }) },
    30_000,
  );
  return data.reply;
}

/**
 * Modifie un item déjà enregistré. Renvoie l'item mis à jour tel que le serveur
 * l'a persisté. Une échéance/titre vide côté client aboutit ici soit à un
 * 400 (titre), soit à « pas d'échéance » (résolu par le serveur).
 */
export async function updateItem(
  id: string,
  patch: Partial<DraftItem>,
): Promise<Item> {
  const data = await jsonFetch<{ item: Item }>(
    `/api/items/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    TIMEOUTS.save,
  );
  return data.item;
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

    xhr.upload.onload = () => onUploaded();

    xhr.onload = () => {
      let data: { text?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText) as typeof data;
      } catch {
        /* réponse illisible : traitée ci-dessous */
      }
      if (xhr.status === 401) {
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

/* --- Board Kanban -------------------------------------------------------- */

export async function fetchBoard(): Promise<KanbanBoard> {
  return jsonFetch<KanbanBoard>("/api/board", {}, TIMEOUTS.projects);
}

export async function addColumn(name: string): Promise<KanbanBoard> {
  return jsonFetch<KanbanBoard>(
    "/api/board",
    { method: "PATCH", body: JSON.stringify({ action: "add", name }) },
    TIMEOUTS.projects,
  );
}

export async function renameColumn(id: string, name: string): Promise<KanbanBoard> {
  return jsonFetch<KanbanBoard>(
    "/api/board",
    { method: "PATCH", body: JSON.stringify({ action: "rename", id, name }) },
    TIMEOUTS.projects,
  );
}

export async function deleteColumn(id: string): Promise<KanbanBoard> {
  return jsonFetch<KanbanBoard>(
    "/api/board",
    { method: "PATCH", body: JSON.stringify({ action: "delete", id }) },
    TIMEOUTS.projects,
  );
}

export async function reorderColumns(ids: string[]): Promise<KanbanBoard> {
  return jsonFetch<KanbanBoard>(
    "/api/board",
    { method: "PATCH", body: JSON.stringify({ action: "reorder", order: ids }) },
    TIMEOUTS.projects,
  );
}

/* --- Tags ---------------------------------------------------------------- */

export async function fetchTags(): Promise<Tag[]> {
  return jsonFetch<Tag[]>("/api/tags", {}, TIMEOUTS.projects);
}

export async function createTag(name: string, color: string): Promise<Tag> {
  return jsonFetch<Tag>(
    "/api/tags",
    { method: "POST", body: JSON.stringify({ name, color }) },
    TIMEOUTS.projects,
  );
}

export async function updateTag(id: string, patch: { name?: string; color?: string }): Promise<Tag> {
  return jsonFetch<Tag>(
    `/api/tags/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    TIMEOUTS.projects,
  );
}

export async function deleteTag(id: string): Promise<{ ok: boolean }> {
  return jsonFetch(
    `/api/tags/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    TIMEOUTS.projects,
  );
}

/* --- Objectifs ------------------------------------------------------------ */

export async function fetchObjectives(): Promise<Objective[]> {
  return jsonFetch<Objective[]>("/api/objectives", {}, TIMEOUTS.projects);
}

export async function createObjective(
  title: string,
  projectId: string,
  horizon: ObjectiveHorizon,
  notes?: string,
): Promise<Objective> {
  return jsonFetch<Objective>(
    "/api/objectives",
    { method: "POST", body: JSON.stringify({ title, projectId, horizon, notes }) },
    TIMEOUTS.projects,
  );
}

export async function updateObjective(
  id: string,
  patch: { title?: string; horizon?: ObjectiveHorizon; achievedAt?: string | null; notes?: string },
): Promise<Objective> {
  return jsonFetch<Objective>(
    "/api/objectives",
    { method: "PATCH", body: JSON.stringify({ id, ...patch }) },
    TIMEOUTS.projects,
  );
}

export async function deleteObjective(id: string): Promise<{ ok: boolean }> {
  return jsonFetch("/api/objectives", { method: "DELETE", body: JSON.stringify({ id }) }, TIMEOUTS.projects);
}
