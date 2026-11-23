import { prisma } from "@/lib/db";
import { assetIdFromUrl, assetPath, mp4Duration, sniffMedia } from "@/lib/media";

/** Asset ids a template points at: its preview, the preview's thumbnail, its source video and that video's upscaled
 * copy for face swaps (see object-swap-video.ts). */
export function assetIdsOf(previewUrl: string | null, config: unknown, posterUrl: string | null = null) {
  const ids = [
    assetIdFromUrl(previewUrl),
    assetIdFromUrl(posterUrl),
    assetIdFromUrl((config as { templateVideoUrl?: string } | null)?.templateVideoUrl),
    assetIdFromUrl((config as { objectSwapVideo?: { url?: string } } | null)?.objectSwapVideo?.url),
  ];
  return ids.filter((id): id is string => id !== null);
}

/** Deletes uploaded files that no template points at any more. */
export async function deleteUnusedAssets(candidates: string[]) {
  if (candidates.length === 0) return;
  const templates = await prisma.template.findMany({ select: { previewUrl: true, previewPosterUrl: true, generationConfig: true } });
  const inUse = new Set(templates.flatMap((t) => assetIdsOf(t.previewUrl, t.generationConfig, t.previewPosterUrl)));
  const unused = candidates.filter((id) => !inUse.has(id));
  if (unused.length > 0) await prisma.asset.deleteMany({ where: { id: { in: unused } } });
}

/** Stores bytes as an asset and returns its public path. The type is sniffed from the bytes, never taken on trust. */
export async function storeAsset(bytes: Uint8Array<ArrayBuffer>) {
  const media = sniffMedia(bytes);
  if (!media) throw new Error("unsupported media type");
  const duration = media.kind === "video" ? mp4Duration(bytes) : null;
  const asset = await prisma.asset.create({
    data: { contentType: media.contentType, size: bytes.byteLength, duration, data: bytes },
    select: { id: true },
  });
  return { id: asset.id, url: assetPath(asset.id, media.ext), kind: media.kind, duration, size: bytes.byteLength };
}
