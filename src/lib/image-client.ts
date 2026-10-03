/**
 * Browser-only helper: decodes a photo (honouring EXIF rotation), downsizes it and
 * re-encodes it as JPEG. Phone photos are often 5–10 MB; the AI only needs ~1280px,
 * and the smaller file uploads faster on mobile networks.
 */
export async function prepareImage(file: File, maxSide = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  // Seedance rejects reference images under 90,000 px or with extreme aspect ratios
  // (it accepts width/height between 0.4 and 2.5), so fail early with a clear message.
  const ratio = bitmap.width / bitmap.height;
  if (bitmap.width * bitmap.height < 90_000 || ratio < 0.4 || ratio > 2.5) {
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
      0.88,
    ),
  );
}
