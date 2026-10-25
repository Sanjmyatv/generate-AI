export interface MediaInfo {
  kind: "video" | "image";
  contentType: string;
  ext: string;
}

/** Detects the real media type from magic bytes; never trust the client's MIME type. */
export function sniffMedia(b: Uint8Array): MediaInfo | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", contentType: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { kind: "image", contentType: "image/png", ext: "png" };
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { kind: "image", contentType: "image/webp", ext: "webp" };
  if (ascii(4, 8) === "ftyp") {
    return ascii(8, 12) === "qt  "
      ? { kind: "video", contentType: "video/quicktime", ext: "mov" }
      : { kind: "video", contentType: "video/mp4", ext: "mp4" };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return { kind: "video", contentType: "video/webm", ext: "webm" };
  }
  return null;
}

/** Length in seconds of an MP4/MOV (read from its movie header), or null if it can't be read. */
export function mp4Duration(bytes: Uint8Array): number | null {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const i = buf.indexOf("mvhd");
  if (i < 0 || i + 28 > buf.length) return null;
  const version = buf[i + 4];
  const at = i + 4 + (version === 1 ? 20 : 12);
  if (at + 12 > buf.length) return null;
  const timescale = buf.readUInt32BE(at);
  const duration = version === 1 ? Number(buf.readBigUInt64BE(at + 4)) : buf.readUInt32BE(at + 4);
  return timescale > 0 ? duration / timescale : null;
}

const ASSET_PATH = /^\/api\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.[a-z0-9]+)?$/i;

/** Public path for an uploaded asset. The extension lets previews pick video vs image. */
export function assetPath(id: string, ext: string) {
  return `/api/assets/${id}.${ext}`;
}

/** The asset id inside one of our asset paths or full URLs, or null for anything else. */
export function assetIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let path = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      path = new URL(url).pathname;
    } catch {
      return null;
    }
  }
  return ASSET_PATH.exec(path)?.[1] ?? null;
}
