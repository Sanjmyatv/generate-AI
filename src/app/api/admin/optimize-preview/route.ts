import { getAdmin } from "@/lib/admin";
import { assetIdsOf, deleteUnusedAssets, storeAsset } from "@/lib/assets";
import { prisma } from "@/lib/db";
import { assetIdFromUrl } from "@/lib/media";
import { optimizePreview } from "@/lib/preview-optimize";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/admin/optimize-preview  { templateId }
 *
 * Admin only. Shrinks a template's uploaded video preview to the standard small size (longer side 1080 px, 30 fps,
 * no sound, at most 8 s, about a megabyte) and gives it a thumbnail, then points the template at the new files and removes the
 * old ones. Previews that are not uploads (files shipped with the site) are left alone.
 */
export async function POST(req: Request) {
  if (!(await getAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: { templateId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (typeof body.templateId !== "string") return Response.json({ error: "invalid_request" }, { status: 400 });

  const template = await prisma.template.findUnique({ where: { id: body.templateId } });
  const assetId = assetIdFromUrl(template?.previewUrl);
  if (!template || !assetId) return Response.json({ error: "not_an_upload" }, { status: 400 });

  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { contentType: true, size: true, data: true } });
  if (!asset || !asset.contentType.startsWith("video/")) return Response.json({ error: "not_a_video" }, { status: 400 });

  let optimized;
  try {
    optimized = await optimizePreview(asset.data);
  } catch (e) {
    console.error("[optimize-preview] failed", template.id, e);
    return Response.json({ error: "optimize_failed" }, { status: 500 });
  }
  const video = await storeAsset(new Uint8Array(optimized.video));
  const poster = await storeAsset(new Uint8Array(optimized.poster));
  const before = { previewUrl: template.previewUrl, previewPosterUrl: template.previewPosterUrl };
  await prisma.template.update({ where: { id: template.id }, data: { previewUrl: video.url, previewPosterUrl: poster.url } });
  await deleteUnusedAssets(assetIdsOf(before.previewUrl, null, before.previewPosterUrl));

  return Response.json({ url: video.url, posterUrl: poster.url, beforeBytes: asset.size, afterBytes: video.size });
}
