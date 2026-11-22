import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFfmpeg } from "@/lib/ffmpeg";

/**
 * The one size every video preview is made: sharp on a phone or retina card (a 9:16 clip comes out 608 x 1080), yet
 * only about a megabyte, never a camera original.
 */
export const PREVIEW_MAX_SIDE = 1080;
export const PREVIEW_MAX_SECONDS = 8;
export interface OptimizedPreview {
  /** H.264 MP4, longer side at most 1080 px, 30 fps, no sound, at most 8 s, ready to stream (faststart). */
  video: Buffer;
  /** A JPEG still of it, for cards. */
  poster: Buffer;
}

/**
 * Makes a video preview light and uniform: the longer side scaled to at most 1080 px (even sizes, aspect kept), 30
 * frames a second, good-quality H.264 capped near 1.6 Mbit/s, sound removed (previews play muted), cut to 8 seconds,
 * with the index at the front so it starts playing before it has downloaded. A 15 s, 1080p phone clip of many
 * megabytes comes out at roughly one megabyte. The poster is a sharp frame half a second in.
 */
export async function optimizePreview(input: Uint8Array): Promise<OptimizedPreview> {
  const dir = await mkdtemp(join(tmpdir(), "zyro-preview-"));
  try {
    const source = join(dir, "in");
    const video = join(dir, "out.mp4");
    const poster = join(dir, "poster.jpg");
    await writeFile(source, input);
    await runFfmpeg([
      "-i", source,
      "-t", String(PREVIEW_MAX_SECONDS),
      "-an",
      "-vf", `scale=w='if(gte(iw,ih),min(${PREVIEW_MAX_SIDE},iw),-2)':h='if(gte(iw,ih),-2,min(${PREVIEW_MAX_SIDE},ih))',fps=30`,
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "23",
      "-maxrate", "1600k",
      "-bufsize", "3200k",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      video,
    ]);
    await runFfmpeg(["-i", video, "-ss", "0.5", "-frames:v", "1", "-q:v", "3", poster]);
    return { video: await readFile(video), poster: await readFile(poster) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
