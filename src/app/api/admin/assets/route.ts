import { prisma } from "@/lib/db";
import { getAdmin } from "@/lib/admin";
import { assetPath, mp4Duration, sniffMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

const MAX_PREVIEW_BYTES = 30 * 1024 * 1024;
const MAX_SOURCE_BYTES = 60 * 1024 * 1024;
/** Genjutsu needs at least 4 s of source video and trims anything past 30 s. */
const MIN_SOURCE_SECONDS = 4;

/**
 * POST /api/admin/assets  (multipart: file, purpose = "preview" | "source")
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
  const purpose = form.get("purpose") === "source" ? "source" : "preview";
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "invalid_request" }, { status: 400 });

  const limit = purpose === "source" ? MAX_SOURCE_BYTES : MAX_PREVIEW_BYTES;
  if (file.size > limit) return Response.json({ error: "too_large", maxMb: limit / 1024 / 1024 }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const media = sniffMedia(bytes);
  if (!media) return Response.json({ error: "unsupported_type" }, { status: 400 });

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
