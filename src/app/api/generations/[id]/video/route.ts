import { prisma } from "@/lib/db";
import { getActor } from "@/lib/actor";
import { canAccess } from "@/lib/generations";

export const dynamic = "force-dynamic";

const PASS_THROUGH_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges"];
/** Cap per ranged response so a metadata probe doesn't read a whole video from the database. */
const MAX_RANGE_BYTES = 4 * 1024 * 1024;

/** Serves our stored copy of the video, honouring a single Range header (iOS Safari needs 206). */
async function serveStored(
  id: string,
  rangeHeader: string | null,
  baseHeaders: Record<string, string>,
): Promise<Response | null> {
  const meta = await prisma.generationVideo.findUnique({
    where: { generationId: id },
    select: { contentType: true, size: true },
  });
  if (!meta) return null;

  const headers = { ...baseHeaders, "Content-Type": meta.contentType, "Accept-Ranges": "bytes" };
  const total = meta.size;
  let start = 0;
  let end = total - 1;
  let status = 200;

  const m = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()) : null;
  if (m && (m[1] || m[2])) {
    if (m[1] === "") {
      start = Math.max(total - Number(m[2]), 0); // suffix range: last N bytes
    } else {
      start = Number(m[1]);
      if (m[2]) end = Math.min(Number(m[2]), total - 1);
    }
    end = Math.min(end, start + MAX_RANGE_BYTES - 1);
    if (start > end || start >= total) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    }
    status = 206;
  }

  const length = end - start + 1;
  const rows = await prisma.$queryRaw<{ chunk: Uint8Array }[]>`
    SELECT substring("data" FROM ${start + 1}::int FOR ${length}::int) AS chunk
    FROM "GenerationVideo" WHERE "generationId" = ${id}`;
  const chunk = rows[0]?.chunk;
  if (!chunk) return null;

  const out = new Headers(headers);
  out.set("Content-Length", String(chunk.byteLength));
  if (status === 206) out.set("Content-Range", `bytes ${start}-${start + chunk.byteLength - 1}/${total}`);
  return new Response(new Uint8Array(chunk), { status, headers: out });
}

/**
 * GET /api/generations/:id/video[?download=1]
 *
 * Streams the finished video through our domain so the provider URL is never exposed.
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
  if (download) baseHeaders["Content-Disposition"] = `attachment; filename="creation-${gen.id}.mp4"`;

  const stored = await serveStored(id, req.headers.get("range"), baseHeaders);
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

  return new Response(upstream.body, { status: upstream.status, headers: out });
}
