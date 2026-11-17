"use client";

import { useState } from "react";
import { estimateCostAction } from "@/app/actions/admin";
import { creditsForCostUsd, marginFor, targetMarginFor, type PricingConfig } from "@/lib/pricing";
import { hasPriceLookup, type TemplateFormValues } from "@/lib/template-admin";

const inputClass = "w-full rounded-xl border border-foreground/30 bg-transparent px-3 py-2";

const mnt = (n: number) => `${Math.round(n).toLocaleString("en-US")}₮`;

type CostKey = "costUsd" | "costUsdHd" | "costUsd2k" | "costUsd4k";
type CreditKey = "creditCost" | "creditCostHd" | "creditCost2k" | "creditCost4k";
const ALL_COST_KEYS: CostKey[] = ["costUsd", "costUsdHd", "costUsd2k", "costUsd4k"];

interface Tier {
  id: string;
  label: string;
  costKey: CostKey;
  creditKey: CreditKey;
}

/** A video is priced at 480p and 720p HD; an image at 1K, 2K and 4K. Each has its own cost and credits. */
const VIDEO_TIERS: Tier[] = [
  { id: "480p", label: "480p", costKey: "costUsd", creditKey: "creditCost" },
  { id: "720p", label: "720p HD", costKey: "costUsdHd", creditKey: "creditCostHd" },
];
const IMAGE_TIERS: Tier[] = [
  { id: "1k", label: "1K", costKey: "costUsd", creditKey: "creditCost" },
  { id: "2k", label: "2K", costKey: "costUsd2k", creditKey: "creditCost2k" },
  { id: "4k", label: "4K", costKey: "costUsd4k", creditKey: "creditCost4k" },
];

/**
 * The provider's cost for one generation next to what users pay for it: credits charged, revenue, total cost
 * (provider cost × (1 + retry buffer) + gateway fee) and the margin, from the same settings the price formula
 * uses. A margin under the target shows a red warning; saving is never blocked.
 */
