"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Category, PreviewMediaType } from "@prisma/client";
import { formatEther, BaseError, type Abi } from "viem";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS, isPlaygroundEligible } from "@/lib/categories";
import { createAsset, publishAsset } from "./actions";
import marketplaceAbi from "@/lib/contracts/marketplaceAbi.json";

const assetSchema = z.object({
  title: z.string().min(3).max(120),
  shortDesc: z.string().min(10).max(160),
  fullDesc: z.string().min(20).max(4000),
  category: z.nativeEnum(Category),
  priceEth: z.string().regex(/^\d+(\.\d+)?$/, "Enter a valid amount"),
  systemPrompt: z.string().optional(),
  playgroundInputs: z
    .array(z.object({ name: z.string().min(1), label: z.string().min(1) }))
    .optional(),
});

type AssetFormValues = z.infer<typeof assetSchema>;

const CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}` | undefined;

type Draft = { id: string; onChainId: number; priceWei: string; slug: string };

export function CreateAssetForm() {
  const [promptFile, setPromptFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const publishCalled = useRef(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: { playgroundInputs: [{ name: "", label: "" }] },
  });

  const category = watch("category");
  const playground = category ? isPlaygroundEligible(category) : false;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "playgroundInputs",
  });

  const { writeContractAsync } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (!receipt.isSuccess || !draft || publishCalled.current) return;
    publishCalled.current = true;
    publishAsset(draft.id)
      .then(() => setPublished(true))
      .catch((e) => setError(e instanceof Error ? e.message : "Publish failed"));
  }, [receipt.isSuccess, draft]);

  async function onSubmit(values: AssetFormValues) {
    setError(null);
    if (!promptFile) {
      setError("Prompt file is required");
      return;
    }
    if (!playground && !previewFile) {
      setError("Preview media is required for this category");
      return;
    }
    try {
      const fd = new FormData();
      fd.set("promptFile", promptFile);
      if (previewFile) fd.set("previewMedia", previewFile);
      const upRes = await fetch("/api/assets/upload", {
        method: "POST",
        body: fd,
      });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error ?? "Upload failed");

      const created = await createAsset({
        title: values.title,
        shortDesc: values.shortDesc,
        fullDesc: values.fullDesc,
        category: values.category,
        priceEth: values.priceEth,
        promptFilePath: up.promptFilePath,
        promptFileType: up.promptFileType,
        promptFileSizeBytes: up.promptFileSizeBytes,
        previewMediaPath: up.previewMediaPath,
        previewMediaType: up.previewMediaType,
        playgroundInputs: playground
          ? values.playgroundInputs?.filter((i) => i.name && i.label)
          : undefined,
        systemPrompt: playground ? values.systemPrompt : undefined,
      });
      setDraft(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create asset");
    }
  }

  async function onPublish() {
    if (!draft || !CONTRACT_ADDRESS) return;
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: marketplaceAbi as Abi,
        functionName: "listAsset",
        args: [BigInt(draft.onChainId), BigInt(draft.priceWei)],
      });
      setTxHash(hash);
    } catch (e) {
      setError(
        e instanceof BaseError
          ? e.shortMessage
          : e instanceof Error
            ? e.message
            : "Transaction failed"
      );
    }
  }

  if (published && draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Published</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Your asset is live at{" "}
            <a className="underline" href={`/marketplace/${draft.slug}`}>
              /marketplace/{draft.slug}
            </a>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Publish on-chain</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Draft saved. List it on the Marketplace contract (assetId{" "}
            {draft.onChainId}) for {formatEther(BigInt(draft.priceWei))} ETH to
            make it purchasable.
          </p>
          {!CONTRACT_ADDRESS && (
            <p className="text-sm text-destructive">
              NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS is not set - deploy the
              contract first.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={onPublish}
            disabled={!CONTRACT_ADDRESS || receipt.isLoading}
          >
            {receipt.isLoading ? "Waiting for confirmation..." : "Publish on-chain"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title")} />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="shortDesc">Short description</Label>
        <Input id="shortDesc" {...register("shortDesc")} />
        {errors.shortDesc && (
          <p className="text-sm text-destructive">{errors.shortDesc.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="fullDesc">Full description</Label>
        <Textarea id="fullDesc" rows={5} {...register("fullDesc")} />
        {errors.fullDesc && (
          <p className="text-sm text-destructive">{errors.fullDesc.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Category</Label>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.category && (
          <p className="text-sm text-destructive">{errors.category.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="priceEth">Price (ETH)</Label>
        <Input id="priceEth" placeholder="0.01" {...register("priceEth")} />
        {errors.priceEth && (
          <p className="text-sm text-destructive">{errors.priceEth.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="promptFile">Prompt file (.txt / .md / .json)</Label>
        <Input
          id="promptFile"
          type="file"
          accept=".txt,.md,.json"
          onChange={(e) => setPromptFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {category &&
        (playground ? (
          <>
            <div className="grid gap-2">
              <Label>Playground inputs</Label>
              {fields.map((field, i) => (
                <div key={field.id} className="flex gap-2">
                  <Input
                    placeholder="name"
                    {...register(`playgroundInputs.${i}.name`)}
                  />
                  <Input
                    placeholder="label"
                    {...register(`playgroundInputs.${i}.label`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => remove(i)}
                    disabled={fields.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ name: "", label: "" })}
              >
                Add input
              </Button>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="systemPrompt">System prompt</Label>
              <Textarea
                id="systemPrompt"
                rows={4}
                {...register("systemPrompt")}
              />
              <p className="text-sm text-muted-foreground">
                Refer to your inputs by name in plain language. No{" "}
                {"{{placeholder}}"} substitution is performed.
              </p>
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="previewMedia">
              Preview media (jpg/png/webp &lt;5MB, mp4/webm &lt;20MB)
            </Label>
            <Input
              id="previewMedia"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.mp4,.webm"
              onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ))}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Uploading..." : "Save draft"}
      </Button>
    </form>
  );
}
