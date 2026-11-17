import Link from "next/link";
import { auth } from "@/auth";
import { HistoryGrid, type HistoryItem } from "@/components/HistoryGrid";
import { LoginButtons } from "@/components/LoginButtons";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/db";
import { claimGuestGenerations } from "@/lib/generations";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { categoryName, templateName } from "@/lib/i18n/content";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

type TypeFilter = "all" | "image" | "video";

/** A link to the history page with these filters (the first page). */
function href(type: TypeFilter, cat: string | null, page = 1) {
  const q = new URLSearchParams();
  if (type !== "all") q.set("type", type);
  if (cat) q.set("cat", cat);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/history?${s}` : "/history";
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ type?: string; cat?: string; page?: string }> }) {
  const { t, locale } = await getT();
  const sp = await searchParams;
  const dateFormat = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium", timeStyle: "short" });
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-sm py-10 text-center">
        <h1 className="text-3xl font-bold">{t("history.title")}</h1>
        <p className="mt-2 mb-6 text-foreground/70">{t("history.loginPrompt")}</p>
        <LoginButtons redirectTo="/history" />
      </div>
    );
  }
  const userId = session.user.id;

  // Creations made before logging in belong to this account now.
  await claimGuestGenerations(await getActor());

  const type: TypeFilter = sp.type === "image" || sp.type === "video" ? sp.type : "all";
  const cat = sp.cat && /^[\w-]{1,60}$/.test(sp.cat) ? sp.cat : null;
  const page = Math.max(1, Math.trunc(Number(sp.page)) || 1);

  // Deleted items are gone for the user (the metadata row stays for billing and Trending).
  const mine = { userId, deletedAt: null };
  const inCategory = cat ? { template: { categories: { some: { categoryId: cat } } } } : {};
  const typeWhere = (tp: TypeFilter) => (tp === "all" ? {} : { template: { type: tp === "image" ? ("IMAGE" as const) : ("VIDEO" as const) } });

  const [counts, categories, rows] = await Promise.all([
    Promise.all((["all", "image", "video"] as const).map((tp) => prisma.generation.count({ where: { ...mine, ...inCategory, ...typeWhere(tp) } }))),
    // Each result inherits its template's categories; only categories the user actually has items in are offered.
    prisma.category.findMany({
      where: { active: true, system: false, templates: { some: { template: { generations: { some: mine } } } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.generation.findMany({
      where: { ...mine, ...inCategory, ...typeWhere(type) },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        status: true,
        createdAt: true,
        creditCost: true,
        template: { select: { id: true, name: true, nameMn: true, aspectRatio: true, type: true, durationSeconds: true } },
      },
    }),
  ]);
  const hasNext = rows.length > PAGE_SIZE;
  const items: HistoryItem[] = rows.slice(0, PAGE_SIZE).map((g) => ({
    id: g.id,
    status: g.status,
    type: g.template.type,
    templateId: g.template.id,
    templateName: templateName(g.template, locale),
    date: dateFormat.format(g.createdAt),
    credits: Number(g.creditCost),
    durationSeconds: g.template.durationSeconds,
    aspect: g.template.aspectRatio,
  }));

  const tabs: { id: TypeFilter; label: string; count: number }[] = [
    { id: "all", label: t("history.tabAll"), count: counts[0] },
    { id: "image", label: t("history.tabImages"), count: counts[1] },
    { id: "video", label: t("history.tabVideos"), count: counts[2] },
  ];
  const total = counts[0];

  return (
    <div className="py-10">
      <h1 className="text-3xl font-bold">{t("history.title")}</h1>

      <div role="tablist" aria-label={t("history.title")} className="mt-6 inline-flex gap-1 rounded-full border border-line bg-surface p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={href(tab.id, cat)}
            role="tab"
            aria-selected={type === tab.id}
            className={`inline-flex min-h-10 items-center gap-2 px-5 text-sm ${type === tab.id ? "chip-brand" : "rounded-full text-muted hover:text-foreground"}`}
          >
            {tab.label}
            <span className="text-xs opacity-80">{tab.count}</span>
          </Link>
        ))}
      </div>

      {categories.length > 0 && (
        <div role="group" aria-label={t("history.categories")} className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
          {[{ id: null as string | null, label: t("history.tabAll") }, ...categories.map((c) => ({ id: c.id, label: categoryName(t, c, locale) }))].map((chip) => (
            <Link
              key={chip.id ?? "all"}
              href={href(type, chip.id)}
              aria-current={cat === chip.id ? "true" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap px-4 text-sm ${cat === chip.id ? "chip-brand" : "chip-glass hover:border-brand"}`}
            >
              {chip.label}
            </Link>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-line bg-surface px-6 py-14 text-center">
          <p className="font-semibold">{total === 0 ? t("history.emptyTitle") : cat ? t("history.emptyFiltered") : type === "image" ? t("history.emptyImages") : t("history.emptyVideos")}</p>
          <p className="mt-1 text-sm text-muted">{t("history.emptyText")}</p>
          <Link href="/#discover" className="btn-primary mt-6">
            {t("history.makeOne")}
          </Link>
        </div>
      ) : (
        <>
          <HistoryGrid items={items} />
          {(page > 1 || hasNext) && (
            <nav className="mt-2 flex justify-center gap-3 pb-8">
              {page > 1 && (
                <Link href={href(type, cat, page - 1)} className="btn-glass btn-compact">
                  {t("history.prev")}
                </Link>
              )}
              {hasNext && (
                <Link href={href(type, cat, page + 1)} className="btn-glass btn-compact">
                  {t("history.next")}
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
