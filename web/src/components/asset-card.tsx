import Link from "next/link";
import { formatEther } from "viem";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS } from "@/lib/categories";
import type { Category, PreviewMediaType } from "@prisma/client";

export type AssetCardData = {
  id: string;
  slug: string;
  title: string;
  shortDesc: string;
  category: Category;
  priceWei: string;
  previewMediaType: PreviewMediaType;
};

export function AssetCard({ asset }: { asset: AssetCardData }) {
  return (
    <Link href={`/marketplace/${asset.slug}`}>
      <Card className="h-full transition-colors hover:bg-muted/40">
        {asset.previewMediaType === "IMAGE" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/preview/${asset.id}`}
            alt={asset.title}
            className="aspect-video w-full object-cover"
          />
        )}
        {asset.previewMediaType === "VIDEO" && (
          <video
            src={`/api/preview/${asset.id}`}
            muted
            loop
            autoPlay
            playsInline
            className="aspect-video w-full object-cover"
          />
        )}
        <CardHeader>
          <CardTitle>{asset.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {asset.shortDesc}
          </p>
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{CATEGORY_LABELS[asset.category]}</Badge>
            <span className="text-sm font-medium">
              {formatEther(BigInt(asset.priceWei))} ETH
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
