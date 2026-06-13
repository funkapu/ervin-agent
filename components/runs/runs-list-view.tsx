"use client";

import { Inbox, Loader2 } from "lucide-react";
import Link from "next/link";
import { relativeTime } from "@/lib/runs/format";
import { isTerminal } from "@/lib/runs/states";
import { useRunsList } from "@/lib/runs/use-run";
import { cn } from "@/lib/utils";
import { NewRunDialog } from "./new-run-dialog";
import { StateBadge } from "./state-badge";

export function RunsListView() {
  const { data: runs } = useRunsList();

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-lg font-semibold tracking-tight text-zinc-100">ervin</h1>
          <p className="mt-1 text-sm text-zinc-500">Autonomous engineering-ops. Watch the loop work.</p>
        </div>
        <NewRunDialog />
      </header>

      {runs === null ? (
        <div className="flex items-center justify-center gap-2 py-24 text-zinc-500">
          <Loader2 className="size-4 animate-spin" />
          Loading runs…
        </div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 py-24 text-center">
          <Inbox className="size-7 text-zinc-600" />
          <p className="text-zinc-400">No runs yet.</p>
          <p className="max-w-xs text-sm text-zinc-600">
            File an issue and watch Ervin classify, fix, and ship it through the pipeline.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.map((run) => {
            const live = !isTerminal(run.state);
            return (
              <li key={run.id}>
                <Link
                  href={`/runs/${run.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      live ? "bg-emerald-400" : run.state === "failed" ? "bg-red-500/60" : "bg-zinc-700",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200 group-hover:text-zinc-50">{run.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-xs text-zinc-600">
                      {run.externalIssueId && <span>{run.externalIssueId}</span>}
                      {run.category && <span>{run.category}</span>}
                      {run.severity && <span>{run.severity}</span>}
                      <span>{relativeTime(run.createdAt)}</span>
                    </div>
                  </div>
                  <StateBadge state={run.state} className="shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
