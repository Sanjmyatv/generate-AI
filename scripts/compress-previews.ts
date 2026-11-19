/**
 * Shrinks template preview videos and gives every video preview a poster (the still picture cards show), so the
 * home page stops downloading megabytes of video. It makes exactly what the admin panel makes on upload and in
 * "Shrink all" (see src/lib/preview-optimize.ts): H.264, at most 360 px wide, 24 fps, no sound, at most 8 s, about
 * half a megabyte, so every preview ends up the same small size.
 *
 *   npm run compress-previews                 dry run: compresses in memory and prints the savings, changes nothing
 *   npm run compress-previews -- --apply      saves the smaller videos and missing posters and points templates at them
 *   npm run compress-previews -- --apply --only=a,b   only those template ids
 *
 * ffmpeg comes with the app (the ffmpeg-static package); nothing else needs installing. Uses DATABASE_URL like the app.
 *
 * A new Asset is written and the template is pointed at it (assets are cached as immutable, so they are never
 * changed in place). The old asset is kept so a template can be pointed back; the ids are printed. A video that
 * would not shrink by at least 10% is left alone. Previews that are not uploaded assets (files in /public, outside
 * links) are skipped.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { assetIdFromUrl, assetPath, mp4Duration, sniffMedia } from "../src/lib/media";
import { optimizePreview } from "../src/lib/preview-optimize";

const MIN_SAVING = 0.1;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

async function main() {
  const apply = process.argv.includes("--apply");
  const only = new Set((process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? "").split(",").filter(Boolean));

  const templates = await prisma.template.findMany({
    where: { previewUrl: { not: null } },
    select: { id: true, name: true, previewUrl: true, previewPosterUrl: true },
    orderBy: { name: "asc" },
  });

  const rows: Record<string, string>[] = [];
  const replaced: { template: string; oldUrl: string }[] = [];
  let before = 0;
  let after = 0;

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

    let optimized;
    try {
      optimized = await optimizePreview(original);
    } catch (e) {
      rows.push({ template: t.name, result: `failed: ${(e as Error).message.split("\n")[0]}` });
      continue;
    }
    const video = optimized.video.byteLength <= original.byteLength * (1 - MIN_SAVING) ? new Uint8Array(optimized.video) : null;
    const needsPoster = !t.previewPosterUrl;
    const posterBytes = needsPoster ? new Uint8Array(optimized.poster) : null;

    before += original.byteLength;
    after += video?.byteLength ?? original.byteLength;
    rows.push({
      template: t.name,
      before: mb(original.byteLength),
      after: video ? mb(video.byteLength) : "(kept)",
      saved: video ? `${Math.round((1 - video.byteLength / original.byteLength) * 100)}%` : "-",
      poster: posterBytes ? `new, ${Math.round(posterBytes.byteLength / 1024)} KB` : "has one",
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
