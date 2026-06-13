"use client";

import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { relativeTime } from "@/lib/runs/format";
import { isTerminal } from "@/lib/runs/states";
import { useRunDetail } from "@/lib/runs/use-run";
import { DetailsPanel } from "./details-panel";
import { PipelineTracker } from "./pipeline-tracker";
import { StateBadge } from "./state-badge";
import { StepTimeline } from "./step-timeline";

export function RunDetailView({ id }: { id: string }) {
  const { data: run, error, loading, refresh } = useRunDetail(id);

  if (loading && !run) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 py-32 text-zinc-500">
        <Loader2 className="size-4 animate-spin" />
        Loading run…
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-32 text-zinc-400">
        <AlertTriangle className="size-6 text-red-400" />
        <p>{error ?? "Run not found."}</p>
        <Link href="/dashboard" className="text-sm text-emerald-300 hover:underline">
          ← Back to runs
        </Link>
      </div>
    );
  }

  const live = !isTerminal(run.state);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="size-3.5" />
          All runs
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">{run.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-zinc-500">
              {run.externalIssueId && <span>{run.externalIssueId}</span>}
              <span>created {relativeTime(run.createdAt)}</span>
              <span className="text-zinc-700">{run.id.slice(0, 8)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {live && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                Live
              </span>
            )}
            <StateBadge state={run.state} />
          </div>
        </div>
      </div>

      {/* Pipeline tracker (hero) */}
      <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <PipelineTracker run={run} />
      </div>

      {/* Timeline + details */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="mb-4 font-mono text-xs tracking-wide text-zinc-500 uppercase">Step timeline</h2>
          <StepTimeline steps={run.steps} />
        </div>
        <DetailsPanel run={run} onApproved={refresh} />
      </div>
    </div>
  );
}
