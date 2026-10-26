import type { Template as DbTemplate } from "@/generated/prisma/client";
import { VIDEO_CREDITS } from "@/config/pricing";
import { parseGenjutsuConfig, parseMarketingImageConfig } from "@/lib/higgsfield";
import { parseSeedanceConfig } from "@/lib/seedance";

/** How a template produces its result. Stored in `Template.generationConfig.provider`/`mode`. */
export type Engine = "genjutsu" | "seedance-edit" | "seedance-reference" | "marketing-image";

export const ENGINES: { value: Engine; type: "VIDEO" | "IMAGE"; label: string; help: string }[] = [
  {
    value: "genjutsu",
    type: "VIDEO",
    label: "Swap into a source video (Genjutsu)",
    help: "Keeps the source video's motion and swaps the character for the user's photo. Works with real people in the video. Billed per second of source video.",
  },
  {
    value: "seedance-edit",
    type: "VIDEO",
    label: "Edit a source video (Seedance)",
    help: "Edits the source video with the user's photo. Seedance rejects source videos that show real people.",
  },
  {
    value: "seedance-reference",
    type: "VIDEO",
    label: "Create a new video from the photo (Seedance)",
    help: "No source video: generates a brand-new video from the user's photo and your prompt.",
  },
  {
    value: "marketing-image",
    type: "IMAGE",
    label: "Edit the photo (Higgsfield image)",
    help: "Returns an edited picture of the user's photo, for example restoring or restyling it.",
  },
];

export const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"] as const;
export const IMAGE_RESOLUTIONS = ["1k", "2k", "4k"] as const;
export const IMAGE_QUALITIES = ["low", "medium", "high"] as const;
export const IMAGE_ASPECTS = ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"] as const;
export const VIDEO_RATIOS = ["9:16", "16:9", "1:1", "3:4", "4:3", "21:9"] as const;
export const CARD_SHAPES = ["9:16", "3:4", "1:1", "4:3", "16:9"] as const;

export const MAX_PHOTOS = 5; // matches the cap in POST /api/generate
const MAX_CREDITS = 1_000_000;

/** Everything the admin form edits, as plain strings so it round-trips through FormData. */
export interface TemplateFormValues {
  name: string;
  description: string;
  categoryId: string;
  newCategory: string;
  type: "VIDEO" | "IMAGE";
  engine: Engine;
  prompt: string;
  /** Credits at 480p (the only price for images). */
  creditCost: string;
  /** Credits at 720p HD; empty means the template is offered at 480p only. */
  creditCostHd: string;
  /** Length of the video this template makes, in seconds. */
  durationSeconds: string;
  aspectRatio: string;
  requiredPhotoCount: string;
  /** One label per line, in photo order. */
  photoLabels: string;
  photoRequirement: "FACE" | "FULL_BODY";
  active: boolean;
  trendingRank: string;
  previewUrl: string;
  sourceVideoUrl: string;
  videoResolution: string;
  duration: string;
  ratio: string;
  generateAudio: boolean;
  imageResolution: string;
  imageQuality: string;
  imageAspect: string;
  /** What one generation costs us, in USD. Used for margin math only; providers never see it. */
  costUsd: string;
  /** The same, at 720p HD. */
  costUsdHd: string;
}

export function defaultFormValues(): TemplateFormValues {
  return {
    name: "",
    description: "",
    categoryId: "",
    newCategory: "",
    type: "VIDEO",
    engine: "genjutsu",
    prompt: "",
    creditCost: String(VIDEO_CREDITS[20]["480p"]),
    creditCostHd: String(VIDEO_CREDITS[20]["720p"]),
    durationSeconds: "15",
    aspectRatio: "9:16",
    requiredPhotoCount: "1",
    photoLabels: "",
    photoRequirement: "FACE",
    active: true,
    trendingRank: "",
    previewUrl: "",
    sourceVideoUrl: "",
    videoResolution: "480p",
    duration: "8",
    ratio: "9:16",
    generateAudio: true,
    imageResolution: "2k",
    imageQuality: "high",
    imageAspect: "auto",
    costUsd: "",
    costUsdHd: "",
  };
}

