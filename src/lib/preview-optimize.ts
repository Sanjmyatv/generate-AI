import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFfmpeg } from "@/lib/ffmpeg";

/** The one size every video preview is made: a phone downloads about half a megabyte, never a camera original. */
export const PREVIEW_MAX_WIDTH = 360;
export const PREVIEW_MAX_SECONDS = 8;
export interface OptimizedPreview {
  /** H.264 MP4, at most 360 px wide, 24 fps, no sound, at most 8 s, ready to stream (faststart). */
  video: Buffer;
  /** A JPEG still of it, for cards. */
  poster: Buffer;
}

/**
 * Makes a video preview small and uniform: scaled to at most 360 px wide (even sizes, aspect kept), 24 frames a
 * second, constant-quality H.264 capped near 0.6 Mbit/s, sound removed (previews play muted), cut to 8 seconds, with
 * the index at the front so it starts playing before it has downloaded. A 15 s, 720p phone clip of several
 * megabytes comes out at roughly half a megabyte. The poster is a frame half a second in.
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
      "-vf", `scale=w='min(${PREVIEW_MAX_WIDTH},iw)':h=-2,fps=24`,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "30",
      "-maxrate", "600k",
      "-bufsize", "1200k",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      video,
    ]);
    await runFfmpeg(["-i", video, "-ss", "0.5", "-frames:v", "1", "-q:v", "6", poster]);
    return { video: await readFile(video), poster: await readFile(poster) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
