/**
 * Watches a template's source video with Gemini and suggests how to set the template up: how
 * many people it needs photos of, what to say to the video model, and what to tell the user
 * to upload for each person. Admin-only, server-side only. Uses the same Interactions API and
 * GEMINI_API_KEY as the image engine (see gemini.ts).
 *
 *     GEMINI_ANALYSIS_MODEL  optional model override, default gemini-3.6-flash
 */
import { cleanEnv, geminiApiKey, geminiBaseUrl, GeminiError } from "@/lib/gemini";

const API_REVISION = "2026-05-20";
const DEFAULT_MODEL = "gemini-3.6-flash";
const REQUEST_TIMEOUT_MS = 180_000;
/** Inline data shares a ~20 MB request limit; base64 adds a third, so bigger videos use the Files API. */
const MAX_INLINE_BYTES = 12 * 1024 * 1024;
const FILE_POLL_MS = 2_000;
const FILE_READY_TIMEOUT_MS = 120_000;

/** Longest label the template form allows per photo. */
export const MAX_LABEL_LENGTH = 60;

/** Longest title and description the suggestions may have (descriptions are meant to be very short). */
export const MAX_TITLE_LENGTH = 40;
export const MAX_SHORT_DESCRIPTION_LENGTH = 90;

export interface VideoAnalysis {
  /** What the template is called, in Mongolian and English. */
  titleMn: string;
  titleEn: string;
  /** One very short sentence for the template card, in Mongolian and English. */
  descriptionMn: string;
  descriptionEn: string;
  peopleCount: number;
  generatedPrompt: string;
  requiredUploads: { personIndex: number; description: string }[];
}

export type PromptStyle = "reference-images" | "numbered-images";

const PROMPT_STYLES: Record<PromptStyle, string> = {
  // Genjutsu: "Replace the dancer with the person in the first reference image."
  "reference-images":
    'Refer to the user\'s photos as "the first reference image", "the second reference image" and so on, in the order of the people listed. Say which person in the video each photo replaces.',
  // Seedance: "Image 1", "Video 1".
  "numbered-images":
    'Refer to the user\'s photos as "Image 1", "Image 2" and so on, in the order of the people listed, and to the source video as "Video 1". Say which person in the video each photo applies to.',
};

function instruction(style: PromptStyle, maxPeople: number) {
  return [
    "You are setting up a template for an app where a user uploads their own photo(s) and an AI model puts them into this video.",
    "Watch the video and answer in the requested JSON.",
    "- titleMn / titleEn: a catchy name for this template, 2 to 4 words, at most 30 characters, no quotes, no emoji. titleMn is natural Mongolian (Cyrillic); titleEn is English.",
    "- descriptionMn / descriptionEn: ONE very short sentence (at most 70 characters, no emoji, no hashtags) telling the user what they get, e.g. \"Нэг зургаар вирал бүжгийн видео\". descriptionMn is natural Mongolian (Cyrillic); descriptionEn is English.",
    `- peopleCount: how many distinct main people appear (people whose face or body is clearly the subject). Count at most ${maxPeople}; ignore background crowds and passers-by.`,
    "- requiredUploads: one entry per counted person, personIndex starting at 0, ordered from left to right (or by prominence when they move around). description is the short label shown under that person's upload box, written to the user in English, at most " +
      MAX_LABEL_LENGTH +
      ' characters, e.g. "Clear front photo of the man in the suit". Say which person it is (by position, clothing or role) and what photo to upload (face or full body, depending on whether the video shows the whole body).',
    "- generatedPrompt: an instruction for the video model, 2 to 5 sentences. Describe the scene, setting, camera and mood, what each person does (dance, walk, pose...) and what must stay unchanged (motion, background, timing). " +
      PROMPT_STYLES[style],
    "Describe only what you can see. Do not guess names or identities.",
  ].join("\n");
}

const SCHEMA = {
  type: "object",
  properties: {
    titleMn: { type: "string" },
    titleEn: { type: "string" },
    descriptionMn: { type: "string" },
    descriptionEn: { type: "string" },
    peopleCount: { type: "integer" },
    generatedPrompt: { type: "string" },
    requiredUploads: {
      type: "array",
      items: {
        type: "object",
        properties: { personIndex: { type: "integer" }, description: { type: "string" } },
        required: ["personIndex", "description"],
      },
    },
  },
  required: ["titleMn", "titleEn", "descriptionMn", "descriptionEn", "peopleCount", "generatedPrompt", "requiredUploads"],
};

async function call(path: string, key: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "x-goog-api-key": key, ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    throw new GeminiError(`Gemini request failed: ${e instanceof Error ? e.message : e}`);
  }
  return res;
}

async function failed(res: Response, what: string): Promise<never> {
  console.error(`[gemini] ${what} ${res.status}`, (await res.text().catch(() => "")).slice(0, 800));
  throw new GeminiError(`Gemini responded with ${res.status}`, res.status);
}

