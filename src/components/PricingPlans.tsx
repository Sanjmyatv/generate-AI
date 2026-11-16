"use client";

import { useState } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { QPayModal } from "@/components/QPayModal";
import { Reveal } from "@/components/Reveal";
import { formatCredits } from "@/config/pricing";
import { packName } from "@/lib/i18n/helpers";
import type { PackCounts } from "@/lib/packs";
import type { CreditPackage } from "@/types";

/** A pack with what its credits cover, counted on the server from the pricing settings. */
export interface Plan {
  pkg: CreditPackage;
  counts: PackCounts;
}

/** Heroicons "CheckIcon" (20 solid). */
function CheckIcon({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" role="img" aria-label={label} className="mt-0.5 size-4 shrink-0 text-purple-400">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Heroicons "XMarkIcon" (20 solid), muted. */
function CrossIcon({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" role="img" aria-label={label} className="mt-0.5 size-4 shrink-0 text-zinc-500">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

/**
 * The credit packs. Every card lists the same seven rows in the same order: a row the pack includes gets a
 * check, one it does not stays visible, dimmed, with a cross. The counts are alternatives from the same
 * credit balance. "Most Popular" is highlighted; Buy Now opens the QPay step.
 */
export function PricingPlans({ plans, referenceSeconds }: { plans: Plan[]; referenceSeconds: number }) {
  const t = useT();
  const locale = useLocale();
  const [buying, setBuying] = useState<string | null>(null);
  const packages = plans.map((p) => p.pkg);

  return (
    <>
      <div className="mt-10 grid gap-x-5 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map(({ pkg, counts }, index) => {
          const rows: { label: string; on: boolean }[] = [
            {
              on: counts.images > 0,
              label: counts.images > 0 ? t("plan.row.images", { n: counts.images.toLocaleString("en-US") }) : t("plan.row.imagesOff"),
            },
            {
              on: counts.video480 > 0,
              label: counts.video480 > 0 ? t("plan.row.video480", { n: counts.video480, s: referenceSeconds }) : t("plan.row.video480Off", { s: referenceSeconds }),
            },
            {
              on: counts.video720 > 0,
              label: counts.video720 > 0 ? t("plan.row.video720", { n: counts.video720, s: referenceSeconds }) : t("plan.row.video720Off", { s: referenceSeconds }),
            },
            { on: true, label: t("plan.row.expiry") },
            { on: true, label: t("plan.row.refund") },
            { on: pkg.priorityQueue, label: t("plan.row.priority") },
            { on: pkg.topPriorityQueue, label: t("plan.row.topPriority") },
          ];
          return (
            // One subgrid per card: the title, price, seven rows, note and button sit on the same lines in every card.
            <Reveal
              key={pkg.id}
              delay={index * 90}
              className={`relative row-span-12 grid grid-rows-subgrid gap-y-0 rounded-3xl border p-6 ${
                pkg.highlighted
                  ? "border-purple-500/50 bg-[linear-gradient(180deg,rgba(139,92,246,0.16),rgba(139,92,246,0.04))] shadow-[0_0_40px_rgba(168,85,247,0.15)]"
                  : "border-line bg-surface"
              }`}
            >
              {pkg.highlighted && (
                <span className="btn-primary absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-medium">
                  {t("plans.popular")}
                </span>
              )}
              <h2 className="text-lg font-semibold">{packName(t, pkg, locale)}</h2>
              <p className="mt-3 text-4xl font-semibold tracking-tight">{formatCredits(pkg.priceMnt)}₮</p>
              <p className="mt-3 text-[15px] text-foreground">{t("plans.credits", { amount: formatCredits(pkg.credits) })}</p>

              {rows.map((row, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 py-2 text-sm ${i === 0 ? "mt-4 border-t border-line pt-4" : ""} ${
                    row.on ? "text-zinc-300" : "text-zinc-500 opacity-45"
                  }`}
                >
                  {row.on ? <CheckIcon label={t("plan.included")} /> : <CrossIcon label={t("plan.excluded")} />}
                  <span>{row.label}</span>
                </div>
              ))}

              <p className="pt-3 text-xs leading-relaxed text-muted">{t("plan.note")}</p>
              <button
                type="button"
                onClick={() => setBuying(pkg.id)}
                className={`mt-5 w-full self-end py-3 text-[14px] font-medium text-foreground ${
                  pkg.highlighted ? "btn-primary" : "btn-glass"
                }`}
              >
                {t("plans.buy")}
              </button>
            </Reveal>
          );
        })}
      </div>
      {buying && <QPayModal packages={packages} initialPackageId={buying} onClose={() => setBuying(null)} />}
    </>
  );
}