function engineOf(config: unknown): Engine | null {
  if (parseGenjutsuConfig(config)) return "genjutsu";
  if (parseMarketingImageConfig(config)) return "marketing-image";
  const seedance = parseSeedanceConfig(config);
  if (seedance) return seedance.mode === "reference" ? "seedance-reference" : "seedance-edit";
  return null;
}

/** Fills the form from a saved template (and the settings inside its generationConfig). */
export function templateToFormValues(t: DbTemplate): TemplateFormValues {
  const v = defaultFormValues();
  const config = (t.generationConfig ?? {}) as Record<string, unknown>;
  const engine = engineOf(config) ?? (t.type === "IMAGE" ? "marketing-image" : "genjutsu");
  const str = (x: unknown) => (typeof x === "string" ? x : "");

  v.name = t.name;
  v.description = t.description;
  v.categoryId = t.categoryId;
  v.type = t.type;
  v.engine = engine;
  v.prompt = str(config.prompt);
  v.creditCost = String(t.creditCost);
  v.creditCostHd = t.creditCostHd === null ? "" : String(t.creditCostHd);
  v.durationSeconds = t.durationSeconds === null ? "" : String(t.durationSeconds);
  v.aspectRatio = t.aspectRatio;
  v.requiredPhotoCount = String(t.requiredPhotoCount);
  v.photoLabels = t.photoLabels.join("\n");
  v.photoRequirement = t.photoRequirement;
  v.active = t.active;
  v.trendingRank = t.trendingRank === null ? "" : String(t.trendingRank);
  v.previewUrl = t.previewUrl ?? "";
  v.sourceVideoUrl = str(config.templateVideoUrl);
  if (typeof config.costUsd === "number") v.costUsd = String(config.costUsd);
  if (typeof config.costUsdHd === "number") v.costUsdHd = String(config.costUsdHd);
  if (engine === "marketing-image") {
    v.imageResolution = str(config.resolution) || v.imageResolution;
    v.imageQuality = str(config.quality) || v.imageQuality;
    v.imageAspect = str(config.aspectRatio) || v.imageAspect;
  } else {
    v.videoResolution = str(config.resolution) || v.videoResolution;
    v.ratio = str(config.ratio) || v.ratio;
    if (typeof config.duration === "number") v.duration = String(config.duration);
    if (typeof config.generateAudio === "boolean") v.generateAudio = config.generateAudio;
  }
  return v;
}

/** Reads the form's text fields (files are uploaded separately and arrive as URLs). */
export function readForm(form: FormData): TemplateFormValues {
  const d = defaultFormValues();
  const text = (name: string, fallback = "") => {
    const value = form.get(name);
    return typeof value === "string" ? value : fallback;
  };
  const engine = text("engine") as Engine;
  const type = text("type") === "IMAGE" ? "IMAGE" : "VIDEO";
  return {
    name: text("name").trim(),
    description: text("description").trim(),
    categoryId: text("categoryId"),
    newCategory: text("newCategory").trim(),
    type,
    engine: ENGINES.some((e) => e.value === engine) ? engine : d.engine,
    prompt: text("prompt").trim(),
    creditCost: text("creditCost").trim(),
    creditCostHd: text("creditCostHd").trim(),
    durationSeconds: text("durationSeconds").trim(),
    aspectRatio: text("aspectRatio"),
    requiredPhotoCount: text("requiredPhotoCount").trim(),
    photoLabels: text("photoLabels"),
    photoRequirement: text("photoRequirement") === "FULL_BODY" ? "FULL_BODY" : "FACE",
    active: form.get("active") === "on",
    trendingRank: text("trendingRank").trim(),
    previewUrl: text("previewUrl").trim(),
    sourceVideoUrl: text("sourceVideoUrl").trim(),
    videoResolution: text("videoResolution"),
    duration: text("duration").trim(),
    ratio: text("ratio"),
    generateAudio: form.get("generateAudio") === "on",
    imageResolution: text("imageResolution"),
    imageQuality: text("imageQuality"),
    imageAspect: text("imageAspect"),
    costUsd: text("costUsd").trim(),
    costUsdHd: text("costUsdHd").trim(),
  };
}

export type FieldErrors = Partial<Record<keyof TemplateFormValues, string>>;

