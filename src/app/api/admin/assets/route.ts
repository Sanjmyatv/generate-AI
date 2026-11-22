import { prisma } from "@/lib/db";
import { getAdmin } from "@/lib/admin";
import { storeAsset } from "@/lib/assets";
import { assetPath, mp4Duration, sniffMedia } from "@/lib/media";
import { optimizePreview } from "@/lib/preview-optimize";

export const dynamic = "force-dynamic";

/** A preview image plays on every visitor's phone, so it has to be light. (Video previews are shrunk on upload instead.) */
const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;
/** The thumbnail made from a preview video (about 480 px wide, tens of kilobytes). */
const MAX_POSTER_BYTES = 1024 * 1024;
const MAX_SOURCE_BYTES = 60 * 1024 * 1024;
/** Genjutsu needs at least 4 s of source video and trims anything past 30 s. */
const MIN_SOURCE_SECONDS = 4;

/**
 * POST /api/admin/assets  (multipart: file, purpose = "preview" | "source" | "poster")
 *
 * Admin only. Stores an uploaded preview (image or video) or source video (MP4/MOV) and
 * returns the public path to save on a template.
 */
export async function POST(req: Request) {
  if (!(await getAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const file = form.get("file");
  const purpose = form.get("purpose") === "source" ? "source" : form.get("purpose") === "poster" ? "poster" : "preview";
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "invalid_request" }, { status: 400 });

  // A video preview may arrive as a camera original: it is shrunk below, so it only has to fit the source-video limit.
  const limit = purpose === "poster" ? MAX_POSTER_BYTES : MAX_SOURCE_BYTES;
  if (file.size > limit) return Response.json({ error: "too_large", maxMb: limit / 1024 / 1024 }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const media = sniffMedia(bytes);
  if (!media) return Response.json({ error: "unsupported_type" }, { status: 400 });

  if (purpose === "poster" && media.kind !== "image") return Response.json({ error: "unsupported_type" }, { status: 400 });
  if (purpose === "preview" && media.kind === "image" && file.size > MAX_PREVIEW_BYTES) {
    return Response.json({ error: "too_large", maxMb: MAX_PREVIEW_BYTES / 1024 / 1024 }, { status: 413 });
  }

  // Every video preview is made the same small size (longer side 1080 px, 30 fps, no sound, at most 8 s, about a megabyte)
  // and gets a thumbnail, so no card or phone ever downloads a camera original.
  if (purpose === "preview" && media.kind === "video") {
    try {
      const optimized = await optimizePreview(bytes);
      const video = await storeAsset(new Uint8Array(optimized.video));
      const poster = await storeAsset(new Uint8Array(optimized.poster));
      return Response.json({ ...video, posterUrl: poster.url, originalSize: bytes.byteLength }, { status: 201 });
    } catch (e) {
      console.error("[assets] could not shrink the preview", e);
      // Without the shrinker only a clip that is already light is accepted.
      if (bytes.byteLength > MAX_PREVIEW_BYTES) return Response.json({ error: "optimize_failed" }, { status: 500 });
    }
  }

  let duration: number | null = null;
  if (media.kind === "video") duration = mp4Duration(bytes);
  if (purpose === "source") {
    if (media.kind !== "video" || media.ext === "webm") return Response.json({ error: "source_must_be_mp4" }, { status: 400 });
    if (duration !== null && duration < MIN_SOURCE_SECONDS) {
      return Response.json({ error: "source_too_short", minSeconds: MIN_SOURCE_SECONDS }, { status: 400 });
    }
  }

  const asset = await prisma.asset.create({
    data: { contentType: media.contentType, size: bytes.byteLength, duration, data: bytes },
    select: { id: true },
  });
  return Response.json(
    { id: asset.id, url: assetPath(asset.id, media.ext), kind: media.kind, duration, size: bytes.byteLength },
    { status: 201 },
  );
}
