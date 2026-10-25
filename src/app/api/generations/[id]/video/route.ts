import { prisma } from "@/lib/db";
import { getActor } from "@/lib/actor";
import { canAccess, resultExtension } from "@/lib/generations";
import { serveBlob } from "@/lib/blob-response";

export const dynamic = "force-dynamic";

const PASS_THROUGH_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges"];

/** Serves our stored copy of the result (see archiveVideo), or null if there isn't one. */
async function serveStored(
  id: string,
  rangeHeader: string | null,
  baseHeaders: Record<string, string>,
  disposition: (contentType: string) => string | undefined,
): Promise<Response | null> {
  const meta = await prisma.generationVideo.findUnique({
    where: { generationId: id },
    select: { contentType: true, size: true },
  });
  if (!meta) return null;

  const headers = { ...baseHeaders };
  const attachment = disposition(meta.contentType);
  if (attachment) headers["Content-Disposition"] = attachment;

  return serveBlob({
    contentType: meta.contentType,
    size: meta.size,
    rangeHeader,
    headers,
    readSlice: async (start, length) => {
      const rows = await prisma.$queryRaw<{ chunk: Uint8Array }[]>`
        SELECT substring("data" FROM ${start + 1}::int FOR ${length}::int) AS chunk
        FROM "GenerationVideo" WHERE "generationId" = ${id}`;
      return rows[0]?.chunk ?? null;
    },
  });
}

/**
 * GET /api/generations/:id/video[?download=1]  (serves the result, a video or an image)
 *
 * Streams the finished result through our domain so the provider URL is never exposed.
 * Prefers our stored copy (see archiveVideo) and falls back to the provider URL for
 * generations that finished before it was archived. Preview (inline playback) is allowed
 * for the owner; downloading needs a signed-in account.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const download = new URL(req.url).searchParams.get("download") === "1";
  const actor = await getActor();

  const gen = await prisma.generation.findUnique({ where: { id } });
  if (!gen || !canAccess(gen, actor) || gen.status !== "COMPLETED") {
    return new Response("Not found", { status: 404 });
  }
  if (download && !actor.userId) return new Response("Login required", { status: 401 });

  const baseHeaders: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=3600",
  };
  const disposition = (contentType: string) =>
    download ? `attachment; filename="creation-${gen.id}.${resultExtension(contentType)}"` : undefined;

  const stored = await serveStored(id, req.headers.get("range"), baseHeaders, disposition);
  if (stored) return stored;
  if (!gen.outputUrl) return new Response("Not found", { status: 404 });

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

  const out = new Headers(baseHeaders);
  for (const name of PASS_THROUGH_HEADERS) {
    const v = upstream.headers.get(name);
    if (v) out.set(name, v);
  }
  if (!out.has("content-type")) out.set("content-type", "video/mp4");
  const attachment = disposition(out.get("content-type") ?? "");
  if (attachment) out.set("Content-Disposition", attachment);

  return new Response(upstream.body, { status: upstream.status, headers: out });
}
