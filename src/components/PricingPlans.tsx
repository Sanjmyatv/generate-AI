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
    <svg viewBox="0 0 20 20" fill="currentColor" role="img" aria-label={label} className="mt-0.5 size-4 shrink-0 text-brand-light">
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
 * The credit packs. What the credits buy (images, 480p videos, 720p videos) sits in one box with "or" between
 * the lines, since they are alternatives from the same balance; then the same four rows on every card. A row the
 * pack includes gets a check, one it does not stays visible, dimmed, with a cross. "Most Popular" is highlighted; Buy Now opens the QPay step.
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
          // What the credits buy: alternatives (one OR another), shown together in one box.
          const choices: { label: string; on: boolean }[] = [
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
          ];
          const rows: { label: string; on: boolean }[] = [
            { on: true, label: t("plan.row.expiry") },
            { on: true, label: t("plan.row.refund") },
            { on: pkg.priorityQueue, label: t("plan.row.priority") },
            { on: pkg.topPriorityQueue, label: t("plan.row.topPriority") },
          ];
          return (
            // One subgrid per card: title, price, credits, the choices box, four rows, note and button line up across cards.
            <Reveal
              key={pkg.id}
              delay={index * 90}
              className={`relative row-span-10 grid grid-rows-subgrid gap-y-0 rounded-3xl border p-6 ${
                pkg.highlighted
                  ? "border-brand bg-surface shadow-[0_0_40px_var(--glow)]"
                  : "border-line bg-surface"
              }`}
            >
              {pkg.highlighted && (
                <span className="chip-brand absolute -top-3 left-6 px-3 py-1 text-[11px]">
                  {t("plans.popular")}
                </span>
              )}
              <h2 className="text-lg font-semibold">{packName(t, pkg, locale)}</h2>
              <p className="mt-3 text-4xl font-semibold tracking-tight">{formatCredits(pkg.priceMnt)}₮</p>
              <p className="mt-3 text-[15px] text-foreground">{t("plans.credits", { amount: formatCredits(pkg.credits) })}</p>

              <div className="mt-4 rounded-2xl border border-brand-light/20 bg-[linear-gradient(160deg,rgba(47,91,255,0.12),rgba(12,26,122,0.18))] px-4 py-3">
                <p className="pb-1 text-xs font-medium text-brand-light">
                  {t("plan.choiceTitle", { amount: formatCredits(pkg.credits) })}
                </p>
                {choices.map((row, i) => (
                  <div key={i}>
                    {i > 0 && (
                      <div className="flex items-center gap-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-foreground/45" aria-hidden="true">
                        <span className="h-px flex-1 bg-white/10" />
                        {t("plan.or")}
                        <span className="h-px flex-1 bg-white/10" />
                      </div>
                    )}
                    <div className={`flex items-start gap-2.5 py-1.5 text-sm ${row.on ? "text-zinc-200" : "text-zinc-500 opacity-45"}`}>
                      {row.on ? <CheckIcon label={t("plan.included")} /> : <CrossIcon label={t("plan.excluded")} />}
                      <span>
                        {i > 0 && <span className="sr-only">{t("plan.or")} </span>}
                        {row.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {rows.map((row, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 py-2 text-sm ${i === 0 ? "mt-3 pt-3" : ""} ${
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
                className={`mt-5 w-full self-end ${
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
