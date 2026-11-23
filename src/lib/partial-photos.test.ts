import assert from "node:assert/strict";
import { test } from "node:test";
import { promptForSlots, validSlots } from "./partial-photos";

const GENJUTSU =
  "The video shows three men. Replace the first man (dancing) with the person in the first reference image. Replace the second man (glasses) with the person in the second reference image. Replace the third man (sunset) with the person in the third reference image. Keep the moves exactly the same.";
const LABELS = ["First guy", "Second guy", "Third guy"];

test("every photo given: prompt unchanged", () => {
  assert.equal(promptForSlots(GENJUTSU, 3, [0, 1, 2], LABELS), GENJUTSU);
});

test("only the second person: their sentence is renumbered, others dropped and kept unchanged", () => {
  const out = promptForSlots(GENJUTSU, 3, [1], LABELS);
  assert.match(out, /Replace the second man \(glasses\) with the person in the first reference image\./);
  assert.doesNotMatch(out, /second reference image|third reference image/);
  assert.doesNotMatch(out, /dancing|sunset/);
  assert.match(out, /Keep the moves exactly the same\./);
  assert.match(out, /Replace person 2 \("Second guy"\) with the person in the first reference image\./);
  assert.match(out, /Do not change person 1 \("First guy"\)/);
  assert.match(out, /Do not change person 3 \("Third guy"\)/);
});

test("first and third: the third becomes the second reference image", () => {
  const out = promptForSlots(GENJUTSU, 3, [0, 2], LABELS);
  assert.match(out, /sunset\) with the person in the second reference image/);
  assert.match(out, /dancing\) with the person in the first reference image/);
  assert.doesNotMatch(out, /glasses/);
});

test("Seedance style numbering", () => {
  const out = promptForSlots("Image 1 replaces the left dancer in Video 1. Image 2 replaces the right dancer.", 2, [1], []);
  assert.match(out, /^Image 1 replaces the right dancer\./);
  assert.match(out, /Replace person 2 with the person in Image 1\. Do not change person 1/);

});

test("slot validation", () => {
  assert.deepEqual(validSlots(undefined, 3, 3), [0, 1, 2]);
  assert.equal(validSlots(undefined, 1, 3), null); // an old client must send every photo
  assert.deepEqual(validSlots([2], 1, 3), [2]);
  assert.equal(validSlots([1, 1], 2, 3), null);
  assert.equal(validSlots([2, 0], 2, 3), null);
  assert.equal(validSlots([3], 1, 3), null);
  assert.equal(validSlots([0], 2, 3), null);
});

test("swap mode: instruction added, unknown values fall back to the default", async () => {
  const { chooseSwapMode, withSwapMode } = await import("./swap-mode");
  assert.equal(chooseSwapMode("full-body", "face"), "full-body");
  assert.equal(chooseSwapMode("anything", "face"), "face");
  assert.match(withSwapMode("Keep the moves.", "face"), /^Keep the moves\.\n\nFace swap only:/);
  assert.match(withSwapMode(undefined, "full-body"), /^Full-body change:/);
});
