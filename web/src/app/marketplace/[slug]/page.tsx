import { notFound } from "next/navigation";
import { formatEther } from "viem";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { CATEGORY_LABELS, isPlaygroundEligible } from "@/lib/categories";
import { Badge } from "@/components/ui/badge";
import { PlaygroundPanel } from "@/components/playground-panel";
import { BuyButton } from "@/components/buy-button";

export const dynamic = "force-dynamic";

type PlaygroundConfig = {
  inputs?: { name: string; label: string }[];
  systemPrompt?: string;
};

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getSessionUser();

  const asset = await prisma.asset.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDesc: true,
      fullDesc: true,
      category: true,
      priceWei: true,
      status: true,
      sellerId: true,
      onChainId: true,
      previewMediaType: true,
      previewMediaPath: true,
      playgroundConfig: true,
      reviews: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { walletAddress: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!asset) notFound();
  if (asset.status !== "PUBLISHED" && asset.sellerId !== user?.userId) {
    notFound();
  }

  const playground = isPlaygroundEligible(asset.category);
  const config = (asset.playgroundConfig ?? {}) as PlaygroundConfig;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{asset.title}</h1>
        <Badge variant="secondary">{CATEGORY_LABELS[asset.category]}</Badge>
      </div>
      <p className="mb-1 text-sm text-muted-foreground">{asset.shortDesc}</p>
      <p className="mb-6 text-sm font-medium">
        {formatEther(BigInt(asset.priceWei))} ETH
      </p>

      {playground ? (
        <div className="mb-8 rounded-xl border p-6">
          <PlaygroundPanel assetId={asset.id} inputs={config.inputs ?? []} />
        </div>
      ) : (
        asset.previewMediaType !== "NONE" && (
          <div className="mb-8 overflow-hidden rounded-xl border">
            {asset.previewMediaType === "IMAGE" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/preview/${asset.id}`}
                alt={asset.title}
                className="w-full object-contain"
              />
            ) : (
              <video
                src={`/api/preview/${asset.id}`}
                controls
                className="w-full"
              />
            )}
          </div>
        )
      )}

      <p className="mb-8 whitespace-pre-wrap text-sm">{asset.fullDesc}</p>

      <div className="mb-8">
        <BuyButton
          assetId={asset.id}
          onChainId={asset.onChainId}
          priceWei={asset.priceWei}
        />
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">
          Reviews ({asset.reviews.length})
        </h2>
        {asset.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {asset.reviews.map((r) => (
              <li key={r.id} className="rounded-lg border p-4">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  <span className="text-muted-foreground">
                    {r.user.walletAddress.slice(0, 6)}…
                    {r.user.walletAddress.slice(-4)}
                  </span>
                </div>
                {r.comment && <p className="text-sm">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
