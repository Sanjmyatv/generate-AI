/**
 * Shared bits for talking to Google's Gemini API (the Interactions API), server-side only. The
 * admin panel uses it to watch template videos (see gemini-video.ts).
 *
 *     GEMINI_API_KEY      API key from Google AI Studio (GOOGLE_API_KEY also works)
 *     GEMINI_BASE_URL     optional API address override (for testing against a stand-in server)
 *     Docs: https://aistudio.google.com/docs
 */
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const geminiBaseUrl = () => cleanEnv(process.env.GEMINI_BASE_URL).replace(/\/+$/, "") || DEFAULT_BASE_URL;

export class GeminiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "GeminiError";
  }
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