export function CostMargin({
  values,
  onChange,
  config,
  auto,
  error,
}: {
  values: TemplateFormValues;
  onChange: <K extends keyof TemplateFormValues>(key: K, value: TemplateFormValues[K]) => void;
  config: PricingConfig;
  /** The credits are worked out automatically, so only what the price needs is asked for. */
  auto: boolean;
  error?: string;
}) {
  const [view, setView] = useState("480p");
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const isVideo = values.type === "VIDEO";
  const tiers = isVideo ? VIDEO_TIERS : IMAGE_TIERS;
  const tier = tiers.find((t) => t.id === view) ?? tiers[0];
  const costKey = tier.costKey;
  const creditKey = tier.creditKey;

  const hasLookup = hasPriceLookup(values.engine);
  const costValue = values[costKey];
  const costUsd = Number(costValue);
  const creditsValue = values[creditKey];
  const credits = Number(creditsValue);
  const hasCredits = creditsValue !== "" && Number.isFinite(credits);
  const ready = costValue !== "" && Number.isFinite(costUsd) && hasCredits;
  const m = ready ? marginFor({ costUsd, credits, cfg: config }) : null;
  const target = targetMarginFor(config, isVideo ? "video" : "image");
  // Image costs are small ($0.075), so they show three decimals; video costs two.
  const usd = (n: number) => `$${n.toFixed(isVideo ? 2 : 3)}`;
  const formulaCredits =
    costValue !== "" && Number.isFinite(costUsd) ? creditsForCostUsd(costUsd, config, isVideo ? "video" : "image") : null;

  // Cost inputs that are shown for typing; every other one still travels with the form as a hidden field.
  const visibleKeys: CostKey[] = auto ? (hasLookup ? [] : isVideo ? ["costUsd", "costUsdHd"] : ["costUsd"]) : [costKey];

  async function check() {
    setChecking(true);
    setNote(null);
    try {
      const result = await estimateCostAction({
        engine: values.engine,
        videoResolution: isVideo ? tier.id : "480p",
        sourceVideoUrl: values.sourceVideoUrl,
        prompt: values.prompt,
        imageResolution: isVideo ? values.imageResolution : tier.id,
        imageQuality: values.imageQuality,
        imageAspect: "auto", // the ratio never changes the price, so the lookup always asks for Auto
      });
      if (result.ok) {
        onChange(costKey, String(result.usd));
        setNote(result.origin === "list" ? (result.note ?? "Higgsfield list price.") : "Higgsfield account price.");
      } else {
        setNote(result.error);
      }
    } catch {
      setNote("Could not get the price. Enter it by hand.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-foreground/20 p-3">
      <div className="text-sm font-semibold">Cost and margin</div>

      {ALL_COST_KEYS.filter((k) => !visibleKeys.includes(k)).map((k) => (
        <input key={k} type="hidden" name={k} value={values[k]} />
      ))}

      <div role="group" aria-label={isVideo ? "Resolution to price" : "Quality to price"} className="flex gap-2">
        {tiers.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tier.id === t.id}
            onClick={() => setView(t.id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              tier.id === t.id ? "chip-brand" : "border-foreground/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {auto ? (
        <>
          {visibleKeys.length === 0 ? (
            <p className="text-sm">
              Provider cost at {tier.label}:{" "}
              <span className="font-semibold">
                {costValue !== "" && Number.isFinite(costUsd) ? usd(costUsd) : "…"}
              </span>
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold">Provider cost at {isVideo ? "480p" : "1K"} (USD)</label>
                <input
                  name="costUsd"
                  value={values.costUsd}
                  onChange={(e) => onChange("costUsd", e.target.value)}
                  inputMode="decimal"
                  placeholder={isVideo ? `empty = $${config.videoUsdPerSecond}/s rate` : `empty = $${config.imageCostUsd1kLow.toFixed(3)} (1K Low)`}
                  className={inputClass}
                />
              </div>
              {isVideo && (
                <div>
                  <label className="mb-1 block text-xs font-semibold">Provider cost at 720p HD (USD)</label>
                  <input
                    name="costUsdHd"
                    value={values.costUsdHd}
                    onChange={(e) => onChange("costUsdHd", e.target.value)}
                    inputMode="decimal"
                    placeholder="empty = 480p only"
                    className={inputClass}
                  />
                </div>
              )}
              <p className="col-span-2 text-xs text-foreground/60">
                Type what one generation costs you (BytePlus console) to override the per-second rate; the credits are
                worked out for you.
              </p>
            </div>
          )}
          <p className="text-xs text-foreground/60">
            Rate: {mnt(config.usdMnt)} per $1
            {isVideo ? `, $${config.videoUsdPerSecond}/s at 480p` : ""} (change these under Pricing settings).
          </p>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">
                Provider cost per generation at {tier.label} (USD)
              </label>
              <input
                name={costKey}
                value={costValue}
                onChange={(e) => onChange(costKey, e.target.value)}
                inputMode="decimal"
                placeholder={isVideo ? "e.g. 1.11" : "e.g. 0.075"}
                className={inputClass}
              />
            </div>
            <div className="flex items-end">
              {formulaCredits !== null && (
                <button
                  type="button"
                  onClick={() => onChange(creditKey, String(formulaCredits))}
                  className="rounded-full border border-foreground/30 px-3 py-2 text-xs font-semibold"
                >
                  Use formula price: {formulaCredits} credits
                </button>
              )}
            </div>
          </div>

          {hasLookup && (
            <button
              type="button"
              onClick={() => void check()}
              disabled={checking}
              className="rounded-full border border-foreground/30 px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              {checking ? "Checking…" : "Get price from Higgsfield"}
            </button>
          )}
          {note && <p className="text-xs text-foreground/70">{note}</p>}
        </>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {!hasCredits && tier !== tiers[0] && (
        <p className="text-xs text-foreground/60">Set the {tier.label} credits above first, then the margin shows here.</p>
      )}

      {m && (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-foreground/60">Credits charged</dt>
              <dd className="font-semibold">{credits.toLocaleString("en-US", { maximumFractionDigits: 2 })}</dd>
            </div>
            <div>
              <dt className="text-foreground/60">Revenue</dt>
              <dd className="font-semibold">{mnt(m.revenueMnt)}</dd>
            </div>
            <div>
              <dt className="text-foreground/60">Provider cost</dt>
              <dd className="font-semibold">{mnt(m.providerMnt)}</dd>
            </div>
            <div>
              <dt className="text-foreground/60">+ Retry buffer ({(config.retryRate * 100).toFixed(1)}%)</dt>
              <dd className="font-semibold">{mnt(m.retryMnt)}</dd>
            </div>
            <div>
              <dt className="text-foreground/60">+ Gateway fee ({(config.gatewayFeeRate * 100).toFixed(1)}%)</dt>
              <dd className="font-semibold">{mnt(m.feeMnt)}</dd>
            </div>
            <div>
              <dt className="text-foreground/60">Total cost</dt>
              <dd className="font-semibold">{mnt(m.costMnt)}</dd>
            </div>
          </dl>
          <p className={`text-sm font-semibold ${m.marginPct < target ? "text-red-500" : ""}`}>
            Margin at {tier.label}: {mnt(m.marginMnt)} ({m.marginPct.toFixed(1)}%), target {target}%
          </p>
          {m.marginPct < target && (
            <p role="alert" className="text-xs font-semibold text-red-500">
              {m.marginMnt < 0
                ? `Warning: at ${tier.label} this price loses money (${m.marginPct.toFixed(0)}%).`
                : `Warning: the margin at ${tier.label} is ${m.marginPct.toFixed(1)}%, below the ${target}% target.`}{" "}
              {formulaCredits !== null && formulaCredits > credits ? `The formula would charge ${formulaCredits} credits. ` : ""}
              {m.marginMnt < 0 ? "Saving needs an extra confirmation." : "You can still save."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
