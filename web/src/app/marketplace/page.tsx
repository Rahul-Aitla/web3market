import Link from "next/link";
import { Category } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AssetCard } from "@/components/asset-card";
import { CATEGORY_LABELS } from "@/lib/categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>;
}) {
  const { category, q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const activeCategory =
    category && category in Category ? (category as Category) : undefined;

  const where = {
    status: "PUBLISHED" as const,
    ...(activeCategory ? { category: activeCategory } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { shortDesc: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        shortDesc: true,
        category: true,
        priceWei: true,
        previewMediaType: true,
        previewMediaPath: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.asset.count({ where }),
  ]);

  const hasPrev = page > 1;
  const hasNext = page * PAGE_SIZE < total;
  const href = (opts: { category?: string; q?: string; page?: number }) => {
    const params = new URLSearchParams();
    const cat = "category" in opts ? opts.category : activeCategory;
    const query = "q" in opts ? opts.q : q;
    const p = opts.page ?? 1;
    if (cat) params.set("category", cat);
    if (query) params.set("q", query);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/marketplace${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Marketplace</h1>

      <form action="/marketplace" className="mb-4 flex gap-2">
        {activeCategory && (
          <input type="hidden" name="category" value={activeCategory} />
        )}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search prompts..."
          className="h-8 w-64 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href={href({ category: undefined })}>
          <Badge variant={activeCategory ? "outline" : "default"}>All</Badge>
        </Link>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <Link key={value} href={href({ category: value })}>
            <Badge variant={activeCategory === value ? "default" : "outline"}>
              {label}
            </Badge>
          </Link>
        ))}
      </div>

      {assets.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          No assets found{q ? ` for "${q}"` : ""}.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        {hasPrev ? (
          <Link href={href({ page: page - 1 })} className="text-sm underline">
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {hasNext ? (
          <Link href={href({ page: page + 1 })} className="text-sm underline">
            Next →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
