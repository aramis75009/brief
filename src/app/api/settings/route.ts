import { requireStore } from "@/lib/guard";
import { applySettingsPatch } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Les interrupteurs de la chaîne — synchro CalDAV, récap du matin.
 *
 *   GET   /api/settings          → l'état complet
 *   PATCH /api/settings          → patch partiel, rend l'état complet
 *
 * Deux verbes, pas plus : il n'y a rien à créer ni à supprimer, les réglages
 * existent toujours (avec leurs défauts). C'est aussi ce qui rend l'écriture
 * sûre — `PATCH` ne peut que basculer des booléens connus, jamais introduire
 * une clé (`applySettingsPatch`, testé).
 *
 * Garde : `requireStore()` seule. Un réglage est une ÉCRITURE, même quand il
 * ne touche qu'un booléen — pas de jeton machine ici, et surtout pas la garde
 * mixte de `/api/agenda`, qui est réservée à la lecture.
 */

export async function GET(): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  return Response.json(await store.readSettings());
}

export async function PATCH(req: Request): Promise<Response> {
  const session = await requireStore();
  if (session instanceof Response) return session;
  const { store } = session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  // `applySettingsPatch` rend la même référence quand rien ne bouge :
  // `updateSettingsAtomically` saute alors l'écriture disque.
  const settings = await store.updateSettingsAtomically((current) =>
    applySettingsPatch(current, body),
  );
  return Response.json(settings);
}
