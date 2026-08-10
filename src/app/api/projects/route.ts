import { requirePin } from "@/lib/guard";
import { readProjects } from "@/lib/store";

/**
 * Projets de Brief.
 *
 * Ne consulte plus aucun service tiers : les projets appartiennent à Brief,
 * sans plafond de nombre. La route reste en lecture seule pour l'instant ;
 * la création viendra avec l'écran de gestion.
 */
export async function GET(req: Request): Promise<Response> {
  const denied = requirePin(req);
  if (denied) return denied;

  return Response.json(await readProjects());
}
