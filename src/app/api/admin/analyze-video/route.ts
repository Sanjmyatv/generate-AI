import { prisma } from "@/lib/db";
import { getAdmin } from "@/lib/admin";
import { geminiConfigured, GeminiError } from "@/lib/gemini";
import { analyzeTemplateVideo, type PromptStyle } from "@/lib/gemini-video";
import { assetIdFromUrl } from "@/lib/media";
import { MAX_PHOTOS } from "@/lib/template-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/analyze-video  { sourceVideoUrl, engine? }
 *
 * Admin only. Has Gemini watch a source video that was already uploaded in the template form
 * (so a large file is not sent twice) and returns a suggested setup: how many people, a scene
 * prompt and one upload instruction per person. Nothing is saved; the form applies it.
 */
export async function POST(req: Request) {
  if (!(await getAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!geminiConfigured()) return Response.json({ error: "not_configured" }, { status: 503 });

  let body: { sourceVideoUrl?: unknown; engine?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const id = typeof body.sourceVideoUrl === "string" ? assetIdFromUrl(body.sourceVideoUrl) : null;
  if (!id) return Response.json({ error: "upload_first" }, { status: 400 });

  const asset = await prisma.asset.findUnique({ where: { id }, select: { contentType: true, data: true } });
  if (!asset || !asset.contentType.startsWith("video/")) return Response.json({ error: "upload_first" }, { status: 400 });

  const style: PromptStyle = body.engine === "seedance-edit" ? "numbered-images" : "reference-images";
  try {
    const analysis = await analyzeTemplateVideo(
      { contentType: asset.contentType, data: asset.data },
      { style, maxPeople: MAX_PHOTOS },
    );
    return Response.json(analysis);
  } catch (e) {
    console.error("[admin] video analysis failed", e);
    return Response.json({ error: e instanceof GeminiError ? "analysis_failed" : "server_error" }, { status: 502 });
  }
}
