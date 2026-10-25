export interface PrepareImageOptions {
  /** Longest side after downsizing; larger photos are scaled down, smaller ones are never enlarged. */
  maxSide?: number;
  /** JPEG quality, 0–1. */
  quality?: number;
  /**
   * Enforce Seedance's reference-image limits (at least 90,000 px, width/height between 0.4 and
   * 2.5). Photo-restoration templates turn this off so small scans and panoramas are accepted.
   */
  videoLimits?: boolean;
}

/**
 * Browser-only helper: decodes a photo (honouring EXIF rotation), downsizes it and
 * re-encodes it as JPEG. Phone photos are often 5–10 MB; video templates only need ~1280px,
 * and the smaller file uploads faster on mobile networks. Photo templates pass larger
 * `maxSide`/`quality` values to keep the detail the AI works from.
 */
export async function prepareImage(
  file: File,
  { maxSide = 1280, quality = 0.88, videoLimits = true }: PrepareImageOptions = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const ratio = bitmap.width / bitmap.height;
  const tooSmall = videoLimits ? bitmap.width * bitmap.height < 90_000 : Math.min(bitmap.width, bitmap.height) < 32;
  if (tooSmall || (videoLimits && (ratio < 0.4 || ratio > 2.5))) {
    bitmap.close();
    throw new Error("image_unsuitable");
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode_failed"))),
      "image/jpeg",
      quality,
    ),
  );
}
