"use client";

import { useState } from "react";
import { QPayModal } from "@/components/QPayModal";
import { formatCredits } from "@/config/pricing";
import type { CreditPackage } from "@/types";

/** The credit packs. "Most Popular" is highlighted; Buy Now opens the QPay step. */
export function PricingPlans({ packages }: { packages: CreditPackage[] }) {
  const [buying, setBuying] = useState<string | null>(null);

  return (
    <>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className={`relative flex flex-col rounded-3xl border p-6 ${
              pkg.highlighted
                ? "border-[rgba(139,92,246,0.6)] bg-[linear-gradient(180deg,rgba(139,92,246,0.16),rgba(139,92,246,0.04))]"
                : "border-line bg-surface"
            }`}
          >
            {pkg.highlighted && (
              <span className="absolute -top-3 left-6 rounded-full bg-purple px-3 py-1 text-[11px] font-medium text-foreground">
                Most Popular
              </span>
            )}
            <h2 className="text-lg font-semibold">{pkg.name}</h2>
            <p className="mt-3 text-4xl font-semibold tracking-tight">{formatCredits(pkg.priceMnt)}₮</p>
            <p className="mt-3 text-[15px] text-foreground">{formatCredits(pkg.credits)} credits</p>
            <p className="mt-1 text-sm text-muted">
              {pkg.bonusCredits > 0 ? `Includes ${formatCredits(pkg.bonusCredits)} bonus credits` : "No bonus"}
            </p>
            <button
              type="button"
              onClick={() => setBuying(pkg.id)}
              className={`mt-6 w-full rounded-xl py-3 text-[14px] font-medium text-foreground ${
                pkg.highlighted ? "bg-purple" : "border border-line bg-surface"
              }`}
            >
              Buy Now
            </button>
          </div>
        ))}
      </div>
      {buying && <QPayModal packages={packages} initialPackageId={buying} onClose={() => setBuying(null)} />}
    </>
  );
}
