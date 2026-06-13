import { Badge } from "@/components/ui/badge";
import { STATE_LABEL, stateBadgeClass } from "@/lib/runs/states";
import type { RunState } from "@/lib/runs/types";
import { cn } from "@/lib/utils";

export function StateBadge({ state, className }: { state: RunState; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-mono tracking-tight", stateBadgeClass(state), className)}>
      {STATE_LABEL[state]}
    </Badge>
  );
}
