"use client";

import { useState } from "react";
import { estimateCostAction } from "@/app/actions/admin";
import { creditsForMargin, marginFor, perCreditMnt, type PackagePrice } from "@/lib/pricing";
import type { TemplateFormValues } from "@/lib/template-admin";

const inputClass = "w-full rounded-xl border border-foreground/30 bg-transparent px-3 py-2";

const mnt = (n: number) => `${Math.round(n).toLocaleString("en-US")}₮`;

/**
 * The provider's price for one generation next to what users pay for it, so the admin can set
 * a credit cost with a margin in mind. Higgsfield models are priced live for this account
 * (discount included); Seedance's cost is typed in.
 */
export function CostMargin({
  values,
  onChange,
  packages,
  defaultUsdMnt,
  error,
}: {
  values: TemplateFormValues;
  onChange: <K extends keyof TemplateFormValues>(key: K, value: TemplateFormValues[K]) => void;
  packages: PackagePrice[];
  defaultUsdMnt: number;
  error?: string;
}) {
  const [usdMnt, setUsdMnt] = useState(String(defaultUsdMnt));
  const [target, setTarget] = useState("60");
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const higgsfield = values.engine === "genjutsu" || values.engine === "marketing-image";
  const costUsd = Number(values.costUsd);
  const rate = Number(usdMnt);
  const creditCost = Number(values.creditCost);
  const ready = values.costUsd !== "" && Number.isFinite(costUsd) && rate > 0;
  const targetPct = Number(target);

  async function check() {
    setChecking(true);
    setNote(null);
    try {
      const result = await estimateCostAction({
        engine: values.engine,
        videoResolution: values.videoResolution,
        sourceVideoUrl: values.sourceVideoUrl,
        prompt: values.prompt,
        imageResolution: values.imageResolution,
        imageQuality: values.imageQuality,
        imageAspect: values.imageAspect,
      });
      if (result.ok) {
        onChange("costUsd", String(result.usd));
        setNote("Priced by Higgsfield for your account.");
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold">Provider cost per generation (USD)</label>
          <input
            name="costUsd"
            value={values.costUsd}
            onChange={(e) => onChange("costUsd", e.target.value)}
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

      {higgsfield ? (
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
      {error && <p className="text-xs text-red-500">{error}</p>}

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
                {packages.map((p) => {
                  const perCredit = perCreditMnt(p);
                  const m = marginFor({
                    costUsd,
                    creditCost: Number.isFinite(creditCost) ? creditCost : 0,
                    perCredit,
                    usdMnt: rate,
                  });
                  return (
                    <tr key={p.id} className="border-t border-foreground/10">
                      <td className="py-1 pr-2">{p.name}</td>
                      <td className="py-1 pr-2">{mnt(perCredit)}</td>
                      <td className="py-1 pr-2">{mnt(m.revenueMnt)}</td>
                      <td className="py-1 pr-2">{mnt(m.costMnt)}</td>
                      <td className={`py-1 font-semibold ${m.marginMnt < 0 ? "text-red-500" : ""}`}>
                        {mnt(m.marginMnt)} ({m.marginPct.toFixed(0)}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
                  onClick={() => onChange("creditCost", String(credits))}
                  className="rounded-full border border-foreground/30 px-3 py-1 font-semibold"
                >
                  {credits} credits ({p.name})
                </button>
              );
            })}
          </div>
          <p className="text-xs text-foreground/50">
            Provider cost only: payment fees, free guest generations and failed requests are not included.
          </p>
        </>
      )}
    </div>
  );
}
