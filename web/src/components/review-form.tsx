"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addReview } from "@/app/purchases/actions";

export function ReviewForm({ assetId }: { assetId: string }) {
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setMessage(null);
    try {
      await addReview({
        assetId,
        rating: Number(rating),
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
      setMessage("Review submitted");
      setIsError(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to submit review");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return <p className="text-sm text-muted-foreground">{message}</p>;
  }

  return (
    <div className="flex items-end gap-2">
      <Select value={rating} onValueChange={(v) => setRating(v as string)}>
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[5, 4, 3, 2, 1].map((r) => (
            <SelectItem key={r} value={String(r)}>
              {r}★
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="max-w-xs"
        rows={1}
      />
      <Button variant="outline" onClick={onSubmit} disabled={loading}>
        {loading ? "..." : "Review"}
      </Button>
      {message && (
        <p className={`text-sm ${isError ? "text-destructive" : ""}`}>
          {message}
        </p>
      )}
    </div>
  );
}
