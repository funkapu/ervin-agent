"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function NewRunDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [externalIssueId, setExternalIssueId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          externalIssueId: externalIssueId.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const run = (await res.json()) as { id: string };
      toast.success("Run created", { description: "Ervin is on it." });
      setOpen(false);
      setTitle("");
      setExternalIssueId("");
      router.push(`/runs/${run.id}`);
    } catch (err) {
      toast.error("Couldn't create run", { description: err instanceof Error ? err.message : "Try again." });
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25">
          <Plus />
          New run
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>File an issue</DialogTitle>
          <DialogDescription>Ervin will classify it, build context, and propose a fix.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="title" className="text-xs font-medium text-muted-foreground">
              Title
            </label>
            <Input
              id="title"
              autoFocus
              placeholder="Crash when uploading avatar larger than 5MB"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="issue" className="text-xs font-medium text-muted-foreground">
              External issue id <span className="text-zinc-600">(optional)</span>
            </label>
            <Input
              id="issue"
              placeholder="ISSUE-123"
              value={externalIssueId}
              onChange={(e) => setExternalIssueId(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-2">
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Create run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
