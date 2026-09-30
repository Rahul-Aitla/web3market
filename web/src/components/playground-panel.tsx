"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type PlaygroundInput = { name: string; label: string };

export function PlaygroundPanel({
  assetId,
  inputs,
}: {
  assetId: string;
  inputs: PlaygroundInput[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRun() {
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const res = await fetch(`/api/assets/${assetId}/playground`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Playground failed");
      setOutput(data.output);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Playground failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Live Playground</h2>
      {inputs.map((input) => (
        <div key={input.name} className="grid gap-2">
          <Label htmlFor={`pg-${input.name}`}>{input.label}</Label>
          <Input
            id={`pg-${input.name}`}
            value={values[input.name] ?? ""}
            onChange={(e) =>
              setValues((v) => ({ ...v, [input.name]: e.target.value }))
            }
          />
        </div>
      ))}
      <Button onClick={onRun} disabled={loading} className="w-fit">
        {loading ? "Running..." : "Run"}
      </Button>
      {loading && <Skeleton className="h-24 w-full" />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {output !== null && (
        <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm">
          {output}
        </pre>
      )}
    </div>
  );
}
