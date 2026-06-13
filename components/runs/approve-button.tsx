"use client";

import { CheckCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ApproveButton({ runId, onApproved }: { runId: string; onApproved?: () => void }) {
  const [pending, setPending] = useState(false);

  async function approve() {
    setPending(true);
    try {
      const res = await fetch(`/api/runs/${runId}/approve`, { method: "POST" });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        toast.warning("Not approvable", { description: body.error ?? "This run is no longer awaiting approval." });
        onApproved?.();
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      toast.success("Approved — merging now", { description: "Ervin is shipping the fix." });
      onApproved?.();
    } catch (e) {
      toast.error("Approval failed", { description: e instanceof Error ? e.message : "Try again." });
      setPending(false);
    }
    // Leave pending=true on success: the next poll flips the state away from awaiting_approval.
  }

  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={approve}
      className="w-full border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
    >
      {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
      {pending ? "Approving…" : "Approve & merge"}
    </Button>
  );
}
