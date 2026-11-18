import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PACKAGES } from "../src/config/pricing";
import { DEFAULT_PRICING, imageCredits1k, videoCredits } from "../src/lib/pricing";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Credits for a video of this length from the pricing formula (a fresh database has the default settings). */
const videoPrice = (seconds: number) => ({
  creditCost: videoCredits(seconds, "480p", DEFAULT_PRICING),
  creditCostHd: videoCredits(seconds, "720p", DEFAULT_PRICING),
  autoCredits: true,
});

/** Credits for one 1K image at the default (Low) tier from the pricing formula. */
const imagePrice = () => ({ creditCost: imageCredits1k(DEFAULT_PRICING), autoCredits: true });

async function main() {
  // Templates that already exist keep whatever categories an admin gave them; only new ones get their seed category.
  const existingTemplateIds = new Set((await prisma.template.findMany({ select: { id: true } })).map((t) => t.id));

  // Category names are Mongolian (English visitors get the dictionary's). Trending is a system category that fills itself.
  const categories = [
    { id: "trending", name: "Эрэлттэй", sortOrder: 0, system: true },
    { id: "dance", name: "Бүжиг", sortOrder: 1 },
    { id: "horoscope", name: "Зурхай", sortOrder: 2 },
    { id: "photo", name: "Зураг", sortOrder: 3 },
  ];

  const templates = [
    {
      id: "dance-transformation",
      name: "Dance Transformation",
      description: "Upload your photo and generate an AI dance video.",
      categoryId: "dance",
      type: "VIDEO" as const,
      ...videoPrice(10),
      durationSeconds: 10,
      aspectRatio: "9:16",
      requiredPhotoCount: 1,
      photoRequirement: "FULL_BODY" as const,
    },
    {
      id: "street-dance",
      name: "Street Dance",
      description: "Turn your photo into a street dance clip.",
      categoryId: "dance",
      type: "VIDEO" as const,
      ...videoPrice(10),
      durationSeconds: 10,
      aspectRatio: "9:16",
      requiredPhotoCount: 1,
      photoRequirement: "FULL_BODY" as const,
    },
    {
      id: "zodiac-portrait",
      name: "Zodiac Portrait",
      description: "A mystical portrait styled after your zodiac sign.",
      categoryId: "horoscope",
      type: "IMAGE" as const,
      ...imagePrice(),
      aspectRatio: "3:4",
      requiredPhotoCount: 1,
      photoRequirement: "FACE" as const,
    },
    {
      id: "celestial-couple",
      name: "Celestial Couple",
      description: "A cosmic portrait of two people under the stars.",
      categoryId: "horoscope",
      type: "IMAGE" as const,
      ...imagePrice(),
      aspectRatio: "3:4",
      requiredPhotoCount: 2,
      photoRequirement: "FACE" as const,
    },
  ];

  // Bump when the template definition below changes; the seed re-applies it to an
  // existing row only when the stored version is older (so later admin edits survive).
  const THREE_GUYS_VERSION = 5;

  // The template video shows real people, which Seedance/ModelArk rejects
  // (InputVideoSensitiveContentDetected.PrivacyInformation), so this template runs on
  // Higgsfield Genjutsu. It bills per second of source video (~14.7 s → 15 s): at 480p with
  // our 50% discount that is about $2.39 per generation. Prices come from src/config/pricing.ts
  // (the 20 s tier); check the margin in /admin, because that provider cost is above the standard price.

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
    ...videoPrice(15),
    durationSeconds: 15, // the template video is 14.7 s
    aspectRatio: "9:16", // the template video is 720x1280
    // Preview shown on cards and the template page (same file as the edit source).
    previewUrl: "/templates/three-guys-dancing.mp4",
    requiredPhotoCount: 3,
    photoLabels: ["First guy (opening dance)", "Second guy (with glasses)", "Third guy (sunset close-up)"],
    photoRequirement: "FACE" as const,
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
    ...videoPrice(8),
    durationSeconds: 8,
    aspectRatio: "9:16",
    requiredPhotoCount: 1,
    photoLabels: ["Your photo"],
    photoRequirement: "FACE" as const,
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
    ...videoPrice(15),
    durationSeconds: 15,
    aspectRatio: "9:16", // match the template video
    requiredPhotoCount: 1,
    photoLabels: ["Your photo"],
    photoRequirement: "FULL_BODY" as const,
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
  // with our discount; priced at the 20 s tier. The video is served from this app's own
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
    ...videoPrice(15),
    durationSeconds: 15,
    aspectRatio: "9:16", // the template video is 320x568
    previewUrl: "/templates/shine.mp4",
    requiredPhotoCount: 1,
    photoLabels: ["Your photo (full body)"],
    photoRequirement: "FULL_BODY" as const,
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
  const COLORIZE_VERSION = 4;

  // Image edit on Higgsfield Marketing Studio (direct mode, no preset): restores, sharpens and
  // colorizes an old photo at high resolution. Public pricing for this model isn't listed, so
  // check the cost in the Higgsfield console and adjust creditCost (and resolution) to match.
  const colorize = {
    id: "colorize-old-photo",
    name: "Restore & Colorize Photo",
    description: "Colorize an old photo, repair its damage and sharpen it into a high-resolution picture.",
    categoryId: "photo",
    type: "IMAGE" as const,
    ...imagePrice(),
    aspectRatio: "3:4",
    requiredPhotoCount: 1,
    photoLabels: ["Old photo"],
    photoRequirement: "FACE" as const,
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
      quality: "low",
      resolution: "1k",
      aspectRatio: "auto",
    },
  };

  // Idempotent and non-destructive: rows that already exist (and any admin edits to them) are left alone.
  // The sample templates are only created in a brand-new database (no templates at all). Once the site has its own
  // templates, a sample an admin deleted stays deleted: a deploy never brings it back.
  const freshDatabase = existingTemplateIds.size === 0;
  for (const c of categories) {
    await prisma.category.upsert({ where: { id: c.id }, update: {}, create: c });
  }
  if (freshDatabase) {
    for (const t of templates) {
      await prisma.template.upsert({ where: { id: t.id }, update: {}, create: t });
    }
  }
  const existing = await prisma.template.findUnique({ where: { id: threeGuys.id } });
  const storedVersion = (existing?.generationConfig as { version?: number } | null)?.version ?? 0;
  if (!existing) {
    if (freshDatabase) await prisma.template.create({ data: threeGuys });
  } else if (storedVersion < THREE_GUYS_VERSION && process.env.THREE_GUYS_TEMPLATE_VIDEO_URL) {
    // Only upgrade once a real template video URL is provided.
    await prisma.template.update({
      where: { id: threeGuys.id },
      data: {
        description: threeGuys.description,
        creditCost: threeGuys.creditCost,
        creditCostHd: threeGuys.creditCostHd,
        durationSeconds: threeGuys.durationSeconds,
        aspectRatio: threeGuys.aspectRatio,
        previewUrl: threeGuys.previewUrl,
        requiredPhotoCount: threeGuys.requiredPhotoCount,
        photoLabels: threeGuys.photoLabels,
        generationConfig: threeGuysConfig,
      },
    });
  }
  if (freshDatabase) await prisma.template.upsert({ where: { id: goldenHour.id }, update: {}, create: goldenHour });
  const existingColorize = await prisma.template.findUnique({ where: { id: colorize.id } });
  const colorizeVersion = (existingColorize?.generationConfig as { version?: number } | null)?.version ?? 0;
  if (!existingColorize) {
    if (freshDatabase) await prisma.template.create({ data: colorize });
  } else if (colorizeVersion < COLORIZE_VERSION) {
    await prisma.template.update({
      where: { id: colorize.id },
      data: {
        name: colorize.name,
        description: colorize.description,
        creditCost: colorize.creditCost,
        creditCost2k: null,
        creditCost4k: null,
        autoCredits: true,
        photoLabels: colorize.photoLabels,
        generationConfig: colorize.generationConfig,
      },
    });
  }
  if (shine) {
    if (freshDatabase) await prisma.template.upsert({ where: { id: shine.id }, update: {}, create: shine });
  } else if (freshDatabase) {
    console.warn("[seed] Shine template skipped: set APP_URL (https) or SHINE_TEMPLATE_VIDEO_URL");
  }
  if (genjutsuVideoUrl && freshDatabase) {
    await prisma.template.upsert({ where: { id: characterSwap.id }, update: {}, create: characterSwap });
  }
  // File the templates this deploy created under their category (the join table). Trending is automatic, so nothing is
  // ever filed there by hand.
  const createdNow = new Set((await prisma.template.findMany({ select: { id: true } })).map((t) => t.id));
  for (const t of [...templates, threeGuys, goldenHour, colorize, characterSwap, ...(shine ? [shine] : [])]) {
    if (existingTemplateIds.has(t.id) || !createdNow.has(t.id) || !t.categoryId || t.categoryId === "trending") continue;
    await prisma.templateCategory.createMany({ data: [{ templateId: t.id, categoryId: t.categoryId }], skipDuplicates: true });
  }

  // Mongolian names for the built-in templates. Only filled where nobody has written one, so an
  // admin's own Mongolian wording is never overwritten.
  const mongolian: Record<string, [string, string]> = {
    "dance-transformation": ["Бүжгийн хувирал", "Зургаа оруулаад AI бүжгийн видео үүсгээрэй."],
    "street-dance": ["Гудамжны бүжиг", "Зургаа гудамжны бүжгийн клип болгоорой."],
    "zodiac-portrait": ["Орд тэмдгийн хөрөг", "Таны орд тэмдгээр чимэглэсэн ид шидийн хөрөг."],
    "celestial-couple": ["Тэнгэрийн хос", "Одод дор хоёр хүний сансрын хөрөг."],
    "three-guys-dancing": ["3 залуугийн бүжиг", "Өөрийгөө болон хоёр найзаа энэ вирал видеонд оруулаарай. Тус бүрдээ өөрийн дүр зурагтай."],
    "golden-hour-selfie": ["Алтан цагийн селфи", "Нэг зургаас хүн бүрийн нийтэлж буй нар жаргах үеийн шатахуун түгээх станцын селфи хийгээрэй."],
    "character-swap": ["Дүр солих", "Энэ видеонд тоглоорой. Таны зураг дүрийг орлох бөгөөд хөдөлгөөн нь хэвээр үлдэнэ."],
    shine: ["Shine", "Энэ вирал шөнийн бүжигт орцгооё. Таны зураг, яг ижил хөдөлгөөнтэйгээр."],
    "colorize-old-photo": ["Зураг сэргээх, өнгөлөх", "Хуучин зургийг өнгөт болгож, гэмтлийг нь засаад, өндөр нягтралтай тод зураг болгоорой."],
  };
  for (const [id, [nameMn, descriptionMn]] of Object.entries(mongolian)) {
    await prisma.template.updateMany({ where: { id, nameMn: null }, data: { nameMn, descriptionMn } });
  }
  // Credit packs live in the database and are edited in /admin/packs, so a deploy only creates the
  // ones that are missing (a fresh database) and never overwrites an edit.
  for (const [sortOrder, p] of PACKAGES.entries()) {
    const data = {
      name: p.name,
      nameMn: p.nameMn,
      credits: p.credits,
      bonusCredits: p.bonusCredits,
      priceMnt: p.priceMnt,
      highlighted: p.highlighted,
      priorityQueue: p.priorityQueue,
      topPriorityQueue: p.topPriorityQueue,
      sortOrder,
      active: true,
    };
    await prisma.creditPackage.upsert({ where: { id: p.id }, update: {}, create: { id: p.id, ...data } });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
