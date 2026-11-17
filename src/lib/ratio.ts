/**
 * Image ratios. Shared by the server (which decides the final ratio) and the browser (which only previews it).
 * Pure: no database, no environment.
 */

/** "3:4" -> 0.75, or null when it is not a ratio. */
export function parseRatio(ratio: string): number | null {
  const m = /^(\d+):(\d+)$/.exec(ratio);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? w / h : null;
}

/**
 * The supported ratio closest to a picture's shape. Closeness is the distance between the logarithms of the
 * ratios, so 2:1 is as far from 1:1 as 1:2 is, and a very wide or very tall picture clamps to the most extreme
 * supported ratio. Null when the list has no usable ratio.
 */
export function snapRatio(width: number, height: number, allowed: readonly string[]): string | null {
  if (!(width > 0) || !(height > 0)) return null;
  const target = Math.log(width / height);
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const ratio of allowed) {
    const value = parseRatio(ratio);
    if (value === null) continue;
    const distance = Math.abs(Math.log(value) - target);
    if (distance < bestDistance) {
      best = ratio;
      bestDistance = distance;
    }
  }
  return best;
}

/** How an image template handles its ratio, read from its saved configuration. */
export interface RatioSettings {
  /** "auto": follows the source photo. "fixed": always `fixed`. */
  mode: "auto" | "fixed";
  /** The ratio of a fixed template (null in auto mode). */
  fixed: string | null;
  /** Auto mode only: may the user pick another ratio. Always false for a fixed template. */
  userRatio: boolean;
  /** Auto mode only: which photo's shape is used (0-based; the first by default). */
  sourcePhoto: number;
}

/**
 * Reads the ratio settings out of a template's configuration. A template saved before this setting existed counts
 * as Auto when its aspect ratio was "auto" and as fixed when it named one.
 */
export function ratioSettings(config: unknown): RatioSettings {
  const c = (config ?? {}) as { ratioMode?: unknown; aspectRatio?: unknown; userRatio?: unknown; ratioSourcePhoto?: unknown };
  const aspect = typeof c.aspectRatio === "string" ? c.aspectRatio : "auto";
  const fixed = c.ratioMode === "fixed" || (c.ratioMode === undefined && aspect !== "auto");
  const source = typeof c.ratioSourcePhoto === "number" && c.ratioSourcePhoto >= 0 ? Math.trunc(c.ratioSourcePhoto) : 0;
  return fixed
    ? { mode: "fixed", fixed: aspect !== "auto" ? aspect : null, userRatio: false, sourcePhoto: 0 }
    : { mode: "auto", fixed: null, userRatio: c.userRatio !== false, sourcePhoto: source };
}

export type RatioChoice = { ok: true; ratio: string } | { ok: false; error: "invalid_ratio" };

/**
 * The ratio a generation is rendered at. `requested` is what the browser asked for ("auto", absent, or a ratio);
 * `detected` is the ratio snapped from the source photo's real size on the server. Fixed templates keep their ratio
 * and refuse a different request; Auto templates follow the photo unless the user may choose and chose a supported
 * ratio. Anything else is refused. `ratio` falls back to "auto" (the provider's own) when the photo's size is unknown.
 */
export function chooseRatio(
  settings: RatioSettings,
  requested: unknown,
  detected: string | null,
  allowed: readonly string[],
): RatioChoice {
  const asked = typeof requested === "string" && requested !== "" && requested !== "auto" ? requested : null;
  if (requested !== undefined && requested !== null && typeof requested !== "string") return { ok: false, error: "invalid_ratio" };
  if (settings.mode === "fixed") {
    if (asked !== null && asked !== settings.fixed) return { ok: false, error: "invalid_ratio" };
    return { ok: true, ratio: settings.fixed ?? "auto" };
  }
  if (asked !== null) {
    if (!settings.userRatio || !allowed.includes(asked)) return { ok: false, error: "invalid_ratio" };
    return { ok: true, ratio: asked };
  }
  return { ok: true, ratio: detected ?? "auto" };
}
