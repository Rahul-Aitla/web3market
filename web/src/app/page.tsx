import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ needsWallet?: string }>;
}) {
  const { needsWallet } = await searchParams;

  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-8 py-24 text-center">
      {needsWallet && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Connect your wallet and sign in to continue.
        </p>
      )}
      <div>
        <h1 className="mb-4 text-4xl font-bold">AI Prompt Marketplace</h1>
        <p className="text-lg text-muted-foreground">
          Buy and sell AI prompts with crypto payments on Ethereum Sepolia.
          Try prompts in a live playground before you buy.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/marketplace">
          <Button size="lg">Browse marketplace</Button>
        </Link>
        <Link href="/create-asset">
          <Button size="lg" variant="outline">
            Sell a prompt
          </Button>
        </Link>
      </div>
    </main>
  );
}
