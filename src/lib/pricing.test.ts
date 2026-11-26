import assert from "node:assert/strict";
import { test } from "node:test";
import { packCounts, packWarnings, referenceCredits } from "./packs";
import { DEFAULT_PRICING, costFactor, creditsForCostUsd, imageCredits1k, lossLines, marginFor, videoCostUsd, videoCredits } from "./pricing";

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

// Images (brief B4): the 1K Low tier costs about $0.075.
test("a 1K Low image is 7 credits at about 60% margin", () => {
  assert.equal(imageCredits1k(cfg), 7);
  assert.equal(creditsForCostUsd(0.075, cfg, "image"), 7);
  const m = marginFor({ costUsd: 0.075, credits: 7, cfg });
  assert.ok(m.marginPct > 59 && m.marginPct < 61, `${m.marginPct.toFixed(1)}%`);
});

test("a High tier image ($0.18) is priced far higher, so it can never silently share the Low price", () => {
  assert.ok(creditsForCostUsd(0.18, cfg, "image") >= 16);
});

test("images use their own target margin", () => {
  const dearer = { ...cfg, targetMarginImagesPct: 70 };
  assert.ok(imageCredits1k(dearer) > 7);
  assert.equal(videoCredits(15, "480p", dearer), 93);
});

// Section 5 of the brief.
const PACKS: [string, number, number, number, number][] = [
  // id, credits, images (7 credits each), 15 s 480p videos, 15 s 720p videos
  ["trial", 50, 7, 0, 0],
  ["light", 100, 14, 1, 0],
  ["pro", 230, 32, 2, 1],
  ["business", 450, 64, 4, 2],
];

for (const [id, credits, images, v480, v720] of PACKS) {
  test(`${id} (${credits} credits) covers ${images} images, ${v480} videos, ${v720} HD videos`, () => {
    const counts = packCounts(credits, cfg);
    assert.deepEqual(counts, { images, video480: v480, video720: v720 });
    assert.deepEqual(packWarnings(id, counts, 15), []);
  });
}

test("pack validation fails when a pack is out of range", () => {
  // Starter with enough credits for a video.
  assert.equal(packWarnings("trial", packCounts(100, cfg), 15).length, 1);
  // Lite too small for one video.
  assert.equal(packWarnings("light", packCounts(90, cfg), 15).length, 1);
  // Pro and Business below their minimum.
  assert.equal(packWarnings("pro", packCounts(180, cfg), 15).length, 1);
  assert.equal(packWarnings("business", packCounts(370, cfg), 15).length, 1);
  // A pack without a rule never warns.
  assert.deepEqual(packWarnings("custom", packCounts(10, cfg), 15), []);
});

test("the old Lite pack (9,000₮ / 90 credits) no longer covers a video", () => {
  assert.equal(packCounts(90, cfg).video480, 0);
});

// The save check for prices below cost (admin template form).
test("an image priced 3 / 6 / 10 is not flagged by a leftover video HD cost", () => {
  const data = { type: "IMAGE" as const, creditCost: 3, creditCostHd: null, creditCost2k: 6, creditCost4k: 10 };
  const config = { costUsd: 0.03, costUsdHd: 2.35, costUsd2k: 0.05, costUsd4k: 0.08 };
  assert.deepEqual(lossLines(data, config, cfg), []);
});

test("an image quality priced below its cost is still flagged", () => {
  const data = { type: "IMAGE" as const, creditCost: 3, creditCostHd: null, creditCost2k: 1, creditCost4k: null };
  const lines = lossLines(data, { costUsd: 0.03, costUsd2k: 0.05 }, cfg);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^2K: 1 credits/);
});

test("a video's 720p HD price is checked, its empty 2K / 4K slots are not", () => {
  const data = { type: "VIDEO" as const, creditCost: 50, creditCostHd: 1, creditCost2k: null, creditCost4k: null };
  const lines = lossLines(data, { costUsd: 0.5, costUsdHd: 1, costUsd2k: 9, costUsd4k: 9 }, cfg);
  assert.deepEqual(lines.map((l) => l.split(":")[0]), ["720p HD"]);
});

test("pack image counts follow the real 1K image price when there is one", () => {
  // Lite: 100 credits. At the formula's 7 credits it covers 14 images; at a real price of 3 it covers 33.
  assert.equal(packCounts(100, cfg).images, 14);
  assert.equal(packCounts(100, cfg, 3).images, 33);
  assert.equal(packCounts(100, cfg, null).images, 14);
  // The video count does not depend on the image price.
  assert.equal(packCounts(100, cfg, 3).video480, 1);
});

test("regular Genjutsu is priced at its own (higher) rate; Light and the rest at the settings' rate", async () => {
  const { videoRateOf } = await import("./pricing");
  const cfg = { ...DEFAULT_PRICING, videoUsdPerSecond: 0.0739 };
  // At the list rate, regular Genjutsu costs its published $0.318/s (480p) and $0.681/s (720p).
  assert.ok(Math.abs(videoCostUsd(10, "480p", cfg, "standard") - 3.18) < 1e-9);
  assert.ok(Math.abs(videoCostUsd(10, "720p", cfg, "standard") - 6.81) < 1e-9);
  assert.ok(videoCredits(11, "480p", cfg, "standard") > 4 * videoCredits(11, "480p", cfg));
  assert.equal(videoRateOf({ provider: "genjutsu" }), "standard");
  assert.equal(videoRateOf({ provider: "genjutsu", light: true }), "rate");
  assert.equal(videoRateOf({ provider: "seedance" }), "rate");
  assert.equal(videoRateOf(null), "rate");
});
