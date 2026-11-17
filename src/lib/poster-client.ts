/**
 * Makes a small still image from a video, in the browser: the poster that template cards show instead of
 * downloading the whole video. The picture is a JPEG of about 480 px wide (tens of kilobytes). Returns null when
 * the browser cannot decode the video. `source` is a File (just picked) or a same-origin URL (a saved preview).
 */
export async function posterFromVideo(source: File | string): Promise<Blob | null> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video"));
      setTimeout(() => reject(new Error("timeout")), 20_000);
    });
    // A moment in, not frame zero: the first frame is often black or a fade-in.
    video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      setTimeout(() => reject(new Error("seek")), 10_000);
    });
    const scale = Math.min(1, 480 / (video.videoWidth || 480));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}
