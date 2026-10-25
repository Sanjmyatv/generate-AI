/**
 * Client for Higgsfield Genjutsu motion transfer: swaps the characters/locations/style of a
 * template video for the user's photo(s) while keeping the video's motion. Server-side only.
 *
 *     POST {base}/higgsfield/genjutsu/motion-transfer/v1.0   -> { request_id, status }
 *     GET  {base}/requests/{id}/status                      -> { status, video.url, error }
 *     Auth: Authorization: Key <KEY_ID>:<KEY_SECRET>
 *     Docs: https://console.higgsfield.ai/models/higgsfield/genjutsu/motion-transfer/v1.0
 */
import type { TaskState } from "@/lib/seedance";

const BASE_URL = "https://api.higgsfield.ai";
const MODEL_PATH = "higgsfield/genjutsu/motion-transfer/v1.0";
const REQUEST_TIMEOUT_MS = 30_000;

export class HiggsfieldError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "HiggsfieldError";
  }
}

/** Per-template settings stored in `Template.generationConfig`. */
export interface GenjutsuTemplateConfig {
  provider: "genjutsu";
  /** Public https URL of the source video whose motion is kept (4 s min; trimmed to 30 s). */
  templateVideoUrl: string;
  /** Optional hidden instruction; the user never sees it. */
  prompt?: string;
  /** Billed per second of source video; list price $0.318 (480p), $0.681 (720p), $1.632 (1080p), before discount. */
  resolution?: "480p" | "720p" | "1080p";
}

export function parseGenjutsuConfig(value: unknown): GenjutsuTemplateConfig | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  if (c.provider !== "genjutsu") return null;
  if (typeof c.templateVideoUrl !== "string" || !c.templateVideoUrl.startsWith("https://")) return null;
  return c as unknown as GenjutsuTemplateConfig;
}

/**
 * Settings for a Higgsfield Marketing Studio image edit (`marketing-studio/image`), stored in
 * `Template.generationConfig`. Used in direct mode (`enhance_prompt: false`): the user's
 * photo(s) plus the hidden prompt, no preset.
 */
export interface MarketingImageTemplateConfig {
  provider: "marketing-image";
  /** Hidden instruction; the user never sees it. */
  prompt: string;
  quality?: "low" | "medium" | "high";
  resolution?: "1k" | "2k" | "4k";
  /** "auto" keeps the source photo's shape. */
  aspectRatio?: string;
}

export function parseMarketingImageConfig(value: unknown): MarketingImageTemplateConfig | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  if (c.provider !== "marketing-image" || typeof c.prompt !== "string" || !c.prompt) return null;
  return c as unknown as MarketingImageTemplateConfig;
}

/** True for templates whose jobs run on Higgsfield (polled with getHiggsfieldTask). */
export function isHiggsfieldConfig(value: unknown): boolean {
  return parseGenjutsuConfig(value) !== null || parseMarketingImageConfig(value) !== null;
}

function authHeader() {
  const credentials = process.env.HIGGSFIELD_CREDENTIALS;
  if (!credentials) throw new HiggsfieldError("HIGGSFIELD_CREDENTIALS is not set");
  return { Authorization: `Key ${credentials}` };
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...authHeader() },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    throw new HiggsfieldError(`Higgsfield request failed: ${e instanceof Error ? e.message : e}`);
  }
  if (!res.ok) {
    // Provider detail is logged server-side only; callers surface a generic error.
    const detail = await res.text().catch(() => "");
    console.error(`[higgsfield] ${res.status} ${path}`, detail.slice(0, 800));
    throw new HiggsfieldError(`Higgsfield responded with ${res.status}`, res.status);
  }
  return res.json();
}

export interface SubmitMotionTransferInput {
  templateVideoUrl: string;
  /** Public URLs of the user's reference photos (1–8). */
  imageUrls: string[];
  prompt?: string;
  resolution?: GenjutsuTemplateConfig["resolution"];
}

