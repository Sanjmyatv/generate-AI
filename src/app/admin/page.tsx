import Link from "next/link";
import { PricingSettingsForm } from "@/components/admin/PricingSettingsForm";
import { TemplatePreview } from "@/components/TemplatePreview";
import { prisma } from "@/lib/db";
import { assetIdFromUrl } from "@/lib/media";
import { deleteTemplateAction, setTemplateActiveAction } from "@/app/actions/admin";
import { marginFor, videoListCostUsd } from "@/lib/pricing";
import { getPricingConfig } from "@/lib/pricing-settings";
import { referenceCredits } from "@/lib/packs";
import { ENGINES, templateToFormValues } from "@/lib/template-admin";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  saved: "Template saved.",
  deleted: "Template deleted.",
  has_generations: "This template has been used to generate content, so it can't be deleted. Hide it instead.",
  pricing_saved: "Pricing settings saved. No template with automatic credits changed.",
  pricing_applied: "Pricing settings saved and the credits of the listed templates were updated.",
};

/** Credits exactly as stored: whole numbers plain, otherwise up to 2 decimals. */
const credits = (n: unknown) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const [templates, cfg] = await Promise.all([
    prisma.template.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      include: { categories: { include: { category: { select: { name: true } } } } },
    }),
    getPricingConfig(),
  ]);

  // How heavy each uploaded preview is: every visitor's phone downloads it, so a big one is flagged.
  const previewIds = templates.flatMap((t) => assetIdFromUrl(t.previewUrl) ?? []);
  const previewSizes = new Map(
    (await prisma.asset.findMany({ where: { id: { in: previewIds } }, select: { id: true, size: true } })).map((a) => [a.id, a.size]),
  );

  // If the discount on our Higgsfield account ever ended, what the reference video would earn at list price.
  const reference = referenceCredits(cfg);
  const atList = marginFor({
    costUsd: videoListCostUsd(cfg.referenceSeconds, "480p", cfg),
    credits: reference.video480,
    cfg,
  });

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/categories" className="btn-glass btn-compact">
            Categories
          </Link>
          <Link href="/admin/packs" className="btn-glass btn-compact">
            Credit packs
          </Link>
          <Link href="/admin/templates/new" className="btn-primary btn-compact">
            New template
          </Link>
        </div>
      </div>
      {notice && NOTICES[notice] && (
        <p className="mt-4 rounded-xl border border-foreground/20 p-3 text-sm">{NOTICES[notice]}</p>
      )}

      <PricingSettingsForm
        config={cfg}
        reference={{ credits: reference.video480, seconds: cfg.referenceSeconds, marginAtListPct: atList.marginPct }}
      />

      <ul className="mt-6 space-y-3">
        {templates.map((t) => {
          const engine = ENGINES.find((e) => e.value === templateToFormValues(t).engine);
          const configured = t.generationConfig !== null;
          const costUsd = (t.generationConfig as { costUsd?: unknown } | null)?.costUsd;
          const margin =
            typeof costUsd === "number" ? marginFor({ costUsd, credits: Number(t.creditCost), cfg }) : null;
          return (
            <li key={t.id} className="flex gap-3 rounded-2xl border border-foreground/15 p-3">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg">
                <TemplatePreview src={t.previewUrl} poster={t.previewPosterUrl} alt={t.name} className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{t.name}</span>
                  {!t.active && <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">Hidden</span>}
                  {t.autoCredits && <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">Automatic credits</span>}
                  {t.categories.length === 0 && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs">No category</span>
                  )}
                  {(() => {
                    const bytes = previewSizes.get(assetIdFromUrl(t.previewUrl) ?? "");
                    if (bytes === undefined || (bytes < 6 * 1024 * 1024 && t.previewPosterUrl)) return null;
                    const mb = (bytes / 1024 / 1024).toFixed(1);
                    return (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs">
                        Preview {mb} MB{bytes >= 6 * 1024 * 1024 ? ": too heavy, upload a lighter clip" : ""}
                        {t.previewPosterUrl ? "" : ", no thumbnail"}
                      </span>
                    );
                  })()}
                  {t.excludeFromTrending && <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">Not in Trending</span>}
                  {!configured && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs">Not set up: cannot generate yet</span>
                  )}
                </div>
                <p className="text-xs text-foreground/60">
                  {t.categories.map((c) => c.category.name).join(", ") || "-"} · {t.type === "VIDEO" ? "Video" : "Image"} · {credits(t.creditCost)}
                  {t.creditCostHd ? ` / ${credits(t.creditCostHd)}` : ""} credits ·{" "}
                  {configured ? engine?.label : "No method chosen"}
                </p>
                {configured && (
                  <p className={`text-xs ${margin && margin.marginPct < cfg.targetMarginPct ? "text-red-500" : "text-foreground/60"}`}>
                    {margin
                      ? `Cost $${(costUsd as number).toFixed(2)} · margin ${margin.marginPct.toFixed(0)}% (target ${cfg.targetMarginPct}%)`
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
