import { requireSession } from "@/lib/guard";
import { parseSubscription, removeSubscription, saveSubscription } from "@/lib/push-store";

/**
 * Enregistrement et retrait de l'abonnement Web Push du navigateur.
 *
 * Route handler et non Server Action : le raccourci iOS et les vérifications en
 * ligne de commande doivent pouvoir appeler une URL HTTP ordinaire.
 */

export async function POST(req: Request): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON illisible." }, { status: 400 });
  }

  const parsed = parseSubscription((body as { subscription?: unknown })?.subscription ?? body);
  if (!parsed.ok) {
    return Response.json({ error: `Abonnement invalide : ${parsed.reason}` }, { status: 400 });
  }
  const sub = parsed.sub;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  try {
    await saveSubscription({ endpoint: sub.endpoint, keys: sub.keys, userAgent });
  } catch (e) {
    // Le disque peut être en lecture seule. On le dit au lieu de prétendre que
    // l'abonnement est enregistré : un rappel qui ne partira jamais doit se voir.
    return Response.json(
      {
        error: "Abonnement reçu mais non persisté côté serveur.",
        detail: e instanceof Error ? e.message : String(e),
        persisted: false,
      },
      { status: 503 },
    );
  }

  return Response.json({ persisted: true, endpoint: sub.endpoint });
}

export async function DELETE(req: Request): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON illisible." }, { status: 400 });
  }

  const endpoint = (body as { endpoint?: unknown })?.endpoint;
  if (typeof endpoint !== "string" || !endpoint) {
    return Response.json({ error: "`endpoint` est requis." }, { status: 400 });
  }

  await removeSubscription(endpoint);
  return Response.json({ removed: true });
}
