"use client";

import { useState } from "react";
import { estimateCostAction } from "@/app/actions/admin";
import { creditsForMargin, marginFor, perCreditMnt, type PackagePrice } from "@/lib/pricing";
import { hasPriceLookup, type TemplateFormValues } from "@/lib/template-admin";

const inputClass = "w-full rounded-xl border border-foreground/30 bg-transparent px-3 py-2";

const mnt = (n: number) => `${Math.round(n).toLocaleString("en-US")}₮`;

/** Below this, a price is flagged: a margin under half of what users pay is thin once fees are counted. */
const MIN_MARGIN_PCT = 50;

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
 * The provider's price for one generation next to what users pay for it, so the admin can set
 * a credit cost with a margin in mind. Videos are priced per resolution (480p and 720p HD) and
 * images per quality (1K, 2K, 4K), so each has its own provider cost and credit price. Higgsfield
 * models are priced live for this account (discount included); Seedance's cost is typed in.
 */
export function CostMargin({
  values,
  onChange,
  packages,
  defaultUsdMnt,
  auto,
  error,
}: {
  values: TemplateFormValues;
  onChange: <K extends keyof TemplateFormValues>(key: K, value: TemplateFormValues[K]) => void;
  packages: PackagePrice[];
  defaultUsdMnt: number;
  /** The credits are worked out automatically, so only what the price needs is asked for. */
  auto: boolean;
  error?: string;
}) {
  const [usdMnt, setUsdMnt] = useState(String(defaultUsdMnt));
  const [target, setTarget] = useState("60");
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
  const rate = Number(usdMnt);
  const creditsValue = values[creditKey];
  const creditCost = Number(creditsValue);
  const hasCredits = creditsValue !== "" && Number.isFinite(creditCost);
  const ready = costValue !== "" && Number.isFinite(costUsd) && rate > 0 && hasCredits;
  const targetPct = Number(target);

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
        imageAspect: values.imageAspect,
      });
      if (result.ok) {
        onChange(costKey, String(result.usd));
        setNote(result.note ?? "Priced by Higgsfield for your account.");
      } else {
        setNote(result.error);
      }
    } catch {
      setNote("Could not get the price. Enter it by hand.");
    } finally {
      setChecking(false);
    }
  }

  const margins = ready
    ? packages.map((p) => ({ pack: p, perCredit: perCreditMnt(p), m: marginFor({ costUsd, creditCost, perCredit: perCreditMnt(p), usdMnt: rate }) }))
    : [];
  const thinnest = margins.length > 0 ? margins.reduce((a, b) => (b.m.marginPct < a.m.marginPct ? b : a)) : null;

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
              tier.id === t.id ? "btn-primary text-foreground" : "border-foreground/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {auto ? (
        <>
          {hasLookup ? (
            <p className="text-sm">
              Provider cost at {tier.label}:{" "}
              <span className="font-semibold">
                {costValue !== "" && Number.isFinite(costUsd) ? `$${costUsd.toFixed(2)}` : "…"}
              </span>{" "}
              <span className="text-xs text-foreground/60">(looked up from Higgsfield for your account)</span>
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold">Provider cost at 480p (USD)</label>
                <input
                  name="costUsd"
                  value={values.costUsd}
                  onChange={(e) => onChange("costUsd", e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 2.39"
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
                Seedance has no price lookup: type what one generation costs you (BytePlus console) and the credits are
                worked out for you.
              </p>
            </div>
          )}
          <p className="text-xs text-foreground/60">
            Exchange rate: {mnt(rate)} per $1 (set on the server as USD_MNT_RATE).
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
                placeholder="e.g. 2.39"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Exchange rate (₮ per $1)</label>
              <input value={usdMnt} onChange={(e) => setUsdMnt(e.target.value)} inputMode="decimal" className={inputClass} />
            </div>
          </div>

          {hasLookup ? (
            <button
              type="button"
              onClick={() => void check()}
              disabled={checking}
              className="rounded-full border border-foreground/30 px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              {checking ? "Checking…" : "Get price from Higgsfield"}
            </button>
          ) : (
            <p className="text-xs text-foreground/60">
              Seedance has no price lookup here. Enter what one generation costs you (BytePlus console, per video
              length and resolution).
            </p>
          )}
          {note && <p className="text-xs text-foreground/70">{note}</p>}
        </>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {!hasCredits && tier !== tiers[0] && (
        <p className="text-xs text-foreground/60">Set the {tier.label} credits above first, then the margin shows here.</p>
      )}

      {ready && packages.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-foreground/60">
                <tr>
                  <th className="py-1 pr-2 font-medium">Credit pack</th>
                  <th className="py-1 pr-2 font-medium">₮ / credit</th>
                  <th className="py-1 pr-2 font-medium">You earn</th>
                  <th className="py-1 pr-2 font-medium">Cost</th>
                  <th className="py-1 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {margins.map(({ pack, perCredit, m }) => (
                  <tr key={pack.id} className="border-t border-foreground/10">
                    <td className="py-1 pr-2">{pack.name}</td>
                    <td className="py-1 pr-2">{mnt(perCredit)}</td>
                    <td className="py-1 pr-2">{mnt(m.revenueMnt)}</td>
                    <td className="py-1 pr-2">{mnt(m.costMnt)}</td>
                    <td className={`py-1 font-semibold ${m.marginMnt < 0 ? "text-red-500" : m.marginPct < MIN_MARGIN_PCT ? "text-amber-500" : ""}`}>
                      {mnt(m.marginMnt)} ({m.marginPct.toFixed(0)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {thinnest && thinnest.m.marginPct < MIN_MARGIN_PCT && (
            <p role="alert" className={`text-xs font-semibold ${thinnest.m.marginMnt < 0 ? "text-red-500" : "text-amber-500"}`}>
              {thinnest.m.marginMnt < 0
                ? `Warning: at ${tier.label} this price loses money on the ${thinnest.pack.name} (${thinnest.m.marginPct.toFixed(0)}%).`
                : `Warning: the margin at ${tier.label} is below ${MIN_MARGIN_PCT}% on the ${thinnest.pack.name} (${thinnest.m.marginPct.toFixed(0)}%).`}
            </p>
          )}

          {!auto && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span>For a margin of</span>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                inputMode="numeric"
                className="w-14 rounded-lg border border-foreground/30 bg-transparent px-2 py-1"
              />
              <span>% charge at least:</span>
              {packages.map((p) => {
                const credits = creditsForMargin({ costUsd, perCredit: perCreditMnt(p), usdMnt: rate, targetPct });
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onChange(creditKey, String(credits))}
                    className="rounded-full border border-foreground/30 px-3 py-1 font-semibold"
                  >
                    {credits.toLocaleString("en-US")} credits ({p.name})
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-foreground/50">
            Provider cost only: payment fees, free signup credits and failed requests are not included.
          </p>
        </>
      )}
    </div>
  );
}
