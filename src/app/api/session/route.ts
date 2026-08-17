import { requirePin } from "@/lib/guard";

/**
 * Valide un PIN. Ne pose aucun cookie : le client mémorise le code par appareil
 * (localStorage) et le renvoie en header sur chaque appel /api/*.
 */
export async function POST(req: Request) {
  const denied = requirePin(req);
  if (denied) return denied;

  return Response.json({ ok: true });
}
