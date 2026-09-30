import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { formatEther } from "viem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS } from "@/lib/categories";
import { DownloadButton } from "@/components/download-button";
import { ReviewForm } from "@/components/review-form";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/?needsWallet=1");

  const purchases = await prisma.purchase.findMany({
    where: { buyerId: user.userId, status: "CONFIRMED" },
    include: {
      asset: {
        select: {
          id: true,
          slug: true,
          title: true,
          shortDesc: true,
          category: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Purchases</h1>
      {purchases.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No purchases yet.{" "}
          <Link href="/marketplace" className="underline">
            Browse the marketplace
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {purchases.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Link
                    href={`/marketplace/${p.asset.slug}`}
                    className="hover:underline"
                  >
                    {p.asset.title}
                  </Link>
                  <Badge variant="secondary">
                    {CATEGORY_LABELS[p.asset.category]}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <p>{p.asset.shortDesc}</p>
                    <p className="mt-1">
                      Paid {formatEther(BigInt(p.amountWei))} ETH · tx{" "}
                      {p.txHash.slice(0, 10)}…
                    </p>
                  </div>
                  <DownloadButton assetId={p.asset.id} />
                </div>
                <ReviewForm assetId={p.asset.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
