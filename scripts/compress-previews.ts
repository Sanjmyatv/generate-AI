/**
 * Shrinks template preview videos and gives every video preview a poster (the still picture cards show), so the
 * home page stops downloading megabytes of video.
 *
 *   npm run compress-previews                 dry run: compresses in a temp folder and prints the savings, changes nothing
 *   npm run compress-previews -- --apply      saves the smaller videos and missing posters and points templates at them
 *   npm run compress-previews -- --apply --only=a,b   only those template ids
 *
 * Needs ffmpeg: on PATH, or its path in FFMPEG_PATH. Uses DATABASE_URL like the app.
 *
 * Each video becomes H.264, at most 540 px wide and 30 fps, quality CRF 28, no audio (previews always play muted),
 * with the index at the front so playback starts before the download ends. A new Asset is written and the template
 * is pointed at it (assets are cached as immutable, so they are never changed in place). The old asset is kept so a
 * template can be pointed back; the ids are printed. A video that would not shrink by at least 10% is left alone.
 * Previews that are not uploaded assets (files in /public, outside links) are skipped.
 */
import "dotenv/config";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { assetIdFromUrl, assetPath, mp4Duration, sniffMedia } from "../src/lib/media";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const MIN_SAVING = 0.1;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

async function compressVideo(input: string, output: string) {
  await run(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", input,
    "-vf", "scale='min(540,iw)':-2:flags=lanczos",
    "-fpsmax", "30",
    "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-an",
    "-movflags", "+faststart",
    output,
  ]);
}

async function makePoster(input: string, output: string) {
  // Half a second in, not frame zero: the first frame is often black or a fade-in.
  await run(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", "0.5", "-i", input,
    "-frames:v", "1",
    "-vf", "scale='min(480,iw)':-2",
    "-q:v", "4",
    output,
  ]);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const only = new Set((process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? "").split(",").filter(Boolean));

  try {
    await run(FFMPEG, ["-version"]);
  } catch {
    throw new Error(`ffmpeg not found (${FFMPEG}). Install it or set FFMPEG_PATH.`);
  }

  const templates = await prisma.template.findMany({
    where: { previewUrl: { not: null } },
    select: { id: true, name: true, previewUrl: true, previewPosterUrl: true },
    orderBy: { name: "asc" },
  });

  const dir = await mkdtemp(join(tmpdir(), "zyro-previews-"));
  const rows: Record<string, string>[] = [];
  const replaced: { template: string; oldUrl: string }[] = [];
  let before = 0;
  let after = 0;

  try {
    for (const t of templates) {
      if (only.size && !only.has(t.id)) continue;
      const id = assetIdFromUrl(t.previewUrl);
      if (!id) {
        rows.push({ template: t.name, result: "skipped (not an uploaded asset)" });
        continue;
      }
      const asset = await prisma.asset.findUnique({ where: { id } });
      if (!asset) {
        rows.push({ template: t.name, result: "skipped (asset missing)" });
        continue;
      }
      const original = new Uint8Array(asset.data);
      if (sniffMedia(original)?.kind !== "video") {
        rows.push({ template: t.name, result: "skipped (image preview)" });
        continue;
      }

      const input = join(dir, `${t.id}-in`);
      const output = join(dir, `${t.id}-out.mp4`);
      const poster = join(dir, `${t.id}-poster.jpg`);
      await writeFile(input, original);

      let video: Uint8Array<ArrayBuffer> | null = null;
      try {
        await compressVideo(input, output);
        const small = new Uint8Array(await readFile(output));
        if (small.byteLength <= original.byteLength * (1 - MIN_SAVING)) video = small;
      } catch (e) {
        rows.push({ template: t.name, result: `failed: ${(e as Error).message.split("\n")[0]}` });
        continue;
      }

      const needsPoster = !t.previewPosterUrl;
      let posterBytes: Uint8Array<ArrayBuffer> | null = null;
      if (needsPoster) {
        await makePoster(video ? output : input, poster);
        posterBytes = new Uint8Array(await readFile(poster));
      }

      before += original.byteLength;
      after += video?.byteLength ?? original.byteLength;
      rows.push({
        template: t.name,
        before: mb(original.byteLength),
        after: video ? mb(video.byteLength) : "(kept)",
        saved: video ? `${Math.round((1 - video.byteLength / original.byteLength) * 100)}%` : "-",
        poster: needsPoster ? `new, ${Math.round(posterBytes!.byteLength / 1024)} KB` : "has one",
      });

      if (!apply || (!video && !posterBytes)) continue;

      const data: { previewUrl?: string; previewPosterUrl?: string } = {};
      if (video) {
        const created = await prisma.asset.create({
          data: { contentType: "video/mp4", size: video.byteLength, duration: mp4Duration(video), data: video },
          select: { id: true },
        });
        data.previewUrl = assetPath(created.id, "mp4");
        replaced.push({ template: t.id, oldUrl: t.previewUrl! });
      }
      if (posterBytes) {
        const created = await prisma.asset.create({
          data: { contentType: "image/jpeg", size: posterBytes.byteLength, duration: null, data: posterBytes },
          select: { id: true },
        });
        data.previewPosterUrl = assetPath(created.id, "jpg");
      }
      await prisma.template.update({ where: { id: t.id }, data });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  console.table(rows);
  console.log(`Video previews: ${mb(before)} → ${mb(after)}`);
  if (!apply) {
    console.log("Dry run: nothing was changed. Run again with --apply to save.");
  } else if (replaced.length) {
    console.log("Old previews were kept. To undo one, set the template's previewUrl back to:");
    console.table(replaced);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
