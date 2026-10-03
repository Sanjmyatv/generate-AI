/**
 * Client for Seedance 2.5 video editing. Server-side only: API keys and the hidden
 * template prompt must never reach the browser.
 *
 * Two providers are supported, chosen with SEEDANCE_PROVIDER:
 *
 * - "modelark" (default) — BytePlus ModelArk, the official API.
 *     POST {base}/contents/generations/tasks        -> { id }
 *     GET  {base}/contents/generations/tasks/{id}   -> { status, content.video_url, error }
 *     Auth: Authorization: Bearer <ARK_API_KEY>
 *     Docs: https://docs.byteplus.com/en/docs/modelark/seedance-2-5
 *
 * - "muapi" — third-party gateway (https://muapi.ai).
 *     POST {base}/seedance-2.5-intl-video-edit      -> { request_id }
 *     GET  {base}/predictions/{id}/result           -> { status, outputs, error }
 *     Auth: x-api-key
 */

export type Provider = "modelark" | "muapi";

const REQUEST_TIMEOUT_MS = 30_000;

const PROVIDER_DEFAULTS = {
  modelark: { baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3", model: "dreamina-seedance-2-5-260628" },
  muapi: { baseUrl: "https://api.muapi.ai/api/v1", model: "seedance-2.5-intl-video-edit" },
} as const;

export class SeedanceError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SeedanceError";
  }
}

/** Per-template settings stored in `Template.generationConfig`. */
export interface SeedanceTemplateConfig {
  provider: "seedance";
  /** Public URL of the template video that gets edited (ModelArk: 4–30 s). */
  templateVideoUrl: string;
  /**
   * Hidden edit instruction; the user never sees or changes it. Refer to the assets
   * as "Video 1" (the template) and "Image 1" (the user's photo).
   */
  prompt: string;
  resolution?: "480p" | "720p" | "1080p" | "4k";
  /** Output length in seconds. Muapi only — ModelArk keeps the template video's length. */
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
  const provider: Provider = process.env.SEEDANCE_PROVIDER === "muapi" ? "muapi" : "modelark";
  const apiKey = process.env.SEEDANCE_API_KEY;
  if (!apiKey) throw new SeedanceError("SEEDANCE_API_KEY is not set");
  const defaults = PROVIDER_DEFAULTS[provider];
  return {
    provider,
    apiKey,
    baseUrl: (process.env.SEEDANCE_BASE_URL || defaults.baseUrl).replace(/\/+$/, ""),
    model: process.env.SEEDANCE_MODEL || defaults.model,
  };
}

function authHeaders(provider: Provider, apiKey: string): Record<string, string> {
  return provider === "modelark" ? { Authorization: `Bearer ${apiKey}` } : { "x-api-key": apiKey };
}

async function request(url: string, init: RequestInit, headers: Record<string, string>) {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    throw new SeedanceError(`Seedance request failed: ${e instanceof Error ? e.message : e}`);
  }
  if (!res.ok) {
    // Provider detail is logged server-side only; callers surface a generic error.
    const detail = await res.text().catch(() => "");
    console.error(`[seedance] ${res.status} ${url}`, detail.slice(0, 800));
    throw new SeedanceError(`Seedance responded with ${res.status}`, res.status);
  }
  return res.json() as Promise<unknown>;
}

export interface SubmitVideoEditInput {
  templateVideoUrl: string;
  /** Public URLs of the user's reference photos. */
  imageUrls: string[];
  prompt: string;
  resolution?: SeedanceTemplateConfig["resolution"];
  duration?: number;
  generateAudio?: boolean;
}

/** Starts a video-edit task and returns the provider's task id. */
export async function submitVideoEdit(input: SubmitVideoEditInput): Promise<string> {
  const { provider, apiKey, baseUrl, model } = getConfig();
  const headers = authHeaders(provider, apiKey);

  if (provider === "muapi") {
    const data = (await request(
      `${baseUrl}/${model}`,
      {
        method: "POST",
        body: JSON.stringify({
          prompt: input.prompt,
          video_url: input.templateVideoUrl,
          images_list: input.imageUrls,
          resolution: input.resolution ?? "720p",
          duration: input.duration ?? 5,
          generate_audio: input.generateAudio ?? true,
        }),
      },
      headers,
    )) as { request_id?: unknown };
    if (typeof data.request_id !== "string" || !data.request_id) {
      throw new SeedanceError("Seedance did not return a request_id");
    }
    return data.request_id;
  }

  // ModelArk "omni reference" video-edit task. Editing requires ratio=adaptive and
  // duration=-1 (the output keeps the source video's aspect ratio and length).
  const data = (await request(
    `${baseUrl}/contents/generations/tasks`,
    {
      method: "POST",
      body: JSON.stringify({
        model,
        content: [
          { type: "text", text: input.prompt },
          { type: "video_url", video_url: { url: input.templateVideoUrl }, role: "reference_video" },
          ...input.imageUrls.map((url) => ({
            type: "image_url",
            image_url: { url },
            role: "reference_image",
          })),
        ],
        omni_reference_task_type: "edit",
        ratio: "adaptive",
        duration: -1,
        resolution: input.resolution ?? "720p",
        generate_audio: input.generateAudio ?? true,
        watermark: false,
      }),
    },
    headers,
  )) as { id?: unknown };
  if (typeof data.id !== "string" || !data.id) throw new SeedanceError("Seedance did not return a task id");
  return data.id;
}

export type TaskState =
  | { status: "pending" }
  | { status: "completed"; videoUrl: string }
  | { status: "failed"; error: string };

/** Fetches a task and normalises each provider's status vocabulary. */
export async function getTask(taskId: string): Promise<TaskState> {
  const { provider, apiKey, baseUrl } = getConfig();
  const headers = authHeaders(provider, apiKey);
  const id = encodeURIComponent(taskId);

  if (provider === "muapi") {
    const data = (await request(`${baseUrl}/predictions/${id}/result`, { method: "GET" }, headers)) as {
      status?: unknown;
      outputs?: unknown;
      error?: unknown;
    };
    const status = String(data.status ?? "").toLowerCase();
    if (status === "completed" || status === "succeeded" || status === "success") {
      // `outputs` is documented as a URL string but may arrive as a list.
      const out = Array.isArray(data.outputs) ? data.outputs[0] : data.outputs;
      return typeof out === "string" && out.startsWith("https://")
        ? { status: "completed", videoUrl: out }
        : { status: "failed", error: "Provider finished without a video" };
    }
    if (status === "failed" || status === "error" || status === "cancelled") {
      return { status: "failed", error: typeof data.error === "string" ? data.error : "Generation failed" };
    }
    return { status: "pending" };
  }

  const data = (await request(`${baseUrl}/contents/generations/tasks/${id}`, { method: "GET" }, headers)) as {
    status?: unknown;
    content?: { video_url?: unknown };
    error?: { code?: unknown; message?: unknown } | null;
  };
  const status = String(data.status ?? "").toLowerCase();

  if (status === "succeeded") {
    const url = data.content?.video_url;
    return typeof url === "string" && url.startsWith("https://")
      ? { status: "completed", videoUrl: url }
      : { status: "failed", error: "Provider finished without a video" };
  }
  if (status === "failed" || status === "cancelled" || status === "expired") {
    // Error codes (e.g. input moderation) are useful in server logs, not for the user.
    console.error("[seedance] task failed", taskId, status, JSON.stringify(data.error ?? null));
    return { status: "failed", error: typeof data.error?.code === "string" ? data.error.code : "Generation failed" };
  }
  return { status: "pending" }; // queued | running
}
