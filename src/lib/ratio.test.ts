import assert from "node:assert/strict";
import { test } from "node:test";
import { readImageSize } from "./image-size";
import { chooseRatio, parseRatio, ratioSettings, snapRatio } from "./ratio";

const RATIOS = ["1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9"];

/** A PNG header with this size (enough for the size reader). */
function png(width: number, height: number) {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

/** A JPEG: optional EXIF orientation (little-endian TIFF) and a start-of-frame with this stored size. */
function jpeg(width: number, height: number, orientation?: number) {
  const parts: number[] = [0xff, 0xd8];
  if (orientation) {
    // Exif\0\0, "II" 42 offset 8, one entry: tag 0x0112, type 3 (short), count 1, value, next IFD 0.
    const tiff = [0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, orientation, 0, 0, 0, 0, 0, 0, 0];
    const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
    parts.push(0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body);
  }
  parts.push(0xff, 0xc0, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1);
  return new Uint8Array(parts);
}

test("reads the size of a PNG and a JPEG", () => {
  assert.deepEqual(readImageSize(png(1200, 1600)), { width: 1200, height: 1600 });
  assert.deepEqual(readImageSize(jpeg(1600, 1200)), { width: 1600, height: 1200 });
});

test("applies the EXIF orientation: a phone photo stored sideways is portrait", () => {
  // Stored 4000 x 3000 with orientation 6 (rotate 90): shown 3000 x 4000.
  assert.deepEqual(readImageSize(jpeg(4000, 3000, 6)), { width: 3000, height: 4000 });
  // Orientation 1 (upright) leaves it alone.
  assert.deepEqual(readImageSize(jpeg(4000, 3000, 1)), { width: 4000, height: 3000 });
});

test("returns null for something that is not a picture", () => {
  assert.equal(readImageSize(new Uint8Array([1, 2, 3, 4, 5])), null);
});

test("a portrait photo gives a portrait ratio, a landscape one a landscape ratio", () => {
  assert.equal(snapRatio(3000, 4000, RATIOS), "3:4");
  assert.equal(snapRatio(4000, 3000, RATIOS), "4:3");
  assert.equal(snapRatio(1000, 1010, RATIOS), "1:1");
  assert.equal(snapRatio(1080, 1920, RATIOS), "9:16");
});

test("snapping compares logarithms, and extreme shapes clamp to the nearest supported ratio", () => {
  assert.equal(snapRatio(5000, 1000, RATIOS), "16:9");
  assert.equal(snapRatio(1000, 5000, RATIOS), "9:16");
  assert.equal(snapRatio(0, 100, RATIOS), null);
  assert.equal(snapRatio(100, 100, []), null);
});

test("parseRatio", () => {
  assert.equal(parseRatio("3:4"), 0.75);
  assert.equal(parseRatio("auto"), null);
});

test("ratio settings: a template saved before the setting existed follows its old aspect ratio", () => {
  assert.equal(ratioSettings({ aspectRatio: "auto" }).mode, "auto");
  assert.deepEqual(ratioSettings({ aspectRatio: "3:4" }), { mode: "fixed", fixed: "3:4", userRatio: false, sourcePhoto: 0 });
  assert.equal(ratioSettings({ ratioMode: "auto", userRatio: false }).userRatio, false);
  assert.equal(ratioSettings({ ratioMode: "auto", ratioSourcePhoto: 1 }).sourcePhoto, 1);
});

test("Auto follows the photo, and a manual choice overrides it", () => {
  const auto = ratioSettings({ ratioMode: "auto", aspectRatio: "auto" });
  assert.deepEqual(chooseRatio(auto, undefined, "3:4", RATIOS), { ok: true, ratio: "3:4" });
  assert.deepEqual(chooseRatio(auto, "auto", "3:4", RATIOS), { ok: true, ratio: "3:4" });
  assert.deepEqual(chooseRatio(auto, "16:9", "3:4", RATIOS), { ok: true, ratio: "16:9" });
});

test("the server rejects a ratio the template does not allow", () => {
  const auto = ratioSettings({ ratioMode: "auto" });
  assert.deepEqual(chooseRatio(auto, "21:9", "3:4", RATIOS), { ok: false, error: "invalid_ratio" });
  const locked = ratioSettings({ ratioMode: "auto", userRatio: false });
  assert.deepEqual(chooseRatio(locked, "1:1", "3:4", RATIOS), { ok: false, error: "invalid_ratio" });
  const fixed = ratioSettings({ ratioMode: "fixed", aspectRatio: "1:1" });
  assert.deepEqual(chooseRatio(fixed, "3:4", "3:4", RATIOS), { ok: false, error: "invalid_ratio" });
  assert.deepEqual(chooseRatio(fixed, undefined, "3:4", RATIOS), { ok: true, ratio: "1:1" });
  assert.deepEqual(chooseRatio(fixed, "1:1", null, RATIOS), { ok: true, ratio: "1:1" });
  assert.deepEqual(chooseRatio(auto, 5, "3:4", RATIOS), { ok: false, error: "invalid_ratio" });
});

test("an unknown photo size falls back to the provider's own Auto", () => {
  assert.deepEqual(chooseRatio(ratioSettings({ ratioMode: "auto" }), undefined, null, RATIOS), { ok: true, ratio: "auto" });
});
