import { prisma } from "@/lib/db";
import { archiveBytes, completeGeneration, failGeneration } from "@/lib/generations";
import { generateGeminiImage, type GeminiImageTemplateConfig } from "@/lib/gemini";

/**
 * Runs a Gemini image edit to the end in the background: the request that started it has
 * already answered 202, and the client polls /api/status as for every other provider. The
 * finished image is stored before the generation is marked completed, so the result route
 * can always serve it. Any failure refunds the credits. If the server restarts mid-call the
 * job is left PROCESSING and the poll's timeout refunds it.
 */
export async function runGeminiImageJob(generationId: string, uploadIds: string[], config: GeminiImageTemplateConfig) {
  try {
    const uploads = await prisma.upload.findMany({ where: { id: { in: uploadIds } } });
    const byId = new Map(uploads.map((u) => [u.id, u]));
    // Keep the photos in the order the user gave them: the prompt refers to them by position.
    const images = uploadIds.map((id) => byId.get(id)).filter((u) => u !== undefined);
    if (images.length !== uploadIds.length) throw new Error("A photo is no longer available");

    const result = await generateGeminiImage({
      images: images.map((u) => ({ contentType: u.contentType, data: u.data })),
      prompt: config.prompt,
      imageSize: config.imageSize,
      aspectRatio: config.aspectRatio,
    });
    if (!(await archiveBytes(generationId, result.data, result.contentType))) throw new Error("Could not store the result");
    await completeGeneration(generationId, null);
  } catch (e) {
    console.error("[gemini] job failed", generationId, e);
    await failGeneration(generationId, "generation_failed").catch((err) =>
      console.error("[gemini] could not refund", generationId, err),
    );
  }
}
