import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { CreateAssetForm } from "./create-asset-form";

export const dynamic = "force-dynamic";

export default async function CreateAssetPage() {
  const user = await getSessionUser();
  if (!user) redirect("/?needsWallet=1");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Create Asset</h1>
      <CreateAssetForm />
    </main>
  );
}
