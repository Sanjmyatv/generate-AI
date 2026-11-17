import { prisma } from "@/lib/db";

/** How the automatic Trending category is worked out. Edited in /admin/categories. */
export interface TrendingConfig {
  enabled: boolean;
  windowDays: number;
  maxItems: number;
  minGenerations: number;
  minUsers: number;
  /** Trending stays hidden until this many templates qualify. */
  minTemplates: number;
}

export const DEFAULT_TRENDING: TrendingConfig = {
  enabled: true,
  windowDays: 7,
  maxItems: 12,
  minGenerations: 3,
  minUsers: 2,
  minTemplates: 4,
};

export async function getTrendingConfig(): Promise<TrendingConfig> {
  const row = await prisma.trendingSetting.findUnique({ where: { id: "default" } });
  return row
    ? {
        enabled: row.enabled,
        windowDays: row.windowDays,
        maxItems: row.maxItems,
        minGenerations: row.minGenerations,
        minUsers: row.minUsers,
        minTemplates: row.minTemplates,
      }
    : DEFAULT_TRENDING;
}

/** The ranking is cached for about ten minutes: it is never recomputed on a page view. */
const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; ids: string[] } | null = null;

/** Forget the cached ranking (after the admin changes the settings or a template's "exclude" flag). */
export function invalidateTrending() {
  cache = null;
}

/**
 * Templates that are trending right now, best first. Only real use counts: completed generations in the last
 * `windowDays` days, not refunded, by accounts that are neither admin nor test. A template needs `minGenerations`
 * of them from `minUsers` different people, so one person cannot push it up. Ties go to more distinct users,
 * then the most recent use. Deleted history items still count: deleting keeps the metadata row. Fewer than
 * `minTemplates` qualifying templates means no Trending at all (an empty list), never a half-empty section.
 */
export async function getTrendingIds(): Promise<string[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.ids;
  const cfg = await getTrendingConfig();
  let ids: string[] = [];
  if (cfg.enabled) {
    const since = new Date(Date.now() - cfg.windowDays * 24 * 60 * 60 * 1000);
    const rows = await prisma.$queryRaw<{ templateId: string }[]>`
      SELECT g."templateId"
      FROM "Generation" g
      JOIN "User" u ON u."id" = g."userId"
      JOIN "Template" t ON t."id" = g."templateId"
      WHERE g."status" = 'COMPLETED'
        AND g."refundedAt" IS NULL
        AND COALESCE(g."completedAt", g."createdAt") >= ${since}
        AND NOT u."isAdmin"
        AND NOT u."isTest"
        AND t."active"
        AND NOT t."excludeFromTrending"
      GROUP BY g."templateId"
      HAVING COUNT(*) >= ${cfg.minGenerations} AND COUNT(DISTINCT g."userId") >= ${cfg.minUsers}
      ORDER BY COUNT(*) DESC, COUNT(DISTINCT g."userId") DESC, MAX(COALESCE(g."completedAt", g."createdAt")) DESC
    `;
    if (rows.length >= cfg.minTemplates) ids = rows.slice(0, cfg.maxItems).map((r) => r.templateId);
  }
  cache = { at: Date.now(), ids };
  return ids;
}
