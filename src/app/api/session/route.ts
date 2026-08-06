import { requirePin } from "@/lib/guard";

/**
 * Valide un PIN. Ne pose aucun cookie : le client range le code en
 * sessionStorage et le renvoie en header sur chaque appel /api/*.
 */
export async function POST(req: Request) {
  const denied = requirePin(req);
  if (denied) return denied;

  return Response.json({ ok: true });
}
