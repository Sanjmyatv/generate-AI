import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  // Only seed an empty database so redeploys never overwrite admin edits.
  if ((await prisma.category.count()) > 0) {
    console.log("Seed skipped: database already has data.");
    return;
  }

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

  for (const c of categories) {
    await prisma.category.upsert({ where: { id: c.id }, update: c, create: c });
  }
  for (const t of templates) {
    await prisma.template.upsert({ where: { id: t.id }, update: t, create: t });
  }
  for (const p of packages) {
    await prisma.creditPackage.upsert({ where: { id: p.id }, update: p, create: p });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
