"use client";

import { useState } from "react";
import { QPayModal } from "@/components/QPayModal";
import { Reveal } from "@/components/Reveal";
import { formatCredits, packageHighlights } from "@/config/pricing";
import type { CreditPackage } from "@/types";

/** Heroicons "CheckIcon" (20 solid). */
function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** The credit packs. "Most Popular" is highlighted; Buy Now opens the QPay step. */
export function PricingPlans({ packages }: { packages: CreditPackage[] }) {
  const [buying, setBuying] = useState<string | null>(null);

  return (
    <>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {packages.map((pkg, index) => (
          <Reveal key={pkg.id} delay={index * 90} className="h-full">
            <div
              className={`relative flex h-full flex-col rounded-3xl border p-6 ${
                pkg.highlighted
                  ? "border-purple-500/50 bg-[linear-gradient(180deg,rgba(139,92,246,0.16),rgba(139,92,246,0.04))] shadow-[0_0_40px_rgba(168,85,247,0.15)]"
                  : "border-line bg-surface"
              }`}
            >
              {pkg.highlighted && (
                <span className="btn-primary absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-medium">
                  Most Popular
                </span>
              )}
              <h2 className="text-lg font-semibold">{pkg.name}</h2>
              <p className="mt-3 text-4xl font-semibold tracking-tight">{formatCredits(pkg.priceMnt)}₮</p>
              <p className="mt-3 text-[15px] text-foreground">{formatCredits(pkg.credits)} credits</p>
              <p className="mt-1 text-sm text-muted">
                {pkg.bonusCredits > 0 ? `Includes ${formatCredits(pkg.bonusCredits)} bonus credits` : "No bonus"}
              </p>

              <ul className="mt-5 flex-1 space-y-3 border-t border-line pt-5">
                {packageHighlights(pkg).map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-purple-400" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setBuying(pkg.id)}
                className={`mt-6 w-full rounded-xl py-3 text-[14px] font-medium text-foreground ${
                  pkg.highlighted ? "btn-primary" : "btn-glass"
                }`}
              >
                Buy Now
              </button>
            </div>
          </Reveal>
        ))}
      </div>
      {buying && <QPayModal packages={packages} initialPackageId={buying} onClose={() => setBuying(null)} />}
    </>
  );
}
