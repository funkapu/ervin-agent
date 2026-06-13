import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runEmbeddings, runs, runSteps } from "@/lib/db/schema";
import { buildContext } from "@/lib/agent/steps/build-context";
import { classifyIssue } from "@/lib/agent/steps/classify";
import { embedText } from "@/lib/agent/steps/embed";
import { generateFix } from "@/lib/agent/steps/generate-fix";
import { findSimilarRuns } from "@/lib/agent/similar";
import {
  commitChanges,
  fetchBaseState,
  getCiStatus,
  getRepoContext,
  mergePullRequest,
} from "@/lib/integrations/github";
import { applyEdits, toCommitFiles, toUnifiedDiff } from "@/lib/agent/apply-edits";
import { commentAndClose } from "@/lib/integrations/linear";
import { notifyApproval, notifyClosed, notifyTransition } from "@/lib/integrations/notify";
import { EVENTS, inngest, type RunCreatedData } from "@/lib/inngest/client";

type RunState = (typeof runs.$inferSelect)["state"];

/**
 * The durable pipeline. One run flows: received → classifying → building_context
 * → fixing → pr_open → ci_running → awaiting_approval ⏸ → merged → deployed →
 * closed. Each `step.run` is retried independently and memoized on success, so
 * the run survives restarts and resumes exactly where it left off.
 *
 * Visibility: every step sets `runs.state` first, then logs a `run_steps` row.
 * Approval-first: irreversible actions (merge, deploy) only happen after the
 * `run/approved` event arrives.
 */
