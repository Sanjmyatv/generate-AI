import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { storeAsset } from "@/lib/assets";
import { probeSize, runFfmpeg } from "@/lib/ffmpeg";
import { assetIdFromUrl } from "@/lib/media";

/** Genjutsu Object Swap refuses videos with fewer pixels per frame than this (motion transfer has no such limit). */
export const OBJECT_SWAP_MIN_PIXELS = 409_600;
/** Aim a little above the limit, so rounding on Higgsfield's side cannot push it under. */
const TARGET_PIXELS = OBJECT_SWAP_MIN_PIXELS * 1.08;

/** Stored in the template's generationConfig: the copy made for `source`, reused until the source video changes. */
export interface ObjectSwapVideo {
  source: string;
  /** Our asset path of the upscaled copy, or the source itself when it was already big enough. */
  url: string;
}

/** The size an under-sized frame is scaled up to: same shape, just over the minimum, even numbers for H.264. */
export function upscaledSize(width: number, height: number) {
  if (width * height >= OBJECT_SWAP_MIN_PIXELS) return null;
  const factor = Math.sqrt(TARGET_PIXELS / (width * height));
  return { width: Math.ceil((width * factor) / 2) * 2, height: Math.ceil((height * factor) / 2) * 2 };
}

async function sourceBytes(source: string) {
  const id = assetIdFromUrl(source);
  if (id) {
    const asset = await prisma.asset.findUnique({ where: { id }, select: { data: true } });
    if (asset) return asset.data;
  }
  const res = await fetch(source, { signal: AbortSignal.timeout(60_000), cache: "no-store" });
  if (!res.ok) throw new Error(`could not download the template video (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

async function prepare(templateId: string, source: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "zyro-os-"));
  let url = source;
  try {
    const input = join(dir, "in");
    await writeFile(input, await sourceBytes(source));
    const { width, height } = await probeSize(input);
    const size = upscaledSize(width, height);
    if (size) {
      const out = join(dir, "out.mp4");
      await runFfmpeg(
        [
          "-i", input, "-map", "0:v:0", "-map", "0:a?",
          "-vf", `scale=${size.width}:${size.height}:flags=lanczos`,
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out,
        ],
        240_000,
      );
      const stored = await storeAsset(new Uint8Array(await readFile(out)));
      url = stored.url;
      console.log(`[object-swap] ${templateId}: source ${width}x${height} upscaled to ${size.width}x${size.height}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  // Remember it on the template (merged into the current config, which may have changed meanwhile).
  const current = await prisma.template.findUnique({ where: { id: templateId }, select: { generationConfig: true } });
  const config = (current?.generationConfig ?? {}) as Record<string, unknown>;
  if (config.templateVideoUrl === source) {
    const objectSwapVideo: ObjectSwapVideo = { source, url };
    await prisma.template.update({ where: { id: templateId }, data: { generationConfig: { ...config, objectSwapVideo } as object } });
  }
  return url;
}

const jobs = new Map<string, Promise<string>>();

/**
 * The template video to send to Object Swap: the source itself when it is big enough, else an upscaled copy, made
 * once (the first face swap on the template waits for it) and stored as an asset. Returns a path or a full URL.
 */
export function objectSwapSource(templateId: string, config: unknown, source: string): Promise<string> {
  const saved = (config as { objectSwapVideo?: ObjectSwapVideo } | null)?.objectSwapVideo;
  if (saved?.source === source && saved.url) return Promise.resolve(saved.url);
  const key = `${templateId}\n${source}`;
  let job = jobs.get(key);
  if (!job) {
    job = prepare(templateId, source).finally(() => jobs.delete(key));
    jobs.set(key, job);
  }
  return job;
}
