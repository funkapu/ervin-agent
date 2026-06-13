import { Check, Clock, Loader2, X } from "lucide-react";
import { Fragment } from "react";
import { PIPELINE_STATES, STATE_LABEL, type NodeStatus, nodeStatus } from "@/lib/runs/states";
import type { RunState, RunStep } from "@/lib/runs/types";
import { cn } from "@/lib/utils";

type NodeViz = { ring: string; icon: React.ReactNode };

function viz(status: NodeStatus, state: RunState): NodeViz {
  switch (status) {
    case "done":
      return {
        ring: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
        icon: <Check className="size-4" strokeWidth={3} />,
      };
    case "current":
      if (state === "awaiting_approval") {
        return {
          ring: "border-amber-400/70 bg-amber-500/15 text-amber-300 ring-4 ring-amber-500/15 animate-pulse",
          icon: <Clock className="size-4" />,
        };
      }
      return {
        ring: "border-emerald-400/70 bg-emerald-500/10 text-emerald-300 ring-4 ring-emerald-500/15",
        icon: <Loader2 className="size-4 animate-spin" />,
      };
    case "failed":
      return {
        ring: "border-red-500/70 bg-red-500/15 text-red-400",
        icon: <X className="size-4" strokeWidth={3} />,
      };
    default:
      return {
        ring: "border-zinc-700/80 bg-zinc-900 text-zinc-600",
        icon: <span className="size-1.5 rounded-full bg-zinc-600" />,
      };
  }
}

function segmentClass(prevStatus: NodeStatus): string {
  return prevStatus === "done" || prevStatus === "current"
    ? "bg-emerald-500/40"
    : prevStatus === "failed"
      ? "bg-red-500/40"
      : "bg-zinc-800";
}

function Node({ status, state }: { status: NodeStatus; state: RunState }) {
  const v = viz(status, state);
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border transition-all duration-500",
        v.ring,
      )}
    >
      {v.icon}
    </span>
  );
}

/**
 * The hero: the 10 pipeline states as an ordered tracker. Horizontal on
 * desktop, vertical on mobile. Completed = ✓, in-progress = spinner,
 * awaiting_approval = clock, failed = red ✗, not-yet-reached = dim.
 */
export function PipelineTracker({ run }: { run: { state: RunState; steps: RunStep[] } }) {
  const current = run.state;
  const failedAtState = run.steps.find((s) => s.status === "failed")?.state ?? null;
  const statusOf = (s: RunState) => nodeStatus(s, current, failedAtState);

  return (
    <div className="w-full">
      {/* Desktop: horizontal */}
      <div className="hidden items-start pb-10 md:flex">
        {PIPELINE_STATES.map((state, i) => {
          const status = statusOf(state);
          const isLast = i === PIPELINE_STATES.length - 1;
          return (
            <Fragment key={state}>
              <div className="relative flex flex-col items-center">
                <Node status={status} state={state} />
                <span
                  className={cn(
                    "absolute top-11 w-24 text-center text-[11px] leading-tight font-mono",
                    status === "current"
                      ? state === "awaiting_approval"
                        ? "text-amber-300"
                        : "text-emerald-300"
                      : status === "done"
                        ? "text-zinc-400"
                        : status === "failed"
                          ? "text-red-400"
                          : "text-zinc-600",
                  )}
                >
                  {STATE_LABEL[state]}
                </span>
              </div>
              {!isLast && (
                <div className={cn("mx-1 mt-4 h-px flex-1 transition-colors duration-500", segmentClass(status))} />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Mobile: vertical */}
      <ol className="flex flex-col md:hidden">
        {PIPELINE_STATES.map((state, i) => {
          const status = statusOf(state);
          const isLast = i === PIPELINE_STATES.length - 1;
          return (
            <li key={state} className="flex gap-3">
              <div className="flex flex-col items-center">
                <Node status={status} state={state} />
                {!isLast && <div className={cn("my-1 w-px flex-1", segmentClass(status))} />}
              </div>
              <div className={cn("pb-6", isLast && "pb-0")}>
                <span
                  className={cn(
                    "font-mono text-sm",
                    status === "current"
                      ? state === "awaiting_approval"
                        ? "text-amber-300"
                        : "text-emerald-300"
                      : status === "done"
                        ? "text-zinc-300"
                        : status === "failed"
                          ? "text-red-400"
                          : "text-zinc-600",
                  )}
                >
                  {STATE_LABEL[state]}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