export const runStateMachine = inngest.createFunction(
  {
    id: "run-state-machine",
    name: "Ervin Run State Machine",
    retries: 2,
    triggers: [{ event: EVENTS.runCreated }],
  },
  async ({ event, step }) => {
    const { runId } = event.data as RunCreatedData;

    // Tracks where we are so a terminal failure can be attributed to the right state.
    let currentState: RunState = "received";

    /**
     * Run one pipeline step durably: flip `runs.state`, do the work, log a
     * success `run_steps` row. Failures are caught once at the end (after
     * retries are exhausted) and logged as a single failed row.
     */
    async function stage<T>(
      id: string,
      state: RunState,
      work: () => Promise<{ result: T; summary: Record<string, unknown> }>,
    ): Promise<T> {
      currentState = state;
      const out = await step.run(id, async () => {
        await db.update(runs).set({ state }).where(eq(runs.id, runId));
        const { result, summary } = await work();
        await db.insert(runSteps).values({
          runId,
          state,
          status: "success",
          output: summary,
          finishedAt: new Date(),
        });
        return result;
      });
      // step.run serializes its output (Jsonify); our outputs are plain JSON data.
      return out as T;
    }

    try {
      const run = await step.run("load-run", async () => {
        const found = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
        if (!found) throw new Error(`Run ${runId} not found`);
        return found;
      });

      // received → classifying
      const classification = await stage("classify", "classifying", async () => {
        const result = await classifyIssue({
          title: run.title,
          externalIssueId: run.externalIssueId,
          body: run.context,
        });
        await db
          .update(runs)
          .set({ category: result.category, severity: result.severity })
          .where(eq(runs.id, runId));
        return { result, summary: { category: result.category, severity: result.severity, summary: result.summary } };
      });

      // classifying → building_context
      const context = await stage("build-context", "building_context", async () => {
        const repo = await getRepoContext();

        // Pin the base commit and fetch the candidate files' CURRENT content, so
        // the fix's oldText snippets are verbatim and we commit onto this exact state.
        const base = await fetchBaseState(repo.files, runId);

        // Embed this run and store it; retrieve similar prior shipped runs (pgvector).
        const embedding = await embedText(`${run.title}\n${run.context ?? ""}`);
        await db.insert(runEmbeddings).values({ runId, embedding }).onConflictDoNothing();
        const similarRuns = await findSimilarRuns(runId, embedding, run.accountId, 3);

        const blob = buildContext({
          title: run.title,
          externalIssueId: run.externalIssueId,
          body: run.context,
          classification,
          repo,
          similarRuns,
        });
        // The relevant files become the scope allowlist for the fix.
        const scopeFiles = repo.files;
        await db.update(runs).set({ context: blob, scopeFiles, baseSha: base.baseSha }).where(eq(runs.id, runId));
        return {
          result: { blob, scopeFiles, files: base.files, baseSha: base.baseSha },
          summary: {
            files: repo.files.length,
            commits: repo.recentCommits.length,
            similar: similarRuns.length,
            baseSha: base.baseSha,
          },
        };
      });

      await step.run("notify-context", () => notifyTransition(run, "building_context"));

      // building_context → fixing  (generate edits, then APPLY them to the pinned
      // content — an unappliable edit fails here, before any PR is opened)
      const fix = await stage("generate-fix", "fixing", async () => {
        const result = await generateFix({
          title: run.title,
          context: context.blob,
          scopeFiles: context.scopeFiles,
          files: context.files,
        });
        // Exact-match apply against the same content the model saw. Throws (→ fail
        // the run, no PR) if any oldText is missing or ambiguous.
        const applied = applyEdits(context.files, result.files);
        const diff = toUnifiedDiff(applied);
        const changed = toCommitFiles(applied);

        await db
          .update(runs)
          .set({
            fixEdits: result.files,
            diff,
            scopeViolation: result.scopeViolation,
            violatingPaths: result.violatingPaths,
          })
          .where(eq(runs.id, runId));
        return {
          result: { prTitle: result.prTitle, prBody: result.prBody, changed },
          summary: {
            prTitle: result.prTitle,
            touchedFiles: result.touchedFiles.length,
            edits: result.files.reduce((n, f) => n + f.edits.length, 0),
            scopeViolation: result.scopeViolation,
          },
        };
      });

      // fixing → pr_open  (commit the applied files as a real PR)
      const pr = await stage("open-pr", "pr_open", async () => {
        const result = await commitChanges({
          runId,
          baseSha: context.baseSha,
          prTitle: fix.prTitle,
          prBody: fix.prBody,
          files: fix.changed,
        });
        await db.update(runs).set({ prUrl: result.prUrl, baseSha: result.baseSha }).where(eq(runs.id, runId));
        return {
          result,
          summary: { prUrl: result.prUrl, prNumber: result.prNumber, branch: result.branch, baseSha: result.baseSha },
        };
      });

      await step.run("notify-pr", () => notifyTransition(run, "pr_open", { prUrl: pr.prUrl }));

      // pr_open → ci_running (mock: CI passes after a short pause)
      await step.sleep("ci-settle", "5s");
      await stage("ci", "ci_running", async () => {
        const status = await getCiStatus(pr.prNumber);
        await db.update(runs).set({ ciStatus: status }).where(eq(runs.id, runId));
        if (status === "failure") throw new Error("CI failed");
        return { result: status, summary: { ciStatus: status } };
      });

      // ci_running → awaiting_approval (pause for the human)
      await stage("await-approval-gate", "awaiting_approval", async () => {
        return { result: null, summary: { prUrl: pr.prUrl, waiting: true } };
      });

      // Ask for approval in the Slack thread (interactive buttons), if chat-started.
      await step.run("notify-approval", () => notifyApproval(run, pr.prUrl));

      const approval = await step.waitForEvent("wait-for-approval", {
        event: EVENTS.runApproved,
        match: "data.runId",
        timeout: "7d",
      });

      if (!approval) {
        throw new Error("Approval timed out after 7d");
      }

      // approved → merged
      await stage("merge", "merged", async () => {
        const result = await mergePullRequest(pr.prNumber);
        if (!result.merged) throw new Error("Merge failed");
        await db.update(runs).set({ mergeSha: result.sha }).where(eq(runs.id, runId));
        return { result, summary: { mergeSha: result.sha } };
      });

      // merged → deployed (mock deploy)
      await stage("deploy", "deployed", async () => {
        return { result: { deployed: true }, summary: { deployed: true, target: "production" } };
      });

      // deployed → closed (comment back + close on Linear)
      await stage("close", "closed", async () => {
        const result = await commentAndClose(
          run.externalIssueId,
          `✅ Ervin shipped a fix. PR ${pr.prUrl} was merged and deployed.`,
        );
        return { result, summary: { commented: result.commented, closed: result.closed } };
      });

      await step.run("notify-closed", () => notifyClosed(run, pr.prUrl));

      return { runId, finalState: "closed" as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Record the failure once, after retries are exhausted, and surface it on the run.
      await step.run("record-failure", async () => {
        await db.insert(runSteps).values({
          runId,
          state: currentState,
          status: "failed",
          error: message,
          finishedAt: new Date(),
        });
        await db.update(runs).set({ state: "failed" }).where(eq(runs.id, runId));
      });
      throw err;
    }
  },
);
