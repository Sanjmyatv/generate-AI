import Link from "next/link";
import { TemplatePreview } from "@/components/TemplatePreview";
import { prisma } from "@/lib/db";
import { deleteTemplateAction, savePricingSettingsAction, setTemplateActiveAction } from "@/app/actions/admin";
import { marginFor, perCreditMnt, usdMntRate } from "@/lib/pricing";
import { getPricingRates } from "@/lib/pricing-settings";
import { ENGINES, templateToFormValues } from "@/lib/template-admin";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  saved: "Template saved.",
  deleted: "Template deleted.",
  has_generations: "This template has been used to generate content, so it can't be deleted. Hide it instead.",
  pricing_saved: "Pricing settings saved. They apply the next time a price is worked out; saved templates keep their credits until you re-save them.",
  pricing_invalid: "Enter the retry buffer (0 to 100%) and the payment gateway fee (0 to 20%) as numbers.",
};

/** Credits exactly as stored: whole numbers plain, otherwise up to 2 decimals. */
const credits = (n: unknown) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

const inputClass = "w-24 rounded-xl border border-foreground/30 bg-transparent px-3 py-2";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const templates = await prisma.template.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    include: { category: { select: { name: true } } },
  });
  // Margin is shown against the cheapest credit pack, the worst case for what a credit earns.
  const packages = await prisma.creditPackage.findMany({ where: { active: true } });
  const cheapest = packages.sort((a, b) => perCreditMnt(a) - perCreditMnt(b))[0];
  const usdMnt = usdMntRate();
  const rates = await getPricingRates();

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates</h1>
        <Link href="/admin/templates/new" className="rounded-full btn-primary px-4 py-2 text-sm font-semibold text-foreground">
          New template
        </Link>
      </div>
      {notice && NOTICES[notice] && (
        <p className="mt-4 rounded-xl border border-foreground/20 p-3 text-sm">{NOTICES[notice]}</p>
      )}

      <form action={savePricingSettingsAction} className="mt-6 rounded-2xl border border-foreground/15 p-4">
        <h2 className="text-sm font-semibold">Pricing settings</h2>
        <p className="mt-1 text-xs text-foreground/60">
          The automatic selling price covers the provider cost, a retry buffer on top of it and the payment gateway&apos;s
          share, and still leaves the target margin: price = provider cost × (1 + retry buffer) ÷ (1 − margin − gateway fee).
          1 credit = 100₮.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="text-xs font-semibold">
            Retry buffer rate (%)
            <input name="retryPct" defaultValue={String(+(rates.retryRate * 100).toFixed(2))} inputMode="decimal" className={`mt-1 block ${inputClass}`} />
            <span className="mt-1 block font-normal text-foreground/60">default 5 (= 0.05)</span>
          </label>
          <label className="text-xs font-semibold">
            Payment gateway fee (%)
            <input name="feePct" defaultValue={String(+(rates.gatewayFeeRate * 100).toFixed(2))} inputMode="decimal" className={`mt-1 block ${inputClass}`} />
            <span className="mt-1 block font-normal text-foreground/60">default 1.5 (= 0.015)</span>
          </label>
          <button className="rounded-full btn-primary px-4 py-2 text-sm font-semibold text-foreground">Save</button>
        </div>
      </form>

      <ul className="mt-6 space-y-3">
        {templates.map((t) => {
          const engine = ENGINES.find((e) => e.value === templateToFormValues(t).engine);
          const configured = t.generationConfig !== null;
          const costUsd = (t.generationConfig as { costUsd?: unknown } | null)?.costUsd;
          const margin =
            typeof costUsd === "number" && cheapest
              ? marginFor({ costUsd, creditCost: Number(t.creditCost), perCredit: perCreditMnt(cheapest), usdMnt, ...rates })
              : null;
          return (
            <li key={t.id} className="flex gap-3 rounded-2xl border border-foreground/15 p-3">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg">
                <TemplatePreview src={t.previewUrl} alt={t.name} className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{t.name}</span>
                  {!t.active && <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">Hidden</span>}
                  {!configured && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs">Not set up: cannot generate yet</span>
                  )}
                </div>
                <p className="text-xs text-foreground/60">
                  {t.category.name} · {t.type === "VIDEO" ? "Video" : "Image"} · {credits(t.creditCost)}
                  {t.creditCostHd ? ` / ${credits(t.creditCostHd)}` : ""} credits ·{" "}
                  {configured ? engine?.label : "No method chosen"}
                </p>
                {configured && (
                  <p className={`text-xs ${margin && margin.marginMnt < 0 ? "text-red-500" : "text-foreground/60"}`}>
                    {margin
                      ? `Cost $${(costUsd as number).toFixed(2)} · margin ${margin.marginPct.toFixed(0)}% on the ${cheapest.name}`
                      : "Cost not set: open Edit to check the price"}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <Link href={`/admin/templates/${t.id}`} className="rounded-full border border-foreground/30 px-3 py-1">
                    Edit
                  </Link>
                  <form action={setTemplateActiveAction}>
                    <input type="hidden" name="templateId" value={t.id} />
                    <input type="hidden" name="active" value={String(!t.active)} />
                    <button className="rounded-full border border-foreground/30 px-3 py-1">{t.active ? "Hide" : "Show"}</button>
                  </form>
                  <form action={deleteTemplateAction}>
                    <input type="hidden" name="templateId" value={t.id} />
                    <button className="rounded-full border border-red-500/50 px-3 py-1 text-red-500">Delete</button>
                  </form>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
