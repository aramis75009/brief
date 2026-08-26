import { requireSession } from "@/lib/guard";

export async function GET(): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;
  return Response.json({ authenticated: true });
}
