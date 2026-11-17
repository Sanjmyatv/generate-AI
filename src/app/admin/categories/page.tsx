import Link from "next/link";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
  saveTrendingSettingsAction,
  setCategoryVisibleAction,
} from "@/app/actions/categories";
import { prisma } from "@/lib/db";
import { getTrendingConfig, getTrendingIds } from "@/lib/trending";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  created: "Category added.",
  saved: "Category saved.",
  deleted: "Category removed. Its templates were kept; they only lost this category.",
  system: "Trending is a system category: it fills itself from real use and cannot be removed.",
  invalid_name: "Enter a name of up to 40 characters.",
  invalid_trending: "Enter whole numbers inside the allowed ranges.",
  trending_saved: "Trending settings saved.",
};

const field = "rounded-xl border border-foreground/30 bg-transparent px-3 py-2 text-sm";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const [categories, config, trendingIds, noCategory] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ system: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      include: { _count: { select: { templates: true } } },
    }),
    getTrendingConfig(),
    getTrendingIds(),
    prisma.template.count({ where: { categories: { none: {} } } }),
  ]);
  const ordinary = categories.filter((c) => !c.system);

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Link href="/admin" className="text-sm text-foreground/60 hover:text-foreground">
          ← Templates
        </Link>
      </div>
      <p className="mt-1 text-sm text-foreground/60">
        A template can sit in several categories and shows under each of them; the “Бүгд” tab lists it once. Removing a
        category never deletes templates.{" "}
        {noCategory > 0 && `${noCategory} template(s) have no category yet (they still show under “Бүгд”).`}
      </p>
      {notice && NOTICES[notice] && <p className="mt-4 rounded-xl border border-foreground/20 p-3 text-sm">{NOTICES[notice]}</p>}

      <ul className="mt-6 space-y-2">
        {categories.map((c) => {
          const index = ordinary.findIndex((o) => o.id === c.id);
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-foreground/15 p-3">
              <form action={renameCategoryAction} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="id" value={c.id} />
                <input name="name" defaultValue={c.name} maxLength={40} aria-label="Name (Mongolian)" className={`${field} min-w-40 flex-1`} />
                <button className="btn-glass btn-compact">Rename</button>
              </form>
              <span className="text-xs text-foreground/60">
                slug <code>{c.id}</code> · {c._count.templates} template{c._count.templates === 1 ? "" : "s"}
                {c.system ? ` · system, ${trendingIds.length} trending now` : ""}
              </span>
              {!c.system && (
                <div className="flex gap-1">
                  {(["up", "down"] as const).map((direction) => (
                    <form key={direction} action={moveCategoryAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="direction" value={direction} />
                      <button
                        aria-label={direction === "up" ? "Move up" : "Move down"}
                        disabled={direction === "up" ? index === 0 : index === ordinary.length - 1}
                        className="btn-glass btn-compact disabled:opacity-30"
                      >
                        {direction === "up" ? "↑" : "↓"}
                      </button>
                    </form>
                  ))}
                </div>
              )}
              <form action={setCategoryVisibleAction}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="visible" value={String(!c.active)} />
                <button className="btn-glass btn-compact">{c.active ? "Hide" : "Show"}</button>
              </form>
              {!c.system && (
                <form action={deleteCategoryAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmButton
                    className="btn-danger btn-compact"
                    message={`Remove “${c.name}”? It contains ${c._count.templates} template(s). The templates are kept; they only lose this category.`}
                  >
                    Remove
                  </ConfirmButton>
                </form>
              )}
              {!c.active && <span className="text-xs text-foreground/60">Hidden on the site</span>}
            </li>
          );
        })}
      </ul>

      <form action={createCategoryAction} className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-foreground/15 p-3">
        <label className="text-xs font-semibold">
          New category (Mongolian name)
          <input name="name" maxLength={40} required className={`${field} mt-1 block`} />
        </label>
        <label className="text-xs font-semibold">
          Slug (optional)
          <input name="slug" maxLength={40} placeholder="auto" className={`${field} mt-1 block`} />
        </label>
        <button className="btn-primary btn-compact">Add category</button>
      </form>

      <form action={saveTrendingSettingsAction} className="mt-8 rounded-2xl border border-foreground/15 p-4">
        <h2 className="text-sm font-semibold">Trending (automatic)</h2>
        <p className="mt-1 text-xs text-foreground/60">
          Counted from completed generations of real users in the window: failed and refunded ones, admin and test accounts do
          not count, and deleting history does not lower the count. Refreshed about every 10 minutes. It stays hidden until
          enough templates qualify. Right now {trendingIds.length} template(s) are trending
          {trendingIds.length === 0 ? " (hidden)" : ""}. Exclude a single template in its editor.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="enabled" defaultChecked={config.enabled} /> Trending on
          </label>
          {(
            [
              ["windowDays", "Time window (days)", config.windowDays],
              ["maxItems", "Maximum items", config.maxItems],
              ["minGenerations", "Minimum generations", config.minGenerations],
              ["minUsers", "Minimum distinct users", config.minUsers],
              ["minTemplates", "Minimum templates to show Trending", config.minTemplates],
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="text-xs font-semibold">
              {label}
              <input name={name} defaultValue={value} inputMode="numeric" className={`${field} mt-1 block w-full`} />
            </label>
          ))}
        </div>
        <button className="btn-primary btn-compact mt-3">Save Trending settings</button>
      </form>
    </div>
  );
}
