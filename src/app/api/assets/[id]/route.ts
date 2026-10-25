import { prisma } from "@/lib/db";
import { serveBlob } from "@/lib/blob-response";
import { assetIdFromUrl } from "@/lib/media";

export const dynamic = "force-dynamic";

/**
 * GET /api/assets/:id[.ext]: media uploaded in the admin panel (template previews and source
 * videos). Intentionally unauthenticated: the AI provider fetches source videos server to
 * server. Access control is the unguessable random UUID, like /api/uploads/:id.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const id = assetIdFromUrl(`/api/assets/${raw}`);
  if (!id) return new Response("Not found", { status: 404 });

  const meta = await prisma.asset.findUnique({ where: { id }, select: { contentType: true, size: true } });
  if (!meta) return new Response("Not found", { status: 404 });

  const res = await serveBlob({
    contentType: meta.contentType,
    size: meta.size,
    rangeHeader: req.headers.get("range"),
    headers: {
      "X-Content-Type-Options": "nosniff",
      // Assets are immutable: replacing one creates a new id.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    readSlice: async (start, length) => {
      const rows = await prisma.$queryRaw<{ chunk: Uint8Array }[]>`
        SELECT substring("data" FROM ${start + 1}::int FOR ${length}::int) AS chunk
        FROM "Asset" WHERE "id" = ${id}`;
      return rows[0]?.chunk ?? null;
    },
  });
  return res ?? new Response("Not found", { status: 404 });
}
