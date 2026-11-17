"use client";

import { useState } from "react";
import { savePackAction } from "@/app/actions/admin";
import { packCounts, packWarnings, referenceCredits } from "@/lib/packs";
import { marginFor, videoCostUsd, type PricingConfig } from "@/lib/pricing";

const inputClass = "mt-1 block w-full rounded-xl border border-foreground/30 bg-transparent px-3 py-2";

export interface PackRow {
  id: string;
  name: string;
  nameMn: string | null;
  priceMnt: number;
  highlighted: boolean;
  active: boolean;
  priorityQueue: boolean;
  topPriorityQueue: boolean;
}

/**
 * One credit pack. The credits are the price divided by the credit value, so the two cannot drift apart. The
 * preview counts what the credits cover (rounded down, from the same price list as the pricing page) and
 * checks the pack against its rule: Starter no 15 s video, Lite at least 1, Pro 2, Business 4.
 */
export function PackEditor({ pack, config }: { pack: PackRow; config: PricingConfig }) {
  const [price, setPrice] = useState(String(pack.priceMnt));
  const priceMnt = Number(price);
  const valid = Number.isInteger(priceMnt) && priceMnt >= config.creditValueMnt && priceMnt % config.creditValueMnt === 0;
  const credits = valid ? priceMnt / config.creditValueMnt : null;

  const counts = credits === null ? null : packCounts(credits, config);
  const warnings = counts ? packWarnings(pack.id, counts, config.referenceSeconds) : [];
  const ref = referenceCredits(config);
  // Margin on the reference video when this pack's credits are paid for at this pack's price.
  const margin =
    credits === null
      ? null
      : marginFor({
          costUsd: videoCostUsd(config.referenceSeconds, "480p", config),
          credits: ref.video480,
          cfg: { ...config, creditValueMnt: priceMnt / credits },
        });

  return (
    <form action={savePackAction} className="rounded-2xl border border-foreground/15 p-4">
      <input type="hidden" name="packId" value={pack.id} />
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{pack.name}</h2>
        <span className="text-xs text-foreground/50">id: {pack.id}</span>
        {!pack.active && <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">Hidden</span>}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold">
          Name (English)
          <input name="name" defaultValue={pack.name} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold">
          Name (Mongolian)
          <input name="nameMn" defaultValue={pack.nameMn ?? ""} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold">
          Price (₮)
          <input name="priceMnt" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className={inputClass} />
          <span className={`mt-1 block font-normal ${valid ? "text-foreground/60" : "text-red-500"}`}>
            {valid ? `= ${credits} credits (price ÷ ${config.creditValueMnt}₮)` : `Must be a multiple of ${config.creditValueMnt}₮.`}
          </span>
        </label>
        <div className="space-y-1 text-sm">
          {(
            [
              ["highlighted", "“Хамгийн их сонгогддог” badge", pack.highlighted],
              ["priorityQueue", "Row: priority queue", pack.priorityQueue],
              ["topPriorityQueue", "Row: top queue priority", pack.topPriorityQueue],
              ["active", "Shown on the site", pack.active],
            ] as const
          ).map(([name, label, checked]) => (
            <label key={name} className="flex items-center gap-2">
              <input type="checkbox" name={name} defaultChecked={checked} />
              {label}
            </label>
          ))}
        </div>
      </div>

      {counts && margin && (
        <div className="mt-3 rounded-xl bg-foreground/5 p-3 text-xs">
          <p>
            Covers <span className="font-semibold">{counts.images}</span> images (1K),{" "}
            <span className="font-semibold">{counts.video480}</span> × {config.referenceSeconds} s videos at 480p,{" "}
            <span className="font-semibold">{counts.video720}</span> × {config.referenceSeconds} s HD videos (alternatives from the same credits).
          </p>
          <p className={`mt-1 ${margin.marginPct < config.targetMarginPct - 0.5 ? "text-red-500" : "text-foreground/70"}`}>
            Margin on a {config.referenceSeconds} s 480p video ({ref.video480} credits): {margin.marginPct.toFixed(1)}% (target {config.targetMarginPct}%)
          </p>
          {warnings.map((w) => (
            <p key={w} role="alert" className="mt-1 font-semibold text-red-500">
              {w}
            </p>
          ))}
        </div>
      )}

      <button className="mt-3 btn-primary btn-compact">Save pack</button>
    </form>
  );
}
