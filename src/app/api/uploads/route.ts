import { prisma } from "@/lib/db";
import { getActor } from "@/lib/actor";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_UPLOADS_PER_HOUR = 20;
const RETENTION_MS = 24 * 60 * 60 * 1000;

/** Detects the real image type from magic bytes; never trust the client's MIME type. */
function sniffImageType(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const riff = String.fromCharCode(...b.slice(0, 4));
  const webp = String.fromCharCode(...b.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

export async function POST(req: Request) {
  const actor = await getActor({ createGuest: true });
  const ownerKey = actor.keys[0];

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!(file instanceof File)) return Response.json({ error: "invalid_request" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) {
    return Response.json({ error: "invalid_image" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) return Response.json({ error: "invalid_image" }, { status: 400 });

  const recent = await prisma.upload.count({
    where: { ownerKey, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_UPLOADS_PER_HOUR) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  // Opportunistic cleanup keeps selfies from living longer than needed.
  await prisma.upload.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } } });

  const upload = await prisma.upload.create({
    data: { ownerKey, contentType, data: bytes },
    select: { id: true },
  });
  return Response.json({ id: upload.id }, { status: 201 });
}
