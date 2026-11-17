/**
 * Reads a picture's size from its bytes, with no image library: PNG, JPEG (EXIF orientation applied, so a phone
 * photo taken upright reports a portrait size even though its pixels are stored sideways) and WebP.
 */
export interface ImageSize {
  width: number;
  height: number;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

/** The EXIF orientation (1-8) in an APP1 segment, or 1 when there is none. */
function exifOrientation(b: Uint8Array, start: number, end: number): number {
  // "Exif\0\0", then a TIFF header: byte order, 42, offset of the first directory.
  if (end - start < 14 || b[start] !== 0x45 || b[start + 1] !== 0x78 || b[start + 2] !== 0x69 || b[start + 3] !== 0x66) return 1;
  const tiff = start + 6;
  const little = b[tiff] === 0x49;
  const u16 = (i: number) => (little ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]);
  const u32 = (i: number) => (little ? (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0 : u32be(b, i));
  const dir = tiff + u32(tiff + 4);
  if (dir + 2 > end) return 1;
  const entries = u16(dir);
  for (let n = 0; n < entries; n++) {
    const entry = dir + 2 + n * 12;
    if (entry + 12 > end) break;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

function jpegSize(b: Uint8Array): ImageSize | null {
  let i = 2;
  let orientation = 1;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue; // fill byte
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const length = u16be(b, i + 2);
    if (marker === 0xe1) orientation = exifOrientation(b, i + 4, Math.min(i + 2 + length, b.length));
    // A start-of-frame marker (not DHT, JPG or DAC) carries the size.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = u16be(b, i + 5);
      const width = u16be(b, i + 7);
      if (!width || !height) return null;
      // Orientations 5 to 8 turn the picture a quarter: the stored width is the shown height.
      return orientation >= 5 ? { width: height, height: width } : { width, height };
    }
    i += 2 + length;
  }
  return null;
}

function pngSize(b: Uint8Array): ImageSize | null {
  if (b.length < 24) return null;
  const width = u32be(b, 16);
  const height = u32be(b, 20);
  return width && height ? { width, height } : null;
}

function webpSize(b: Uint8Array): ImageSize | null {
  if (b.length < 30) return null;
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (chunk === "VP8X") {
    const width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { width, height };
  }
  if (chunk === "VP8 ") {
    const width = (b[26] | (b[27] << 8)) & 0x3fff;
    const height = (b[28] | (b[29] << 8)) & 0x3fff;
    return width && height ? { width, height } : null;
  }
  if (chunk === "VP8L") {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/** Width and height as the picture is shown (orientation applied), or null when the format is not understood. */
export function readImageSize(bytes: Uint8Array): ImageSize | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegSize(bytes);
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return pngSize(bytes);
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return webpSize(bytes);
  return null;
}