/** Starts a motion-transfer request and returns Higgsfield's request id. */
export async function submitMotionTransfer(input: SubmitMotionTransferInput): Promise<string> {
  const data = (await request(MODEL_PATH, {
    method: "POST",
    body: JSON.stringify({
      prompt: input.prompt ?? "",
      video_url: input.templateVideoUrl,
      image_urls: input.imageUrls,
      resolution: input.resolution ?? "720p",
    }),
  })) as { request_id?: unknown };
  if (typeof data.request_id !== "string" || !data.request_id) {
    throw new HiggsfieldError("Higgsfield did not return a request_id");
  }
  return data.request_id;
}

export interface SubmitImageEditInput {
  /** Public URLs of the user's photo(s) to edit (up to 16). */
  imageUrls: string[];
  prompt: string;
  quality?: MarketingImageTemplateConfig["quality"];
  resolution?: MarketingImageTemplateConfig["resolution"];
  aspectRatio?: string;
}

/** Starts a Marketing Studio image edit (no preset) and returns Higgsfield's request id. */
export async function submitImageEdit(input: SubmitImageEditInput): Promise<string> {
  const data = (await request("marketing-studio/image", {
    method: "POST",
    body: JSON.stringify({
      prompt: input.prompt,
      image_urls: input.imageUrls,
      quality: input.quality ?? "high",
      resolution: input.resolution ?? "1k",
      aspect_ratio: input.aspectRatio ?? "auto",
      moderation: "auto",
      // Presets rewrite the prompt into an ad layout; we want a faithful edit of the photo.
      enhance_prompt: false,
    }),
  })) as { request_id?: unknown };
  if (typeof data.request_id !== "string" || !data.request_id) {
    throw new HiggsfieldError("Higgsfield did not return a request_id");
  }
  return data.request_id;
}

/**
 * Fetches a request and normalises Higgsfield's status vocabulary. For image jobs the
 * finished image URL comes back in `videoUrl`: TaskState is shared with the video providers.
 */
export async function getHiggsfieldTask(requestId: string): Promise<TaskState> {
  const data = (await request(`requests/${encodeURIComponent(requestId)}/status`, { method: "GET" })) as {
    status?: unknown;
    video?: { url?: unknown } | null;
    images?: { url?: unknown }[] | null;
    error?: unknown;
  };
  const status = String(data.status ?? "").toLowerCase();

  if (status === "completed") {
    const url = data.video?.url ?? data.images?.[0]?.url;
    return typeof url === "string" && url.startsWith("https://")
      ? { status: "completed", videoUrl: url }
      : { status: "failed", error: "Provider finished without a result" };
  }
  if (status === "failed" || status === "nsfw" || status === "canceled") {
    console.error("[higgsfield] request failed", requestId, status, JSON.stringify(data.error ?? null));
    return { status: "failed", error: status === "nsfw" ? "content_flagged" : "Generation failed" };
  }
  return { status: "pending" }; // queued | in_progress
}

/**
 * Asks Higgsfield what a request would cost this account, in USD, before submitting it.
 * `modelPath` is the same path used to generate; the estimate lives under `/estimate/`.
 * The response is the authoritative amount, discounts included.
 */
async function estimateUsd(modelPath: string, body: unknown): Promise<number> {
  const data = (await request(`estimate/${modelPath}`, { method: "POST", body: JSON.stringify(body) })) as {
    usd?: unknown;
  };
  const usd = Number(data.usd);
  if (!Number.isFinite(usd) || usd < 0) throw new HiggsfieldError("Higgsfield returned no estimate");
  return usd;
}

export function estimateMotionTransferUsd(input: SubmitMotionTransferInput) {
  return estimateUsd(MODEL_PATH, {
    prompt: input.prompt ?? "",
    video_url: input.templateVideoUrl,
    image_urls: input.imageUrls,
    resolution: input.resolution ?? "720p",
  });
}

export function estimateImageEditUsd(input: SubmitImageEditInput) {
  return estimateUsd("marketing-studio/image", {
    prompt: input.prompt,
    image_urls: input.imageUrls,
    quality: input.quality ?? "high",
    resolution: input.resolution ?? "1k",
    aspect_ratio: input.aspectRatio ?? "auto",
    moderation: "auto",
    enhance_prompt: false,
  });
}
