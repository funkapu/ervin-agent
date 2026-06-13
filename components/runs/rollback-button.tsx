"use client";

import { ExternalLink, Loader2, Undo2 } from "lucide-react";
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

export function RollbackButton({
  runId,
  revertPrUrl,
  rolledBackAt,
  onRolledBack,
}: {
  runId: string;
  revertPrUrl: string | null;
  rolledBackAt: string | null;
  onRolledBack?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  if (rolledBackAt && revertPrUrl) {
    return (
      <div className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1 font-mono text-xs text-zinc-300">
          <Undo2 className="size-3.5" />
          Rolled back
        </span>
        <a
          href={revertPrUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-sm text-emerald-300 hover:text-emerald-200 hover:underline"
        >
          {revertPrUrl.replace(/^https?:\/\//, "")}
          <ExternalLink className="size-3.5 opacity-60" />
        </a>
      </div>
    );
  }

  async function rollback() {
    setPending(true);
    try {
      const res = await fetch(`/api/runs/${runId}/rollback`, { method: "POST" });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        toast.warning("Can't roll back", { description: body.error ?? "This run isn't rollback-able." });
        setOpen(false);
        onRolledBack?.();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      toast.success("Rollback PR opened", { description: "A git revert PR is up for review." });
      setOpen(false);
      onRolledBack?.();
      if (body.revertPrUrl) window.open(body.revertPrUrl, "_blank", "noopener");
    } catch (e) {
      toast.error("Rollback failed", { description: e instanceof Error ? e.message : "Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Undo2 />
          Roll back this fix
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roll back the fix?</DialogTitle>
          <DialogDescription>
            This opens a git <span className="font-mono">revert</span> PR — it never force-pushes or
            rewrites history. The revert still goes through review before merging.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={rollback} disabled={pending} className="bg-amber-500/15 text-amber-200 hover:bg-amber-500/25">
            {pending ? <Loader2 className="animate-spin" /> : <Undo2 />}
            Open revert PR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
