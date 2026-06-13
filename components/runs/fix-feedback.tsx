"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FixFeedback({
  runId,
  rating,
  feedback,
  onSubmitted,
}: {
  runId: string;
  rating: "good" | "bad" | null;
  feedback: string | null;
  onSubmitted?: () => void;
}) {
  const [note, setNote] = useState(feedback ?? "");
  const [pending, setPending] = useState<"good" | "bad" | null>(null);

  async function rate(value: "good" | "bad") {
    setPending(value);
    try {
      const res = await fetch(`/api/runs/${runId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: value, note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(value === "good" ? "Thanks — marked good" : "Thanks — marked for improvement");
      onSubmitted?.();
    } catch (e) {
      toast.error("Couldn't save feedback", { description: e instanceof Error ? e.message : "Try again." });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() => rate("good")}
          className={cn(rating === "good" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-300")}
        >
          <ThumbsUp />
          Good
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() => rate("bad")}
          className={cn(rating === "bad" && "border-red-500/40 bg-red-500/15 text-red-300")}
        >
          <ThumbsDown />
          Bad
        </Button>
        {rating && <span className="font-mono text-xs text-zinc-500">rated: {rating}</span>}
      </div>
      <Input
        placeholder="Optional note (what was good / wrong)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="h-8 text-xs"
      />
    </div>
  );
}
