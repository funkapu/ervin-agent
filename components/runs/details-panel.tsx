import { AlertTriangle, ExternalLink, FileCode2, GitCommitHorizontal, GitPullRequest, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { touchedFiles } from "@/lib/runs/diff";
import type { RunDetail } from "@/lib/runs/types";
import { cn } from "@/lib/utils";
import { ApproveButton } from "./approve-button";
import { DiffView } from "./diff-view";
import { FixFeedback } from "./fix-feedback";
import { RollbackButton } from "./rollback-button";

const SEVERITY_CLASS: Record<string, string> = {
  low: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  high: "border-orange-500/40 bg-orange-500/15 text-orange-300",
  critical: "border-red-500/40 bg-red-500/15 text-red-300",
};

const ROLLBACKABLE = new Set(["merged", "deployed", "closed"]);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h3 className="mb-3 font-mono text-xs tracking-wide text-zinc-500 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function ScopeChips({ run }: { run: RunDetail }) {
  const scopeCount = run.scopeFiles?.length ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1 font-mono text-xs text-zinc-300">
        <ShieldCheck className="size-3.5" />
        scope: {scopeCount} {scopeCount === 1 ? "file" : "files"}
      </span>
      {run.scopeViolation && (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1 font-mono text-xs text-amber-200">
          <AlertTriangle className="size-3.5" />
          out of scope: {run.violatingPaths?.join(", ") || "unknown paths"}
        </span>
      )}
    </div>
  );
}

export function DetailsPanel({ run, onApproved }: { run: RunDetail; onApproved?: () => void }) {
  const files = run.diff ? touchedFiles(run.diff) : [];

  return (
    <div className="flex flex-col gap-4">
      {run.state === "awaiting_approval" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          {run.scopeViolation && (
            <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Heads up: the fix touched files outside the allowed scope. Review the diff before approving.
            </p>
          )}
          <p className="mb-3 text-sm text-amber-200/90">
            Ervin opened a PR and CI is green. Approve to merge, deploy, and close — the only
            irreversible step in the loop.
          </p>
          <ApproveButton runId={run.id} onApproved={onApproved} />
        </div>
      )}

      {ROLLBACKABLE.has(run.state) && (
        <Section title="Rollback">
          <RollbackButton
            runId={run.id}
            revertPrUrl={run.revertPrUrl}
            rolledBackAt={run.rolledBackAt}
            onRolledBack={onApproved}
          />
        </Section>
      )}

      <Section title="Classification">
        {run.category || run.severity ? (
          <div className="flex flex-wrap gap-2">
            {run.category && (
              <Badge variant="outline" className="border-zinc-700 bg-zinc-800/60 font-mono text-zinc-200">
                {run.category}
              </Badge>
            )}
            {run.severity && (
              <Badge variant="outline" className={cn("font-mono", SEVERITY_CLASS[run.severity] ?? SEVERITY_CLASS.low)}>
                {run.severity}
              </Badge>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Not classified yet…</p>
        )}
      </Section>

      <Section title="Pull request">
        {run.prUrl ? (
          <div className="flex flex-col gap-2">
            <a
              href={run.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-sm text-emerald-300 hover:text-emerald-200 hover:underline"
            >
              <GitPullRequest className="size-4" />
              {run.prUrl.replace(/^https?:\/\//, "")}
              <ExternalLink className="size-3.5 opacity-60" />
            </a>
            {run.baseSha && (
              <span className="inline-flex w-fit items-center gap-1.5 font-mono text-xs text-zinc-500">
                <GitCommitHorizontal className="size-3.5" />
                base {run.baseSha.slice(0, 12)}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No PR opened yet…</p>
        )}
      </Section>

      <Section title="Scope">
        <ScopeChips run={run} />
      </Section>

      <Section title="Proposed diff">
        {run.diff ? (
          <div className="flex flex-col gap-3">
            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {files.map((f) => {
                  const outOfScope = run.violatingPaths?.includes(f);
                  return (
                    <span
                      key={f}
                      className={cn(
                        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px]",
                        outOfScope
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                          : "border-zinc-800 bg-zinc-900/80 text-zinc-400",
                      )}
                    >
                      <FileCode2 className="size-3" />
                      {f}
                    </span>
                  );
                })}
              </div>
            )}
            <DiffView diff={run.diff} />
            <div className="border-t border-zinc-800 pt-3">
              <p className="mb-2 font-mono text-xs tracking-wide text-zinc-500 uppercase">Rate this fix</p>
              <FixFeedback
                runId={run.id}
                rating={run.fixRating}
                feedback={run.fixFeedback}
                onSubmitted={onApproved}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No diff generated yet…</p>
        )}
      </Section>
    </div>
  );
}
