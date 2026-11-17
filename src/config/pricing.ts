/**
 * Fixed pricing facts. Everything that depends on the credit formula (video prices, pack counts) is
 * worked out in src/lib/pricing.ts from the admin-editable settings, never typed here. Credit prices
 * are stored per template in the database; this file only holds image tier defaults and pack seeds.
 */

export type Resolution = "480p" | "720p";

/** 480p is the default; 720p HD is an opt-in upgrade. */
export const DEFAULT_RESOLUTION: Resolution = "480p";
export const RESOLUTIONS: readonly Resolution[] = ["480p", "720p"];

export const RESOLUTION_LABELS: Record<Resolution, { label: string; tagline: string }> = {
  "480p": { label: "480p", tagline: "Fast & Eco" },
  "720p": { label: "720p HD", tagline: "HD / Pro" },
};

/** Longest source video Genjutsu Light uses (Higgsfield trims anything longer). It bills per second of output, so cost scales with this. */
export const GENJUTSU_LIGHT_MAX_SECONDS = 30;

/** Credits a new Google account starts with (₮1,000 worth). */
export const SIGNUP_BONUS_CREDITS = 10;

export interface PackageDefinition {
  id: string;
  name: string;
  nameMn: string;
  priceMnt: number;
  /** Total credits issued, bonus included. */
  credits: number;
  bonusCredits: number;
  highlighted: boolean;
  /** The two "queue priority" rows on the pricing card. */
  priorityQueue: boolean;
  topPriorityQueue: boolean;
}

/**
 * The packs a fresh database starts with. After that the packs live in the database and are edited in
 * /admin/packs (the seed never overwrites them). Every pack is ₮100 per credit.
 */
export const PACKAGES: PackageDefinition[] = [
  { id: "trial", name: "Trial", nameMn: "Туршилтын багц", priceMnt: 5_000, credits: 50, bonusCredits: 0, highlighted: false, priorityQueue: false, topPriorityQueue: false },
  { id: "light", name: "Light Creator", nameMn: "Лайт бүтээгчийн багц", priceMnt: 10_000, credits: 100, bonusCredits: 0, highlighted: false, priorityQueue: false, topPriorityQueue: false },
  { id: "pro", name: "Pro Creator", nameMn: "Про бүтээгчийн багц", priceMnt: 23_000, credits: 230, bonusCredits: 0, highlighted: true, priorityQueue: true, topPriorityQueue: false },
  { id: "business", name: "Pro+", nameMn: "Про + багц", priceMnt: 45_000, credits: 450, bonusCredits: 0, highlighted: false, priorityQueue: true, topPriorityQueue: true },
];

/**
 * Credits as users see them: always a whole number, rounded up. The wallet and the ledger keep the
 * exact 2-decimal value; this is only for display.
 */
export function formatCredits(n: number) {
  return Math.ceil(n).toLocaleString("en-US");
}
