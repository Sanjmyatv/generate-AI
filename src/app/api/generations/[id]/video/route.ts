import { prisma } from "@/lib/db";
import { getActor } from "@/lib/actor";
import { attachmentHeader, canAccess, downloadFileName, resultExtension } from "@/lib/generations";
import { templateName } from "@/lib/i18n/content";
import { getLocale } from "@/lib/i18n/server";
import { serveBlob } from "@/lib/blob-response";
import { watermarkedOnce } from "@/lib/watermark";

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

/** The whole result (stored copy, else the provider's file), for watermarking. */
async function loadWhole(id: string, outputUrl: string | null): Promise<{ data: Uint8Array; contentType: string }> {
  const stored = await prisma.generationVideo.findUnique({ where: { generationId: id }, select: { data: true, contentType: true } });
  if (stored) return { data: stored.data, contentType: stored.contentType };
  if (!outputUrl) throw new Error("no_result");
  const res = await fetch(outputUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  const type = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  return { data: new Uint8Array(await res.arrayBuffer()), contentType: type.startsWith("image/") ? type : "video/mp4" };
}

/**
 * GET /api/generations/:id/video[?download=1[&watermark=1]]  (serves the result, a video or an image)
 *
 * Streams the finished result through our domain so the provider URL is never exposed.
 * Prefers our stored copy (see archiveVideo) and falls back to the provider URL for
 * generations that finished before it was archived. Preview (inline playback) is allowed
 * for the owner; downloading needs a signed-in account. With `watermark=1` the download carries the small
 * "Made with ZYRO" badge in its bottom-right corner (see addWatermark).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const params = new URL(req.url).searchParams;
  const download = params.get("download") === "1";
  const watermark = download && params.get("watermark") === "1";
  const actor = await getActor();

  const gen = await prisma.generation.findUnique({ where: { id } });
  if (!gen || gen.deletedAt || !canAccess(gen, actor) || gen.status !== "COMPLETED") {
    return new Response("Not found", { status: 404 });
  }
  if (download && !actor.userId) return new Response("Login required", { status: 401 });

  const baseHeaders: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=3600",
  };
  // Saved as "zyro-<template title>-<date>", in the visitor's language.
  let title = "";
  if (download) {
    const [template, locale] = await Promise.all([
      prisma.template.findUnique({ where: { id: gen.templateId }, select: { name: true, nameMn: true } }),
      getLocale(),
    ]);
    title = template ? templateName(template, locale) : "";
  }
  const disposition = (contentType: string) =>
    download ? attachmentHeader(downloadFileName(title, gen.createdAt, resultExtension(contentType))) : undefined;

  if (watermark) {
    try {
      const result = await watermarkedOnce(id, () => loadWhole(id, gen.outputUrl));
      const headers = new Headers(baseHeaders);
      headers.set("Content-Type", result.contentType);
      headers.set("Content-Length", String(result.data.byteLength));
      headers.set("Content-Disposition", disposition(result.contentType)!);
      return new Response(new Uint8Array(result.data), { headers });
    } catch (e) {
      // Never leave someone without their file: fall back to the plain download.
      console.error(`[watermark] ${id}:`, e);
    }
  }

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
