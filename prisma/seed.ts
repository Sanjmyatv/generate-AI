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

  // Hidden edit instruction for the Seedance video-edit model. Users never see it.
  const threeGuysConfig = {
    provider: "seedance",
    // Replace with the real, publicly reachable template video (set
    // THREE_GUYS_TEMPLATE_VIDEO_URL on the server and redeploy to apply it).
    templateVideoUrl:
      process.env.THREE_GUYS_TEMPLATE_VIDEO_URL ?? "https://example.com/REPLACE-ME/three-guys-dancing.mp4",
    // "Video 1" is the template video and "Image 1" the user's photo (ModelArk's reference syntax).
    prompt:
      "Edit the video: replace the three dancing men in Video 1 with the person in Image 1. " +
      "Keep the original choreography, funny dance moves, timing, camera movement, lighting and background of Video 1 exactly the same. " +
      "All three dancers must clearly have the face, hairstyle and identity of the person in Image 1.",
    resolution: "720p",
    duration: 5,
    generateAudio: true,
  };
  const threeGuys = {
    id: "three-guys-dancing",
    name: "3 Guys Dancing",
    description: "Put yourself in the funniest dance trio on the internet.",
    categoryId: "dance",
    type: "VIDEO" as const,
    creditCost: 5,
    aspectRatio: "9:16",
    requiredPhotoCount: 1,
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
  await prisma.template.upsert({
    where: { id: threeGuys.id },
    // Only touch the config when a real template video URL was provided.
    update: process.env.THREE_GUYS_TEMPLATE_VIDEO_URL ? { generationConfig: threeGuysConfig } : {},
    create: threeGuys,
  });
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
