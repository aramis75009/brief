import { requirePin } from "@/lib/guard";
import { parseSubscription, readSubscriptions } from "@/lib/push-store";
import { sendPushToAll } from "@/lib/webpush";

/**
 * Envoi immédiat d'une notification de test.
 *
 * Volontairement SANS paramètre de délai : le vrai ordonnanceur est le cron
 * (/api/cron/reminders). Un `delaySeconds` tenu par un timer en mémoire
 * marcherait en développement et ne partirait jamais en production.
 *
 * L'abonnement peut être fourni dans le corps pour se passer du stockage
 * serveur, utile quand on vérifie la chaîne depuis un environnement éphémère.
 */

export async function POST(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Corps vide accepté : on envoie la notification par défaut.
  }

  let targets;
  if (body.subscription) {
    const parsed = parseSubscription(body.subscription);
    if (!parsed.ok) {
      return Response.json({ error: `Abonnement invalide : ${parsed.reason}` }, { status: 400 });
    }
    targets = [parsed.sub];
  } else {
    targets = await readSubscriptions();
  }

  if (targets.length === 0) {
    return Response.json(
      {
        error:
          "Aucun abonnement connu. Active les notifications dans Réglages, ou passe `subscription` dans le corps.",
      },
      { status: 409 },
    );
  }

  const title = typeof body.title === "string" && body.title ? body.title : "Brief";
  const bodyText =
    typeof body.body === "string" && body.body
      ? body.body
      : `Test envoyé à ${new Date().toLocaleTimeString("fr-FR")}`;

  let outcomes;
  try {
    outcomes = await sendPushToAll(targets, { title, body: bodyText, tag: "brief-test", url: "/" });
  } catch (e) {
    // Clés VAPID absentes : configuration serveur, pas erreur d'abonnement.
    return Response.json(
      { error: e instanceof Error ? e.message : "Envoi impossible." },
      { status: 503 },
    );
  }

  const sent = outcomes.filter((o) => o.ok).length;
  const status = sent === 0 ? 502 : sent === outcomes.length ? 200 : 207;
  return Response.json({ sent, total: outcomes.length, outcomes }, { status });
}
