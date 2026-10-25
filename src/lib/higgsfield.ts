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

/** Fetches a request and normalises Higgsfield's status vocabulary. */
export async function getMotionTransferTask(requestId: string): Promise<TaskState> {
  const data = (await request(`requests/${encodeURIComponent(requestId)}/status`, { method: "GET" })) as {
    status?: unknown;
    video?: { url?: unknown } | null;
    error?: unknown;
  };
  const status = String(data.status ?? "").toLowerCase();

  if (status === "completed") {
    const url = data.video?.url;
    return typeof url === "string" && url.startsWith("https://")
      ? { status: "completed", videoUrl: url }
      : { status: "failed", error: "Provider finished without a video" };
  }
  if (status === "failed" || status === "nsfw" || status === "canceled") {
    console.error("[higgsfield] request failed", requestId, status, JSON.stringify(data.error ?? null));
    return { status: "failed", error: status === "nsfw" ? "content_flagged" : "Generation failed" };
  }
  return { status: "pending" }; // queued | in_progress
}
