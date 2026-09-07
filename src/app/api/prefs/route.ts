import { mergePrefs, DEFAULT_PREFS, type UserPrefs } from "@/lib/prefs";
import { requireStore } from "@/lib/guard";

/**
 * Préférences utilisateur — versionnées dans `users/<id>/prefs.json`.
 *
 * `GET` : lit (et fournit les défauts si absent).
 * `PATCH` : merge shallow d'un fragment `tasksToolbar` — ne sérialise pas
 * si le payload est vide (404 arrondi à 400 côté client).
 *
 * Garde : `requireStore` — le store résout le compte, comme partout.
 */

export async function GET() {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;
  const prefs = await store.readUserJson<UserPrefs>("prefs.json", DEFAULT_PREFS);
  return Response.json(prefs);
}

export async function PATCH(req: Request) {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;
  const patch = await req.json().catch(() => null);
  if (!patch || typeof patch !== "object") {
    return new Response("payload invalide", { status: 400 });
  }
  const current = await store.readUserJson<UserPrefs>("prefs.json", DEFAULT_PREFS);
  const next = mergePrefs(current, patch);
  if (JSON.stringify(next) === JSON.stringify(current)) {
    return Response.json(current); // rien à écrire
  }
  await store.writeUserJson("prefs.json", next);
  return Response.json(next);
}