/**
 * Face swap or full-body change. A template set to "Let the user choose" (generationConfig.swapChoice) shows both on
 * the generate page; the user's choice adds one instruction to the end of the template's prompt, so the admin still
 * writes a single prompt. The template's photo type (FACE / FULL_BODY) is the choice selected by default.
 */
export type SwapMode = "face" | "full-body";

const INSTRUCTIONS: Record<SwapMode, string> = {
  face:
    "Face swap only: replace just the face of each replaced person with the face from their reference image. Keep that person's original hairstyle, body, clothing, outfit and accessories exactly as in the original.",
  "full-body":
    "Full-body change: replace each replaced person completely with the person in their reference image, including face, hair, body and clothing, while keeping the original pose, motion and setting.",
};

/** The mode a request asked for; anything else falls back to the template's default. */
export function chooseSwapMode(requested: unknown, fallback: SwapMode): SwapMode {
  return requested === "face" || requested === "full-body" ? requested : fallback;
}

/** The prompt with the swap instruction added (the prompt may be empty: Genjutsu works without one). */
export function withSwapMode(prompt: string | undefined, mode: SwapMode): string {
  return [prompt?.trim(), INSTRUCTIONS[mode]].filter(Boolean).join("\n\n");
}
