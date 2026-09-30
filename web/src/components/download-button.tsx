"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DownloadButton({ assetId }: { assetId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onDownload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchases/${assetId}/download`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Download failed");
      window.location.href = data.downloadUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={onDownload} disabled={loading}>
        {loading ? "Preparing..." : "Download"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
