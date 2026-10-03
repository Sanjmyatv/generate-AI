import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Intentionally unauthenticated: the AI provider fetches this URL server-to-server.
// Access control is the unguessable random UUID plus the 24h retention in POST /api/uploads.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const upload = await prisma.upload.findUnique({ where: { id } });
  if (!upload) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(upload.data), {
    headers: {
      "Content-Type": upload.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
