/**
 * Client for Google's Gemini image models (Nano Banana): edits the user's photo(s) from a hidden
 * prompt. Server-side only.
 *
 *     POST https://generativelanguage.googleapis.com/v1beta/interactions
 *     Auth: x-goog-api-key: <GEMINI_API_KEY>
 *     Docs: https://aistudio.google.com/docs/image-generation
 *
 * Unlike Higgsfield and Seedance this call is synchronous: the finished image comes back in the
 * response, so there is no task id to poll (see runGeminiImageJob).
 *
 *     GEMINI_API_KEY      API key from Google AI Studio (GOOGLE_API_KEY also works)
 *     GEMINI_IMAGE_MODEL  optional model override, default gemini-nano-banana-2.1
 *     GEMINI_BASE_URL     optional API address override (for testing against a stand-in server)
 */
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const geminiBaseUrl = () => cleanEnv(process.env.GEMINI_BASE_URL).replace(/\/+$/, "") || DEFAULT_BASE_URL;
/** Pins the response format so a later API revision cannot change it under us. */
const API_REVISION = "2026-05-20";
const DEFAULT_MODEL = "gemini-nano-banana-2.1";
const REQUEST_TIMEOUT_MS = 150_000;
/** Gemini accepts about 20 MB of inline data per request. */
const MAX_REQUEST_BYTES = 18 * 1024 * 1024;

export const GEMINI_IMAGE_SIZES = ["1K", "2K", "4K"] as const;
export type GeminiImageSize = (typeof GEMINI_IMAGE_SIZES)[number];

export class GeminiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "GeminiError";
  }
}

/** Per-template settings stored in `Template.generationConfig`. */
export interface GeminiImageTemplateConfig {
  provider: "gemini-image";
  /** Hidden instruction; the user never sees it. */
  prompt: string;
  imageSize?: GeminiImageSize;
  /** "auto" (or unset) lets the model keep the photo's shape. */
  aspectRatio?: string;
}

export function parseGeminiImageConfig(value: unknown): GeminiImageTemplateConfig | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  if (c.provider !== "gemini-image" || typeof c.prompt !== "string" || !c.prompt) return null;
  return c as unknown as GeminiImageTemplateConfig;
}

/** Strips quotes and invisible characters that sneak in when a key is pasted into a dashboard. */
export function cleanEnv(value: string | undefined) {
  const kept = [...(value ?? "")].filter((ch) => {
    const c = ch.codePointAt(0)!;
    const invisible = c <= 0x1f || c === 0x7f || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202f) || c === 0xfeff;
    return !invisible;
  });
  return kept.join("").trim().replace(/^["']|["']$/g, "");
}

export function geminiApiKey() {
  return cleanEnv(process.env.GEMINI_API_KEY) || cleanEnv(process.env.GOOGLE_API_KEY);
}

export function geminiConfigured() {
  return Boolean(geminiApiKey());
}

/** Google's list price for one edited image (output plus a typical photo and prompt as input), in USD. */
export const GEMINI_IMAGE_LIST_USD: Record<GeminiImageSize, number> = { "1K": 0.036, "2K": 0.053, "4K": 0.116 };

export interface GeminiImageInput {
  /** The user's photo(s). */
  images: { contentType: string; data: Uint8Array }[];
  prompt: string;
  imageSize?: GeminiImageSize;
  aspectRatio?: string;
}

export interface GeminiImageResult {
  /** The model's mime type when it sends one; the caller sniffs the bytes otherwise. */
  contentType: string | null;
  data: Uint8Array<ArrayBuffer>;
}

/**
 * Finds the generated image anywhere in the response. The Interactions API nests it under
 * steps[].content[] as { type: "image", data }, older shapes use inlineData parts; looking for
 * "an object with base64 image data" covers both.
 */
function findImage(node: unknown, depth = 0): { mime: string | null; data: string } | null {
  if (!node || typeof node !== "object" || depth > 10) return null;
  const o = node as Record<string, unknown>;
  const mime = o.mime_type ?? o.mimeType;
  if (
    typeof o.data === "string" &&
    o.data.length > 200 &&
    (o.type === "image" || (typeof mime === "string" && mime.startsWith("image/")))
  ) {
    return { mime: typeof mime === "string" ? mime : null, data: o.data };
  }
  for (const child of Object.values(o)) {
    const found = findImage(child, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Edits the photo(s) with the prompt and returns the finished image. */
export async function generateGeminiImage(input: GeminiImageInput): Promise<GeminiImageResult> {
  const key = geminiApiKey();
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set");

  const totalBytes = input.images.reduce((sum, i) => sum + i.data.byteLength, 0);
  if (totalBytes > MAX_REQUEST_BYTES) throw new GeminiError("Photos are too large to send");

  const responseFormat: Record<string, unknown> = { type: "image", image_size: input.imageSize ?? "1K" };
  if (input.aspectRatio && input.aspectRatio !== "auto") responseFormat.aspect_ratio = input.aspectRatio;

  let res: Response;
  try {
    res = await fetch(`${geminiBaseUrl()}/interactions`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json", "Api-Revision": API_REVISION },
      body: JSON.stringify({
        model: cleanEnv(process.env.GEMINI_IMAGE_MODEL) || DEFAULT_MODEL,
        input: [
          { type: "text", text: input.prompt },
          ...input.images.map((image) => ({
            type: "image",
            mime_type: image.contentType,
            data: Buffer.from(image.data).toString("base64"),
          })),
        ],
        response_format: responseFormat,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    throw new GeminiError(`Gemini request failed: ${e instanceof Error ? e.message : e}`);
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    // Provider detail is logged server-side only; callers surface a generic error.
    console.error(`[gemini] ${res.status}`, text.slice(0, 800));
    throw new GeminiError(`Gemini responded with ${res.status}`, res.status);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GeminiError("Gemini returned something that is not JSON");
  }
  const image = findImage(json);
  if (!image) {
    // Usually a refusal or a safety block: the response then carries text instead of an image.
    // Log its shape without the (large) base64 payloads.
    console.error("[gemini] no image in response", text.replace(/"data":"[^"]{200,}"/g, '"data":"…"').slice(0, 800));
    throw new GeminiError("Gemini did not return an image");
  }
  return { contentType: image.mime, data: new Uint8Array(Buffer.from(image.data, "base64")) };
}
