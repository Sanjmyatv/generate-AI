import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probeSize, runFfmpeg } from "@/lib/ffmpeg";

/** The "Made with ZYRO" badge (a transparent PNG). */
const WATERMARK = join(process.cwd(), "public", "brand", "watermark.png");
/** Badge width as a share of the picture's shorter side, and the gap to the bottom-right corner. */
const WIDTH_SHARE = 0.22;
const MARGIN_SHARE = 0.025;

export interface Watermarked {
  data: Buffer;
  contentType: string;
}

/**
 * Stamps the badge, small, in the bottom-right corner of a finished video or image. It is sized from the shorter side,
 * so it looks the same on 9:16, 1:1 and 16:9. A video is re-encoded (H.264, near-original quality, sound kept); a
 * PNG or WebP image comes back as PNG and a JPEG as JPEG.
 */
export async function addWatermark(input: Uint8Array, contentType: string): Promise<Watermarked> {
  const isVideo = contentType.startsWith("video/");
  const isJpeg = contentType === "image/jpeg";
  const outName = isVideo ? "out.mp4" : isJpeg ? "out.jpg" : "out.png";
  const dir = await mkdtemp(join(tmpdir(), "zyro-wm-"));
  try {
    const source = join(dir, "in");
    const out = join(dir, outName);
    await writeFile(source, input);
    const { width, height } = await probeSize(source);
    const short = Math.min(width, height);
    const badge = Math.max(2, Math.round((short * WIDTH_SHARE) / 2) * 2); // even, for the video encoder
    const margin = Math.round(short * MARGIN_SHARE);
    const graph = `[1:v]scale=${badge}:-1[wm];[0:v][wm]overlay=x=W-w-${margin}:y=H-h-${margin}[out]`;
    const encode = isVideo
      ? ["-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart"]
      : ["-frames:v", "1", ...(isJpeg ? ["-q:v", "2"] : [])];
    await runFfmpeg(["-i", source, "-i", WATERMARK, "-filter_complex", graph, "-map", "[out]", ...encode, out], 180_000);
    return { data: await readFile(out), contentType: isVideo ? "video/mp4" : isJpeg ? "image/jpeg" : "image/png" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * The last few watermarked results, kept in memory: the phone's share sheet fetches the file ahead of the tap, and
 * people often press Download twice, so the same video is not re-encoded each time. Concurrent requests share one job.
 */
const cache = new Map<string, Promise<Watermarked>>();
const CACHE_SIZE = 4;

export function watermarkedOnce(key: string, load: () => Promise<{ data: Uint8Array; contentType: string }>) {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit); // most recently used last
    return hit;
  }
  const job = load().then(({ data, contentType }) => addWatermark(data, contentType));
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return job;
}
