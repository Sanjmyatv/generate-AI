import { prisma } from "@/lib/db";
import { getActor } from "@/lib/actor";
import { canAccess } from "@/lib/generations";

export const dynamic = "force-dynamic";

const PASS_THROUGH_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges"];

/**
 * GET /api/generations/:id/video[?download=1]
 *
 * Streams the finished video through our domain so the provider URL is never exposed.
 * Preview (inline playback) is allowed for the owner; downloading needs a signed-in
 * account. Range requests are forwarded because iOS Safari refuses to play video otherwise.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const download = new URL(req.url).searchParams.get("download") === "1";
  const actor = await getActor();

  const gen = await prisma.generation.findUnique({ where: { id } });
  if (!gen || !canAccess(gen, actor) || gen.status !== "COMPLETED" || !gen.outputUrl) {
    return new Response("Not found", { status: 404 });
  }
  if (download && !actor.userId) return new Response("Login required", { status: 401 });

  const headers: Record<string, string> = {};
  const range = req.headers.get("range");
  if (range) headers.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(gen.outputUrl, { headers, signal: AbortSignal.timeout(30_000) });
  } catch {
    return new Response("Upstream unavailable", { status: 502 });
  }
  if (!upstream.ok && upstream.status !== 206) return new Response("Upstream error", { status: 502 });

  const out = new Headers();
  for (const name of PASS_THROUGH_HEADERS) {
    const v = upstream.headers.get(name);
    if (v) out.set(name, v);
  }
  if (!out.has("content-type")) out.set("content-type", "video/mp4");
  out.set("X-Content-Type-Options", "nosniff");
  out.set("Cache-Control", "private, max-age=3600");
  if (download) out.set("Content-Disposition", `attachment; filename="creation-${gen.id}.mp4"`);

  return new Response(upstream.body, { status: upstream.status, headers: out });
}
