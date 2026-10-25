/** Cap per ranged response so a metadata probe doesn't read a whole file from the database. */
const MAX_RANGE_BYTES = 4 * 1024 * 1024;

interface ServeBlobOptions {
  contentType: string;
  /** Total size in bytes. */
  size: number;
  rangeHeader: string | null;
  headers?: Record<string, string>;
  /** Reads `length` bytes starting at byte `start`; null if the row vanished. */
  readSlice: (start: number, length: number) => Promise<Uint8Array | null>;
}

/**
 * Serves a file stored in the database, honouring a single Range header (iOS Safari refuses
 * to play video without 206 responses). Without a Range header the whole file is returned.
 */
export async function serveBlob({
  contentType,
  size,
  rangeHeader,
  headers: extra = {},
  readSlice,
}: ServeBlobOptions): Promise<Response | null> {
  let start = 0;
  let end = size - 1;
  let status = 200;

  const m = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()) : null;
  if (m && (m[1] || m[2])) {
    if (m[1] === "") {
      start = Math.max(size - Number(m[2]), 0); // suffix range: last N bytes
    } else {
      start = Number(m[1]);
      if (m[2]) end = Math.min(Number(m[2]), size - 1);
    }
    end = Math.min(end, start + MAX_RANGE_BYTES - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    status = 206;
  }

  const chunk = await readSlice(start, end - start + 1);
  if (!chunk) return null;

  const out = new Headers(extra);
  out.set("Content-Type", contentType);
  out.set("Accept-Ranges", "bytes");
  out.set("Content-Length", String(chunk.byteLength));
  if (status === 206) out.set("Content-Range", `bytes ${start}-${start + chunk.byteLength - 1}/${size}`);
  return new Response(new Uint8Array(chunk), { status, headers: out });
}
