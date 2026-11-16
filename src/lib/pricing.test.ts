import assert from "node:assert/strict";
import { test } from "node:test";
import { packCounts, packWarnings, referenceCredits } from "./packs";
import { DEFAULT_PRICING, costFactor, marginFor, videoCostUsd, videoCredits } from "./pricing";

const cfg = DEFAULT_PRICING;

// Section 4 of the brief: seconds -> [480p credits, 720p credits].
const FIXTURES: [number, number, number][] = [
  [5, 31, 63],
  [10, 62, 125],
  [15, 93, 187],
  [20, 124, 250],
];

test("K is (1 + retry) / (1 - margin - gateway)", () => {
  assert.ok(Math.abs(costFactor(cfg) - 1.05 / 0.44) < 1e-9);
});

for (const [seconds, c480, c720] of FIXTURES) {
  test(`${seconds} s video: ${c480} credits at 480p, ${c720} at 720p`, () => {
    assert.equal(videoCredits(seconds, "480p", cfg), c480);
    assert.equal(videoCredits(seconds, "720p", cfg), c720);
  });

  test(`${seconds} s video keeps the 55% margin after rounding`, () => {
    for (const [res, credits] of [["480p", c480], ["720p", c720]] as const) {
      const m = marginFor({ costUsd: videoCostUsd(seconds, res, cfg), credits, cfg });
      assert.ok(m.marginPct >= 54.9, `${seconds}s ${res}: ${m.marginPct.toFixed(2)}%`);
      assert.ok(m.marginPct < 58, `${seconds}s ${res}: ${m.marginPct.toFixed(2)}% is rounding up too far`);
    }
  });
}

test("a 15 s 480p video earns 55.1%", () => {
  const m = marginFor({ costUsd: videoCostUsd(15, "480p", cfg), credits: 93, cfg });
  assert.equal(m.marginPct.toFixed(1), "55.1");
});

test("credits are rounded up once on the total, not per second", () => {
  // 15 x the per-second credits (0.0618 -> 1 each) would be 15 credits per 15 s if rounded per second.
  assert.equal(videoCredits(15, "480p", cfg), 93);
  assert.ok(videoCredits(15, "480p", cfg) < 15 * videoCredits(1, "480p", cfg) * 10);
});

test("changing a setting changes the price (target margin 60% -> dearer)", () => {
  assert.ok(videoCredits(15, "480p", { ...cfg, targetMarginPct: 60 }) > 93);
});

test("the reference video costs 93 / 187 credits", () => {
  assert.deepEqual(referenceCredits(cfg), { video480: 93, video720: 187 });
});

// Section 5 of the brief.
const PACKS: [string, number, number, number, number][] = [
  // id, credits, images, 15 s 480p videos, 15 s 720p videos
  ["trial", 50, 16, 0, 0],
  ["light", 100, 33, 1, 0],
  ["pro", 230, 76, 2, 1],
  ["business", 450, 150, 4, 2],
];

for (const [id, credits, images, v480, v720] of PACKS) {
  test(`${id} (${credits} credits) covers ${images} images, ${v480} videos, ${v720} HD videos`, () => {
    const counts = packCounts(credits, cfg, 3);
    assert.deepEqual(counts, { images, video480: v480, video720: v720 });
    assert.deepEqual(packWarnings(id, counts, 15), []);
  });
}

test("pack validation fails when a pack is out of range", () => {
  // Starter with enough credits for a video.
  assert.equal(packWarnings("trial", packCounts(100, cfg, 3), 15).length, 1);
  // Lite too small for one video.
  assert.equal(packWarnings("light", packCounts(90, cfg, 3), 15).length, 1);
  // Pro and Business below their minimum.
  assert.equal(packWarnings("pro", packCounts(180, cfg, 3), 15).length, 1);
  assert.equal(packWarnings("business", packCounts(370, cfg, 3), 15).length, 1);
  // A pack without a rule never warns.
  assert.deepEqual(packWarnings("custom", packCounts(10, cfg, 3), 15), []);
});

test("the old Lite pack (9,000₮ / 90 credits) no longer covers a video", () => {
  assert.equal(packCounts(90, cfg, 3).video480, 0);
});
