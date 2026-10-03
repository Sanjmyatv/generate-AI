import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const categories = [
    { id: "trending", name: "Trending", sortOrder: 0 },
    { id: "dance", name: "Dance", sortOrder: 1 },
    { id: "horoscope", name: "Horoscope", sortOrder: 2 },
  ];

  const templates = [
    {
      id: "dance-transformation",
      name: "Dance Transformation",
      description: "Upload your photo and generate an AI dance video.",
      categoryId: "dance",
      type: "VIDEO" as const,
      creditCost: 5,
      aspectRatio: "9:16",
      requiredPhotoCount: 1,
      photoRequirement: "FULL_BODY" as const,
      trendingRank: 1,
    },
    {
      id: "street-dance",
      name: "Street Dance",
      description: "Turn your photo into a street dance clip.",
      categoryId: "dance",
      type: "VIDEO" as const,
      creditCost: 5,
      aspectRatio: "9:16",
      requiredPhotoCount: 1,
      photoRequirement: "FULL_BODY" as const,
      trendingRank: null,
    },
    {
      id: "zodiac-portrait",
      name: "Zodiac Portrait",
      description: "A mystical portrait styled after your zodiac sign.",
      categoryId: "horoscope",
      type: "IMAGE" as const,
      creditCost: 1,
      aspectRatio: "3:4",
      requiredPhotoCount: 1,
      photoRequirement: "FACE" as const,
      trendingRank: 2,
    },
    {
      id: "celestial-couple",
      name: "Celestial Couple",
      description: "A cosmic portrait of two people under the stars.",
      categoryId: "horoscope",
      type: "IMAGE" as const,
      creditCost: 2,
      aspectRatio: "3:4",
      requiredPhotoCount: 2,
      photoRequirement: "FACE" as const,
      trendingRank: 3,
    },
  ];

  const packages = [
    { id: "starter", name: "Starter Pack", credits: 20, priceMnt: 15000, sortOrder: 0 },
    { id: "value", name: "Value Pack", credits: 50, priceMnt: 25000, sortOrder: 1 },
  ];

  // Bump when the template definition below changes; the seed re-applies it to an
  // existing row only when the stored version is older (so later admin edits survive).
  const THREE_GUYS_VERSION = 2;

  // Hidden edit instruction for the Seedance video-edit model. Users never see it.
  const threeGuysConfig = {
    version: THREE_GUYS_VERSION,
    provider: "seedance",
    // Replace with the real, publicly reachable template video (set
    // THREE_GUYS_TEMPLATE_VIDEO_URL on the server and redeploy to apply it).
    templateVideoUrl:
      process.env.THREE_GUYS_TEMPLATE_VIDEO_URL ?? "https://example.com/REPLACE-ME/three-guys-dancing.mp4",
    // "Video 1" is the template video; "Image 1..3" are the users' photos in upload order
    // (ModelArk's reference syntax). Dancers are assigned left to right.
    prompt:
      "Edit the video: replace the three dancing men in Video 1 with three different people. " +
      "The dancer on the left becomes the person in Image 1, the dancer in the middle becomes the person in Image 2, " +
      "and the dancer on the right becomes the person in Image 3. " +
      "Keep the original choreography, funny dance moves, timing, camera movement, lighting and background of Video 1 exactly the same. " +
      "Each dancer must clearly have the face, hairstyle and identity of their matching reference image.",
    resolution: "720p",
    duration: 5,
    generateAudio: true,
  };
  const threeGuys = {
    id: "three-guys-dancing",
    name: "3 Guys Dancing",
    description: "Put yourself and two friends in the funniest dance trio on the internet.",
    categoryId: "dance",
    type: "VIDEO" as const,
    creditCost: 5,
    aspectRatio: "9:16",
    requiredPhotoCount: 3,
    photoLabels: ["Dancer on the left", "Dancer in the middle", "Dancer on the right"],
    photoRequirement: "FACE" as const,
    trendingRank: 0,
    generationConfig: threeGuysConfig,
  };

  // Idempotent and non-destructive: rows that already exist (and any admin edits to
  // them) are left alone, so new seed entries can ship with every deploy.
  for (const c of categories) {
    await prisma.category.upsert({ where: { id: c.id }, update: {}, create: c });
  }
  for (const t of templates) {
    await prisma.template.upsert({ where: { id: t.id }, update: {}, create: t });
  }
  const existing = await prisma.template.findUnique({ where: { id: threeGuys.id } });
  const storedVersion = (existing?.generationConfig as { version?: number } | null)?.version ?? 0;
  if (!existing) {
    await prisma.template.create({ data: threeGuys });
  } else if (storedVersion < THREE_GUYS_VERSION && process.env.THREE_GUYS_TEMPLATE_VIDEO_URL) {
    // Only upgrade once a real template video URL is provided.
    await prisma.template.update({
      where: { id: threeGuys.id },
      data: {
        description: threeGuys.description,
        requiredPhotoCount: threeGuys.requiredPhotoCount,
        photoLabels: threeGuys.photoLabels,
        generationConfig: threeGuysConfig,
      },
    });
  }
  for (const p of packages) {
    await prisma.creditPackage.upsert({ where: { id: p.id }, update: {}, create: p });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
