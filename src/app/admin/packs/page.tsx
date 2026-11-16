import Link from "next/link";
import { PackEditor } from "@/components/admin/PackEditor";
import { prisma } from "@/lib/db";
import { getPricingConfig } from "@/lib/pricing-settings";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  saved: "Pack saved. The pricing page and checkout use it right away.",
  missing: "That pack no longer exists.",
  invalid: "Enter a name (up to 60 characters; the Mongolian one is optional).",
  invalid_price: "The price must be a multiple of the credit value, so the credits come out whole.",
};

/** The credit packs: the one place the pricing page, checkout and admin read them from. */
export default async function PacksPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const [packs, config] = await Promise.all([
    prisma.creditPackage.findMany({ orderBy: { sortOrder: "asc" } }),
    getPricingConfig(),
  ]);

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Credit packs</h1>
        <Link href="/admin" className="text-sm text-foreground/60 hover:text-foreground">
          ← Templates
        </Link>
      </div>
      <p className="mt-1 text-sm text-foreground/60">
        Every pack sells a credit at {config.creditValueMnt}₮. Existing balances and past purchases are never changed by
        editing a pack. The two queue-priority rows are shown on the pricing card; generation order does not use them yet.
      </p>
      {notice && NOTICES[notice] && <p className="mt-4 rounded-xl border border-foreground/20 p-3 text-sm">{NOTICES[notice]}</p>}
      <div className="mt-6 space-y-4">
        {packs.map((p) => (
          <PackEditor
            key={p.id}
            config={config}
            pack={{
              id: p.id,
              name: p.name,
              nameMn: p.nameMn,
              priceMnt: p.priceMnt,
              highlighted: p.highlighted,
              active: p.active,
              priorityQueue: p.priorityQueue,
              topPriorityQueue: p.topPriorityQueue,
            }}
          />
        ))}
      </div>
    </div>
  );
}