export interface TemplateData {
  name: string;
  description: string;
  categoryId: string;
  newCategory: string;
  type: "VIDEO" | "IMAGE";
  creditCost: number;
  creditCostHd: number | null;
  durationSeconds: number | null;
  aspectRatio: string;
  requiredPhotoCount: number;
  photoLabels: string[];
  photoRequirement: "FACE" | "FULL_BODY";
  active: boolean;
  trendingRank: number | null;
  previewUrl: string | null;
  generationConfig: Record<string, unknown>;
}

const oneOf = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value);

/**
 * Resolves an upload path or https URL to a full URL. Anything else (other schemes, junk) is
 * refused, so a template can't point at arbitrary places.
 */
export function resolveUrl(value: string, baseUrl: string): string | null {
  if (value.startsWith("/api/assets/") || value.startsWith("/templates/")) return `${baseUrl}${value}`;
  return /^https:\/\/[^\s/]+/i.test(value) ? value : null;
}

/**
 * Validates the form and builds what gets saved: the template row plus the hidden
 * `generationConfig` the generate route reads. `version` from an existing config is kept so
 * a redeploy's seed doesn't overwrite an admin's edit.
 */
export function buildTemplateData(
  v: TemplateFormValues,
  baseUrl: string,
  existingConfig: unknown,
): { ok: true; data: TemplateData } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const engineInfo = ENGINES.find((e) => e.value === v.engine)!;
  if (engineInfo.type !== v.type) errors.engine = "Choose a method that matches the output type.";

  if (!v.name || v.name.length > 80) errors.name = "Enter a name (up to 80 characters).";
  if (!v.description || v.description.length > 500) errors.description = "Enter a description (up to 500 characters).";
  if (!v.categoryId && !v.newCategory) errors.categoryId = "Choose a category or enter a new one.";
  if (v.newCategory.length > 40) errors.newCategory = "Category names can be up to 40 characters.";

  const creditCost = Number(v.creditCost);
  if (!Number.isInteger(creditCost) || creditCost < 1 || creditCost > MAX_CREDITS) {
    errors.creditCost = `Enter a whole number of credits from 1 to ${MAX_CREDITS.toLocaleString("en-US")}.`;
  }
  // 720p HD and the video length only apply to video; leaving HD empty offers 480p only.
  let creditCostHd: number | null = null;
  let durationSeconds: number | null = null;
  if (v.type === "VIDEO") {
    if (v.creditCostHd) {
      creditCostHd = Number(v.creditCostHd);
      if (!Number.isInteger(creditCostHd) || creditCostHd < 1 || creditCostHd > MAX_CREDITS) {
        errors.creditCostHd = "Enter a whole number of credits, or leave it empty for 480p only.";
      }
    }
    if (v.durationSeconds) {
      durationSeconds = Number(v.durationSeconds);
      if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 120) {
        errors.durationSeconds = "Enter the length in seconds (1 to 120), or leave it empty.";
      }
    }
  }
  const requiredPhotoCount = Number(v.requiredPhotoCount);
  if (!Number.isInteger(requiredPhotoCount) || requiredPhotoCount < 1 || requiredPhotoCount > MAX_PHOTOS) {
    errors.requiredPhotoCount = `Enter 1 to ${MAX_PHOTOS} photos.`;
  }
  if (!oneOf(CARD_SHAPES, v.aspectRatio)) errors.aspectRatio = "Choose a card shape.";

  // One label per photo, by position: an empty one keeps its place (the site shows "Photo N").
  // Labels past the photo count are dropped, and so are empty ones at the end.
  const photoLabels = v.photoLabels.split("\n").map((l) => l.trim()).slice(0, requiredPhotoCount || 0);
  while (photoLabels.length > 0 && !photoLabels[photoLabels.length - 1]) photoLabels.pop();
  if (photoLabels.some((l) => l.length > 60)) errors.photoLabels = "Labels can be up to 60 characters.";

  let trendingRank: number | null = null;
  if (v.trendingRank) {
    trendingRank = Number(v.trendingRank);
    if (!Number.isInteger(trendingRank) || trendingRank < 0) errors.trendingRank = "Enter 0 or a positive number, or leave empty.";
  }

  let previewUrl: string | null = null;
  if (v.previewUrl) {
    const checked = resolveUrl(v.previewUrl, baseUrl);
    if (!checked) errors.previewUrl = "The preview must be an upload or an https link.";
    else previewUrl = v.previewUrl; // relative paths stay relative; the site serves them itself
  }

  const config: Record<string, unknown> = {};
  if (v.costUsd) {
    const costUsd = Number(v.costUsd);
    if (!Number.isFinite(costUsd) || costUsd < 0 || costUsd > 1000) errors.costUsd = "Enter the cost in USD, e.g. 2.39.";
    else config.costUsd = costUsd;
  }
  if (v.costUsdHd) {
    const costUsdHd = Number(v.costUsdHd);
    if (!Number.isFinite(costUsdHd) || costUsdHd < 0 || costUsdHd > 1000) errors.costUsdHd = "Enter the 720p cost in USD, e.g. 5.11.";
    else config.costUsdHd = costUsdHd;
  }
  const prevVersion = (existingConfig as { version?: unknown } | null)?.version;
  if (typeof prevVersion === "number") config.version = prevVersion;

  const needsPrompt = v.engine !== "genjutsu";
  if (needsPrompt && !v.prompt) errors.prompt = "Write the prompt for this method.";
  if (v.prompt.length > 5000) errors.prompt = "Prompts can be up to 5000 characters.";

  const needsVideo = v.engine === "genjutsu" || v.engine === "seedance-edit";
  let sourceVideoUrl = "";
  if (needsVideo) {
    sourceVideoUrl = (v.sourceVideoUrl && resolveUrl(v.sourceVideoUrl, baseUrl)) || "";
    if (!sourceVideoUrl) errors.sourceVideoUrl = "Upload a source video or paste a public https link.";
  }

  if (v.engine === "marketing-image") {
    if (!oneOf(IMAGE_RESOLUTIONS, v.imageResolution)) errors.imageResolution = "Choose a resolution.";
    if (!oneOf(IMAGE_QUALITIES, v.imageQuality)) errors.imageQuality = "Choose a quality.";
    if (!oneOf(IMAGE_ASPECTS, v.imageAspect)) errors.imageAspect = "Choose an aspect ratio.";
    Object.assign(config, {
      provider: "marketing-image",
      prompt: v.prompt,
      quality: v.imageQuality,
      resolution: v.imageResolution,
      aspectRatio: v.imageAspect,
    });
  } else {
    if (!oneOf(VIDEO_RESOLUTIONS, v.videoResolution)) errors.videoResolution = "Choose a resolution.";
    if (v.engine === "genjutsu") {
      Object.assign(config, {
        provider: "genjutsu",
        templateVideoUrl: sourceVideoUrl,
        ...(v.prompt ? { prompt: v.prompt } : {}),
        resolution: v.videoResolution,
      });
    } else if (v.engine === "seedance-edit") {
      Object.assign(config, {
        provider: "seedance",
        mode: "edit",
        templateVideoUrl: sourceVideoUrl,
        prompt: v.prompt,
        resolution: v.videoResolution,
        generateAudio: v.generateAudio,
      });
    } else {
      const duration = Number(v.duration);
      if (!Number.isInteger(duration) || duration < 4 || duration > 30) errors.duration = "Enter 4 to 30 seconds.";
      if (!oneOf(VIDEO_RATIOS, v.ratio)) errors.ratio = "Choose a video ratio.";
      Object.assign(config, {
        provider: "seedance",
        mode: "reference",
        prompt: v.prompt,
        resolution: v.videoResolution,
        duration,
        ratio: v.ratio,
        generateAudio: v.generateAudio,
      });
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name: v.name,
      description: v.description,
      categoryId: v.categoryId,
      newCategory: v.newCategory,
      type: v.type,
      creditCost,
      creditCostHd,
      durationSeconds,
      aspectRatio: v.aspectRatio,
      requiredPhotoCount,
      photoLabels,
      photoRequirement: v.photoRequirement,
      active: v.active,
      trendingRank,
      previewUrl,
      generationConfig: config,
    },
  };
}

export function slugify(text: string) {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "item";
}
