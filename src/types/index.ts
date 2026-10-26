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
  previewUrl: string | null;
  categoryId: string;
  type: OutputType;
  /** Credits are always validated server-side; never trust this value from the client. For video this is the 480p price. */
  creditCost: number;
  /** Credits at 720p HD; null when the template is offered at 480p only. */
  creditCostHd: number | null;
  /** Length of the video this template makes, in seconds. */
  durationSeconds: number | null;
  aspectRatio: string;
  requiredPhotoCount: number;
  /** Label for each required photo slot, in order. May be shorter than requiredPhotoCount. */
  photoLabels: string[];
  photoRequirement: PhotoRequirement;
  active: boolean;
  trendingRank: number | null;
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