/** Uploads a video with the Files API (resumable protocol) and waits until Gemini has processed it. */
async function uploadVideo(key: string, video: { contentType: string; data: Uint8Array }): Promise<string> {
  const base = geminiBaseUrl().replace(/\/v1beta$/, "");
  const start = await call(`${base}/upload/v1beta/files`, key, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(video.data.byteLength),
      "X-Goog-Upload-Header-Content-Type": video.contentType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "template-source" } }),
  });
  if (!start.ok) return failed(start, "file upload start");
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new GeminiError("Gemini gave no upload address");

  const done = await call(
    uploadUrl,
    key,
    {
      method: "POST",
      headers: {
        "Content-Length": String(video.data.byteLength),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: Buffer.from(video.data),
    },
    REQUEST_TIMEOUT_MS,
  );
  if (!done.ok) return failed(done, "file upload");
  const info = (await done.json()) as { file?: { name?: string; uri?: string; state?: string } };
  const file = info.file;
  if (!file?.name || !file.uri) throw new GeminiError("Gemini did not return the uploaded file");

  // Video needs processing before it can be used.
  let state = file.state;
  const deadline = Date.now() + FILE_READY_TIMEOUT_MS;
  while (state && state !== "ACTIVE") {
    if (state === "FAILED" || Date.now() > deadline) throw new GeminiError("Gemini could not process the video");
    await new Promise((r) => setTimeout(r, FILE_POLL_MS));
    const poll = await call(`${geminiBaseUrl()}/${file.name}`, key, { method: "GET" }, 30_000);
    if (!poll.ok) return failed(poll, "file status");
    state = ((await poll.json()) as { state?: string }).state;
  }
  return file.uri;
}

/** The JSON text of the model's answer, wherever the response puts it. */
function answerText(node: unknown, depth = 0): string | null {
  if (!node || typeof node !== "object" || depth > 10) return null;
  const o = node as Record<string, unknown>;
  if (o.type === "text" && typeof o.text === "string") return o.text;
  for (const child of Object.values(o)) {
    const found = answerText(child, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Turns whatever the model returned into values the template form can safely take. */
export function normalizeAnalysis(raw: unknown, maxPeople: number): VideoAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as {
    titleMn?: unknown;
    titleEn?: unknown;
    descriptionMn?: unknown;
    descriptionEn?: unknown;
    peopleCount?: unknown;
    generatedPrompt?: unknown;
    requiredUploads?: unknown;
  };
  // Short text for the card: no surrounding quotes, cut at a word boundary if the model ran long.
  const short = (value: unknown, max: number) => {
    const text = typeof value === "string" ? value.trim().replace(/^["'«“]+|["'»”]+$/g, "").trim() : "";
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    return (cut.includes(" ") ? cut.slice(0, cut.lastIndexOf(" ")) : cut).trim();
  };
  const uploads = (Array.isArray(r.requiredUploads) ? r.requiredUploads : [])
    .map((u) => ({
      personIndex: Number((u as { personIndex?: unknown })?.personIndex),
      description: String((u as { description?: unknown })?.description ?? "").trim(),
    }))
    .filter((u) => Number.isFinite(u.personIndex) && u.description)
    .sort((a, b) => a.personIndex - b.personIndex)
    .slice(0, maxPeople)
    .map((u, i) => ({ personIndex: i, description: u.description.slice(0, MAX_LABEL_LENGTH).trim() }));

  const counted = Math.trunc(Number(r.peopleCount));
  const peopleCount = Math.min(Math.max(Number.isFinite(counted) ? counted : uploads.length, uploads.length, 1), maxPeople);
  const generatedPrompt = typeof r.generatedPrompt === "string" ? r.generatedPrompt.trim().slice(0, 5000) : "";
  if (!generatedPrompt) return null;
  return {
    titleMn: short(r.titleMn, MAX_TITLE_LENGTH),
    titleEn: short(r.titleEn, MAX_TITLE_LENGTH),
    descriptionMn: short(r.descriptionMn, MAX_SHORT_DESCRIPTION_LENGTH),
    descriptionEn: short(r.descriptionEn, MAX_SHORT_DESCRIPTION_LENGTH),
    peopleCount,
    generatedPrompt,
    requiredUploads: uploads,
  };
}

export async function analyzeTemplateVideo(
  video: { contentType: string; data: Uint8Array },
  options: { style: PromptStyle; maxPeople: number },
): Promise<VideoAnalysis> {
  const key = geminiApiKey();
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set");

  const videoPart =
    video.data.byteLength <= MAX_INLINE_BYTES
      ? { type: "video", mime_type: video.contentType, data: Buffer.from(video.data).toString("base64") }
      : { type: "video", mime_type: video.contentType, uri: await uploadVideo(key, video) };

  const res = await call(`${geminiBaseUrl()}/interactions`, key, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Api-Revision": API_REVISION },
    body: JSON.stringify({
      model: cleanEnv(process.env.GEMINI_ANALYSIS_MODEL) || DEFAULT_MODEL,
      // The text goes after the video, as Google recommends for a single video.
      input: [videoPart, { type: "text", text: instruction(options.style, options.maxPeople) }],
      response_format: { type: "text", mime_type: "application/json", schema: SCHEMA },
    }),
  });
  if (!res.ok) return failed(res, "video analysis");

  const text = answerText(await res.json().catch(() => null));
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) : null;
  } catch {
    // fall through to the error below
  }
  const analysis = normalizeAnalysis(parsed, options.maxPeople);
  if (!analysis) {
    console.error("[gemini] unusable video analysis", (text ?? "").slice(0, 800));
    throw new GeminiError("Gemini did not return a usable analysis");
  }
  return analysis;
}
