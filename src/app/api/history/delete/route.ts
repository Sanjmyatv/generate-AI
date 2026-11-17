import { getActor } from "@/lib/actor";
import { MAX_BULK_DELETE, deleteGenerations } from "@/lib/generations";

export const dynamic = "force-dynamic";

/**
 * POST /api/history/delete  { ids: string[] }  (at most 100)
 *
 * Deletes the signed-in user's own finished history items: the media and the source photos go, one metadata row
 * stays. Ids that are not the caller's are ignored, so nobody can delete someone else's creations.
 */
export async function POST(req: Request) {
  const actor = await getActor();
  if (!actor.userId) return Response.json({ error: "login_required" }, { status: 401 });

  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id): id is string => typeof id === "string")) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (ids.length > MAX_BULK_DELETE) return Response.json({ error: "too_many" }, { status: 400 });

  const deleted = await deleteGenerations(actor.userId, [...new Set(ids)]);
  return Response.json({ deleted });
}
