/**
 * Thin client for the Seedance 2.5 "video edit" API (Muapi, model
 * `seedance-2.5-intl-video-edit`). Server-side only: the API key and the hidden
 * template prompt must never reach the browser.
 *
 * Docs: https://muapi.ai/playground/seedance-2.5-intl-video-edit/api
 *   POST {base}/seedance-2.5-intl-video-edit   -> { request_id }
 *   GET  {base}/predictions/{request_id}/result -> { status, outputs, error }
 */

const DEFAULT_BASE_URL = "https://api.muapi.ai/api/v1";
const REQUEST_TIMEOUT_MS = 30_000;

export class SeedanceError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SeedanceError";
  }
}

/** Per-template settings stored in `Template.generationConfig`. */
export interface SeedanceTemplateConfig {
  provider: "seedance";
  /** Public URL of the template video that gets edited. */
  templateVideoUrl: string;
  /** Hidden edit instruction; the user never sees or changes it. */
  prompt: string;
  resolution?: "480p" | "720p" | "1080p" | "4k";
  /** Output length in seconds. */
  duration?: number;
  generateAudio?: boolean;
}

export function parseSeedanceConfig(value: unknown): SeedanceTemplateConfig | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  if (c.provider !== "seedance") return null;
  if (typeof c.templateVideoUrl !== "string" || typeof c.prompt !== "string") return null;
  if (!c.templateVideoUrl.startsWith("https://")) return null;
  return c as unknown as SeedanceTemplateConfig;
}

function getConfig() {
  const apiKey = process.env.SEEDANCE_API_KEY;
  if (!apiKey) throw new SeedanceError("SEEDANCE_API_KEY is not set");
  const baseUrl = (process.env.SEEDANCE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

async function request(url: string, init: RequestInit & { apiKey: string }) {
  const { apiKey, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { "x-api-key": apiKey, "Content-Type": "application/json", ...rest.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    throw new SeedanceError(`Seedance request failed: ${e instanceof Error ? e.message : e}`);
  }
  if (!res.ok) {
    // Log provider detail server-side only; callers surface a generic error.
    const detail = await res.text().catch(() => "");
    console.error(`[seedance] ${res.status} ${url}`, detail.slice(0, 500));
    throw new SeedanceError(`Seedance responded with ${res.status}`, res.status);
  }
  return res.json() as Promise<unknown>;
}

export interface SubmitVideoEditInput {
  templateVideoUrl: string;
  /** Public URLs of the user's reference photos (up to 30). */
  imageUrls: string[];
  prompt: string;
  resolution?: SeedanceTemplateConfig["resolution"];
  duration?: number;
  generateAudio?: boolean;
}

/** Starts a video-edit task and returns the provider's task id. */
export async function submitVideoEdit(input: SubmitVideoEditInput): Promise<string> {
  const { apiKey, baseUrl } = getConfig();
  const body = {
    prompt: input.prompt,
    video_url: input.templateVideoUrl,
    images_list: input.imageUrls,
    resolution: input.resolution ?? "720p",
    duration: input.duration ?? 5,
    generate_audio: input.generateAudio ?? true,
  };

  const data = (await request(`${baseUrl}/seedance-2.5-intl-video-edit`, {
    method: "POST",
    body: JSON.stringify(body),
    apiKey,
  })) as { request_id?: unknown };

  if (typeof data.request_id !== "string" || !data.request_id) {
    throw new SeedanceError("Seedance did not return a request_id");
  }
  return data.request_id;
}

export type TaskState =
  | { status: "pending" }
  | { status: "completed"; videoUrl: string }
  | { status: "failed"; error: string };

/** Fetches a task and normalises the provider's status vocabulary. */
export async function getTask(taskId: string): Promise<TaskState> {
  const { apiKey, baseUrl } = getConfig();
  const data = (await request(
    `${baseUrl}/predictions/${encodeURIComponent(taskId)}/result`,
    { method: "GET", apiKey },
  )) as { status?: unknown; outputs?: unknown; error?: unknown };

  const status = String(data.status ?? "").toLowerCase();

  if (status === "completed" || status === "succeeded" || status === "success") {
    // `outputs` is documented as a URL string but may arrive as a list.
    const out = Array.isArray(data.outputs) ? data.outputs[0] : data.outputs;
    if (typeof out === "string" && out.startsWith("https://")) {
      return { status: "completed", videoUrl: out };
    }
    return { status: "failed", error: "Provider finished without a video" };
  }

  if (status === "failed" || status === "error" || status === "cancelled") {
    return {
      status: "failed",
      error: typeof data.error === "string" ? data.error : "Generation failed",
    };
  }

  return { status: "pending" };
}
