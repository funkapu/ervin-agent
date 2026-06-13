import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { duration, relativeTime, summarizeOutput } from "@/lib/runs/format";
import { STATE_LABEL } from "@/lib/runs/states";
import type { RunStep } from "@/lib/runs/types";
import { cn } from "@/lib/utils";

function StatusIcon({ status }: { status: RunStep["status"] }) {
  if (status === "success") return <CheckCircle2 className="size-4 text-emerald-400" />;
  if (status === "failed") return <XCircle className="size-4 text-red-400" />;
  return <Loader2 className="size-4 animate-spin text-emerald-300" />;
}

export function StepTimeline({ steps }: { steps: RunStep[] }) {
  if (steps.length === 0) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-zinc-500">
        <CircleDashed className="size-4 animate-pulse" />
        Waiting for the first step…
      </div>
    );
  }

  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const chips = summarizeOutput(step.output);
        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="mt-0.5">
                <StatusIcon status={step.status} />
              </span>
              {!isLast && <div className="my-1 w-px flex-1 bg-zinc-800" />}
            </div>
            <div className={cn("min-w-0 flex-1 pb-5", isLast && "pb-0")}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-mono text-sm text-zinc-200">{STATE_LABEL[step.state]}</span>
                <span className="text-xs text-zinc-600">
                  {relativeTime(step.startedAt)} · {duration(step.startedAt, step.finishedAt)}
                </span>
              </div>
              {chips.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {chips.map((c, idx) => (
                    <span
                      key={idx}
                      className="max-w-full truncate rounded border border-zinc-800 bg-zinc-900/80 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {step.error && (
                <p className="mt-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 font-mono text-xs text-red-300">
                  {step.error}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
