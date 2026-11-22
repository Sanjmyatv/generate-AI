/**
 * A template with several people lets the user fill in only some of them: the people without a photo stay as they
 * are in the original video (or picture).
 *
 * The template's prompt names each person's photo by position ("the second reference image" for Genjutsu and image
 * edits, "Image 2" for Seedance), and the provider numbers the photos in the order they are sent. When a person is
 * skipped, the photos after it move up, so the prompt is rewritten to match:
 *   - a sentence that names a skipped person's photo is dropped (it would ask to replace them with nothing);
 *   - the remaining photo references are renumbered to the order actually sent;
 *   - a short, explicit list is added at the end: which photo replaces which person, and who stays unchanged.
 */

const ORDINALS = ["first", "second", "third", "fourth", "fifth"];
const ORDINAL_NUM = ["1st", "2nd", "3rd", "4th", "5th"];

/** "the second reference image" / "2nd reference photo" (Genjutsu, image edits). */
const ORDINAL_REF = /\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)(\s+reference\s+(?:image|photo))\b/gi;
/** "Image 2" (Seedance). */
const NUMBERED_REF = /\b(Image)\s+([1-5])\b/g;

function ordinalIndex(word: string) {
  const w = word.toLowerCase();
  const i = ORDINALS.indexOf(w);
  return i >= 0 ? i : ORDINAL_NUM.indexOf(w);
}

/** Which slots (0-based, in order) got a photo; checks they are distinct, ascending and within the template. */
export function validSlots(slots: unknown, count: number, required: number): number[] | null {
  if (slots === undefined) return count === required ? Array.from({ length: count }, (_, i) => i) : null;
  if (!Array.isArray(slots) || slots.length !== count || count < 1) return null;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!Number.isInteger(s) || s < 0 || s >= required || (i > 0 && s <= slots[i - 1])) return null;
  }
  return slots as number[];
}

export function promptForSlots(prompt: string, required: number, slots: number[], labels: string[]): string {
  if (slots.length >= required) return prompt; // everyone has a photo: the template's prompt as written

  // Seedance-style prompts say "Image 2"; the others "the second reference image".
  const numbered = /\bImage\s+[1-5]\b/.test(prompt) && !new RegExp(ORDINAL_REF.source, "i").test(prompt);
  const newIndex = new Map(slots.map((slot, i) => [slot, i])); // slot -> position in the photos sent
  const skipped = Array.from({ length: required }, (_, i) => i).filter((i) => !newIndex.has(i));

  const mentionsSkipped = (sentence: string) =>
    [...sentence.matchAll(ORDINAL_REF)].some((m) => skipped.includes(ordinalIndex(m[1]))) ||
    [...sentence.matchAll(NUMBERED_REF)].some((m) => skipped.includes(Number(m[2]) - 1));

  const sentences = prompt.match(/[^.!?]+[.!?]*\s*/g) ?? [prompt];
  const kept = sentences.filter((s) => !mentionsSkipped(s)).join("");

  const renumbered = kept
    .replace(ORDINAL_REF, (whole, word: string, rest: string) => {
      const to = newIndex.get(ordinalIndex(word));
      if (to === undefined) return whole;
      const isNum = /\d/.test(word);
      const out = isNum ? ORDINAL_NUM[to] : ORDINALS[to];
      return `${word[0] === word[0].toUpperCase() ? out[0].toUpperCase() + out.slice(1) : out}${rest}`;
    })
    .replace(NUMBERED_REF, (whole, img: string, n: string) => {
      const to = newIndex.get(Number(n) - 1);
      return to === undefined ? whole : `${img} ${to + 1}`;
    })
    .trim();

  const who = (slot: number) => {
    const label = labels[slot]?.trim();
    return label ? `person ${slot + 1} ("${label}")` : `person ${slot + 1}`;
  };
  const photo = (i: number) => (numbered ? `Image ${i + 1}` : `the ${ORDINALS[i]} reference image`);
  const lines = [
    `Only ${slots.length} of the ${required} people get a new face.`,
    ...slots.map((slot, i) => `Replace ${who(slot)} with the person in ${photo(i)}.`),
    ...skipped.map(
      (slot) => `Do not change ${who(slot)}: keep their original face, hair, body and identity exactly as in the original.`,
    ),
  ];
  return `${renumbered}\n\n${lines.join(" ")}`;
}
