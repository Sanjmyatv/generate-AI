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
    { id: "photo", name: "Photo", sortOrder: 3 },
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
  const THREE_GUYS_VERSION = 5;

  // The template video shows real people, which Seedance/ModelArk rejects
  // (InputVideoSensitiveContentDetected.PrivacyInformation), so this template runs on
  // Higgsfield Genjutsu. It bills per second of source video (~14.7 s → 15 s): at 480p with
  // our 50% discount that is about $2.39 per generation, hence the higher credit cost.
  const THREE_GUYS_CREDIT_COST = 25;

  // Hidden instruction for Genjutsu motion transfer. Users never see it.
  const threeGuysConfig = {
    version: THREE_GUYS_VERSION,
    provider: "genjutsu",
    // Replace with the real, publicly reachable template video (set
    // THREE_GUYS_TEMPLATE_VIDEO_URL on the server and redeploy to apply it).
    templateVideoUrl:
      process.env.THREE_GUYS_TEMPLATE_VIDEO_URL ?? "https://example.com/REPLACE-ME/three-guys-dancing.mp4",
    // The video is a montage of three different young men in separate shots, in this order:
    // (1) dancing in a parking lot at the start, (2) a selfie-style shot of a man with glasses
    // at a gas station, (3) close-ups at sunset (plus a car shot between). The reference images
    // are the users' photos in upload order.
    prompt:
      "The video shows three different young men in separate shots. " +
      "Replace the first man (the one dancing in the parking lot at the start of the video) with the person in the first reference image. " +
      "Replace the second man (the one with glasses in the selfie-style shot) with the person in the second reference image. " +
      "Replace the third man (the one in the close-up shots at sunset) with the person in the third reference image. " +
      "Keep the original moves, timing, camera movement, lighting, background and car shots exactly the same. " +
      "Each man must clearly have the face, hairstyle and identity of his matching reference image.",
    resolution: "480p",
  };
  const threeGuys = {
    id: "three-guys-dancing",
    name: "3 Guys Dancing",
    description: "Put yourself and two friends into this viral video — each of you gets your own scene.",
    categoryId: "dance",
    type: "VIDEO" as const,
    creditCost: THREE_GUYS_CREDIT_COST,
    aspectRatio: "9:16", // the template video is 720x1280
    // Preview shown on cards and the template page (same file as the edit source).
    previewUrl: "/templates/three-guys-dancing.mp4",
    requiredPhotoCount: 3,
    photoLabels: ["First guy (opening dance)", "Second guy (with glasses)", "Third guy (sunset close-up)"],
    photoRequirement: "FACE" as const,
    trendingRank: 0,
    generationConfig: threeGuysConfig,
  };

  // "Reference" mode template: no source video. Seedance generates a new video from the
  // user's photo plus this hidden prompt, so no third-party footage is involved.
  const goldenHour = {
    id: "golden-hour-selfie",
    name: "Golden Hour Selfie",
    description: "Turn one photo into the sunset gas-station selfie everyone is posting.",
    categoryId: "dance",
    type: "VIDEO" as const,
    creditCost: 5,
    aspectRatio: "9:16",
    requiredPhotoCount: 1,
    photoLabels: ["Your photo"],
    photoRequirement: "FACE" as const,
    trendingRank: 1,
    generationConfig: {
      version: 1,
      provider: "seedance",
      mode: "reference",
      prompt:
        "Vertical cinematic selfie-style video, shot on a phone with an ultra-wide lens held at arm's length. " +
        "The person from Image 1 stands at a gas station forecourt at golden hour with a glowing orange and blue sunset sky behind them, " +
        "trucks and fuel pumps softly out of focus in the background. " +
        "They wear a stylish leather bomber jacket over a white tee and a gold chain. " +
        "They laugh, point up at the sky and dance with fun, confident energy while the camera slowly sways. " +
        "The face, hairstyle, skin tone and identity of the person must match Image 1 exactly. " +
        "Warm natural light, realistic skin, subtle film grain, trendy social-media look, upbeat music.",
      ratio: "9:16",
      duration: 8,
      resolution: "720p",
      generateAudio: true,
    },
  };

  // Higgsfield Genjutsu motion transfer: keeps the template video's motion and swaps its
  // character for the user's photo. Billed per second of source video at list price
  // $0.318 / $0.681 / $1.632 (480p / 720p / 1080p) before any account discount, so creditCost
  // must cover the template's length. Only seeded once a real video URL is set.
  const genjutsuVideoUrl = process.env.GENJUTSU_TEMPLATE_VIDEO_URL;
  const characterSwap = {
    id: "character-swap",
    name: "Character Swap",
    description: "Star in this video — your photo replaces the character, the moves stay the same.",
    categoryId: "trending",
    type: "VIDEO" as const,
    creditCost: 10,
    aspectRatio: "9:16", // match the template video
    requiredPhotoCount: 1,
    photoLabels: ["Your photo"],
    photoRequirement: "FULL_BODY" as const,
    trendingRank: 4,
    generationConfig: {
      version: 1,
      provider: "genjutsu",
      templateVideoUrl: genjutsuVideoUrl ?? "",
      prompt:
        "Replace the main character with the person in the reference image. " +
        "Keep the original motion, timing, camera movement and background exactly the same.",
      resolution: "720p",
    },
  };

  // "Shine": a single young man dancing on a restaurant terrace at night (14.8 s, 9:16, with
  // music). The clip shows real people in the background, which Seedance/ModelArk rejects, so it
  // runs on Genjutsu motion transfer like 3 Guys Dancing: 15 billed seconds, about $2.39 at 480p
  // with our discount, hence the credit cost. The video is served from this app's own
  // /templates folder; its origin comes from SHINE_TEMPLATE_VIDEO_URL, APP_URL, or the origin of
  // THREE_GUYS_TEMPLATE_VIDEO_URL, whichever is a valid https URL.
  const shineVideoUrl = (() => {
    const explicit = process.env.SHINE_TEMPLATE_VIDEO_URL;
    if (explicit?.startsWith("https://")) return explicit;
    for (const base of [process.env.APP_URL, process.env.THREE_GUYS_TEMPLATE_VIDEO_URL]) {
      try {
        const url = new URL(base ?? "");
        if (url.protocol === "https:") return `${url.origin}/templates/shine.mp4`;
      } catch {
        // not a URL; try the next source
      }
    }
    return null;
  })();
  const shine = shineVideoUrl && {
    id: "shine",
    name: "Shine",
    description: "Step into this viral night-out dance — your photo, the exact same moves.",
    categoryId: "dance",
    type: "VIDEO" as const,
    creditCost: 25,
    aspectRatio: "9:16", // the template video is 320x568
    previewUrl: "/templates/shine.mp4",
    requiredPhotoCount: 1,
    photoLabels: ["Your photo (full body)"],
    photoRequirement: "FULL_BODY" as const,
    trendingRank: 2,
    generationConfig: {
      version: 1,
      provider: "genjutsu",
      templateVideoUrl: shineVideoUrl,
      prompt:
        "Replace the young man who is dancing with the person in the reference image. " +
        "Keep the original dance moves, timing, camera framing, the restaurant terrace, the night lighting " +
        "and the people sitting in the background exactly the same. " +
        "The dancer must clearly have the face, hairstyle and identity of the reference image.",
      resolution: "480p",
    },
  };

  // Bump when the colorize definition below changes; applied to the existing row only when the
  // stored version is older.
  const COLORIZE_VERSION = 2;

  // Image edit on Higgsfield Marketing Studio (direct mode, no preset): restores, sharpens and
  // colorizes an old photo at high resolution. Public pricing for this model isn't listed, so
  // check the cost in the Higgsfield console and adjust creditCost (and resolution) to match.
  const colorize = {
    id: "colorize-old-photo",
    name: "Restore & Colorize Photo",
    description: "Colorize an old photo, repair its damage and sharpen it into a high-resolution picture.",
    categoryId: "photo",
    type: "IMAGE" as const,
    creditCost: 5,
    aspectRatio: "3:4",
    requiredPhotoCount: 1,
    photoLabels: ["Old photo"],
    photoRequirement: "FACE" as const,
    trendingRank: 5,
    generationConfig: {
      version: COLORIZE_VERSION,
      provider: "marketing-image",
      prompt:
        "Restore and colorize this old photograph into a sharp, high-resolution, modern-looking photo. " +
        "Colorize it with natural, realistic, historically plausible colors: accurate skin tones, hair and eye colors, " +
        "believable clothing, materials and surroundings, with balanced exposure, contrast and soft natural lighting. " +
        "Repair the damage: remove scratches, dust, stains, creases, tears, fading and noise, and fix blur and low-resolution softness. " +
        "Rebuild fine detail with crisp, natural clarity, as if shot on a modern high-end camera: " +
        "individual hair strands, eyes, real skin texture, fabric weave and background detail. " +
        "Preserve identity exactly: the same people, faces, expressions, age, poses, clothing, objects and composition. " +
        "Do not change the framing or crop, do not add or remove anything, and do not beautify or alter facial features. " +
        "No plastic or over-smoothed skin, no artificial filters, no heavy stylization.",
      quality: "high",
      resolution: "4k",
      aspectRatio: "auto",
    },
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
        creditCost: threeGuys.creditCost,
        aspectRatio: threeGuys.aspectRatio,
        previewUrl: threeGuys.previewUrl,
        requiredPhotoCount: threeGuys.requiredPhotoCount,
        photoLabels: threeGuys.photoLabels,
        generationConfig: threeGuysConfig,
      },
    });
  }
  await prisma.template.upsert({ where: { id: goldenHour.id }, update: {}, create: goldenHour });
  const existingColorize = await prisma.template.findUnique({ where: { id: colorize.id } });
  const colorizeVersion = (existingColorize?.generationConfig as { version?: number } | null)?.version ?? 0;
  if (!existingColorize) {
    await prisma.template.create({ data: colorize });
  } else if (colorizeVersion < COLORIZE_VERSION) {
    await prisma.template.update({
      where: { id: colorize.id },
      data: {
        name: colorize.name,
        description: colorize.description,
        creditCost: colorize.creditCost,
        photoLabels: colorize.photoLabels,
        generationConfig: colorize.generationConfig,
      },
    });
  }
  if (shine) {
    await prisma.template.upsert({ where: { id: shine.id }, update: {}, create: shine });
  } else {
    console.warn("[seed] Shine template skipped: set APP_URL (https) or SHINE_TEMPLATE_VIDEO_URL");
  }
  if (genjutsuVideoUrl) {
    await prisma.template.upsert({ where: { id: characterSwap.id }, update: {}, create: characterSwap });
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
