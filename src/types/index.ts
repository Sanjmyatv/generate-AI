export type OutputType = "image" | "video";

export type PhotoRequirement = "face" | "full-body";

export interface Category {
  id: string;
  name: string;
  /** Lower comes first on the home screen. */
  order: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  /** Mongolian versions; null until an admin writes them (the English ones are shown instead). */
  nameMn: string | null;
  descriptionMn: string | null;
  previewUrl: string | null;
  /** A small still image of a video preview, so cards need not load the video itself. */
  posterUrl: string | null;
  /** Every category the template belongs to; it shows under each. */
  categoryIds: string[];
  type: OutputType;
  /** Credits are always validated server-side; never trust this value from the client. For video this is the 480p price. */
  creditCost: number;
  /** Credits at 720p HD; null when the template is offered at 480p only. */
  creditCostHd: number | null;
  /** Image templates: credits for a 2K and a 4K render (creditCost is 1K). Null = not offered. */
  creditCost2k: number | null;
  creditCost4k: number | null;
  /** Length of the video this template makes, in seconds. */
  durationSeconds: number | null;
  aspectRatio: string;
  requiredPhotoCount: number;
  /** Label for each required photo slot, in order. May be shorter than requiredPhotoCount. */
  photoLabels: string[];
  /** The default swap: "face" swaps only the face, "full-body" changes the whole person. */
  photoRequirement: PhotoRequirement;
  /** The user may pick face swap or full-body change before generating. */
  swapChoice: boolean;
  active: boolean;
  /** In the automatic Trending list right now. */
  trending: boolean;
  /** Chosen in /admin as the home page's hero template. */
  heroFeatured: boolean;
  /** When it was added to the home page's Trending section in /admin (ISO), or null when it is not in it. */
  trendingFeaturedAt: string | null;
  /** Image templates: "auto" follows the photo, "fixed" always uses ratioFixed; null for videos. */
  ratioMode: "auto" | "fixed" | null;
  /** The ratios the image model supports, for an Auto template (used to snap the photo's shape and as the user's choices). */
  ratios: string[];
  /** Auto mode: may the user pick another ratio instead of Auto. */
  userRatio: boolean;
  ratioFixed: string | null;
  /** Auto mode: which photo's shape is used (0-based). */
  ratioSource: number;
  createdAt: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  /** Price in MNT (₮). */
  priceMnt: number;
  /** Credits included in `credits` as a bonus. */
  bonusCredits: number;
  /** Shown as "Most Popular". */
  highlighted: boolean;
  /** Mongolian name; null falls back to the dictionary, then to `name`. */
  nameMn: string | null;
  /** The two "queue priority" rows on the pricing card. */
  priorityQueue: boolean;
  topPriorityQueue: boolean;
}

export type GenerationStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface Generation {
  id: string;
  templateId: string;
  status: GenerationStatus;
  type: OutputType;
  thumbnailUrl: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  credits: number;
}
