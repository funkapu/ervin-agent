import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { embedText } from "@/lib/agent/steps/embed";
import { findSimilarRuns } from "@/lib/agent/similar";
import { db } from "@/lib/db";
import { runs, runSteps } from "@/lib/db/schema";
import { revertPullRequest } from "@/lib/integrations/github";
import { EVENTS, inngest } from "@/lib/inngest/client";
import { touchedFiles } from "@/lib/runs/diff";

const RUN_STATES = [
  "received",
  "classifying",
  "building_context",
  "fixing",
  "pr_open",
  "ci_running",
  "awaiting_approval",
  "merged",
  "deployed",
  "closed",
  "failed",
] as const;

const ROLLBACK_STATES = new Set(["merged", "deployed", "closed"]);

type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function ok(text: string, structuredContent?: Record<string, unknown>): ToolResult {
  return { content: [{ type: "text", text }], structuredContent };
}

function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

async function ownedRun(runId: string, accountId: string) {
  return db.query.runs.findFirst({ where: and(eq(runs.id, runId), eq(runs.accountId, accountId)) });
}

/**
 * Register every Ervin MCP tool, scoped to one account. All tools call existing
 * services / the DB in-process (no HTTP hop) and never see other accounts' runs.
 */
export function registerErvinTools(server: McpServer, accountId: string): void {
  // ── ervin_create_run ──────────────────────────────────────────────────────
  server.registerTool(
    "ervin_create_run",
    {
      description:
        "File a bug and start Ervin's autonomous fix loop (classify → context → fix → PR → CI → approval gate). Returns the new run id; poll ervin_get_run to watch progress.",
      inputSchema: {
        title: z.string().min(3).describe("Short bug title, e.g. 'Login button does nothing on mobile Safari'"),
        description: z.string().optional().describe("Optional details: repro steps, expected vs actual."),
        repo: z.string().optional().describe("Optional repo slug, e.g. 'acme/web'."),
      },
      outputSchema: {
        runId: z.string(),
        state: z.string(),
        title: z.string(),
      },
      annotations: { title: "Create run", readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ title, description, repo }) => {
      const context = [description, repo ? `Repo: ${repo}` : null].filter(Boolean).join("\n") || null;
      const [run] = await db.insert(runs).values({ accountId, title, context }).returning();
      await inngest.send({ name: EVENTS.runCreated, data: { runId: run.id } });
      return ok(`Created run ${run.id} — "${title}". The loop is running; poll ervin_get_run for state.`, {
        runId: run.id,
        state: run.state,
        title: run.title,
      });
    },
  );

  // ── ervin_list_runs ───────────────────────────────────────────────────────
  server.registerTool(
    "ervin_list_runs",
    {
      description: "List this account's runs, newest first. Cursor-paginated. Optionally filter by state.",
      inputSchema: {
        state: z.enum(RUN_STATES).optional().describe("Filter by pipeline state."),
        limit: z.number().int().min(1).max(50).optional().describe("Page size (1–50, default 20)."),
        cursor: z.string().optional().describe("Pass nextCursor from a previous call to get the next page."),
      },
      outputSchema: {
        runs: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            state: z.string(),
            category: z.string().nullable(),
            severity: z.string().nullable(),
            createdAt: z.string(),
          }),
        ),
        nextCursor: z.string().nullable(),
      },
      annotations: { title: "List runs", readOnlyHint: true, openWorldHint: false },
    },
    async ({ state, limit, cursor }) => {
      const pageSize = limit ?? 20;
      const conditions = [eq(runs.accountId, accountId)];
      if (state) conditions.push(eq(runs.state, state));
      if (cursor) {
        const cursorDate = new Date(cursor);
        if (!Number.isNaN(cursorDate.getTime())) conditions.push(lt(runs.createdAt, cursorDate));
      }

      const rows = await db
        .select()
        .from(runs)
        .where(and(...conditions))
        .orderBy(desc(runs.createdAt))
        .limit(pageSize + 1);

      const hasMore = rows.length > pageSize;
      const page = rows.slice(0, pageSize);
      const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

      const list = page.map((r) => ({
        id: r.id,
        title: r.title,
        state: r.state,
        category: r.category,
        severity: r.severity,
        createdAt: r.createdAt.toISOString(),
      }));

      return ok(
        `${list.length} run(s)${nextCursor ? " (more available — pass nextCursor)" : ""}.`,
        { runs: list, nextCursor },
      );
    },
  );

  // ── ervin_get_run ─────────────────────────────────────────────────────────
  server.registerTool(
    "ervin_get_run",
    {
      description: "Get a run's current state, classification, PR link, and its step log.",
      inputSchema: { runId: z.string().describe("The run id from ervin_create_run or ervin_list_runs.") },
      outputSchema: {
        id: z.string(),
        title: z.string(),
        state: z.string(),
        category: z.string().nullable(),
        severity: z.string().nullable(),
        prUrl: z.string().nullable(),
        scopeViolation: z.boolean(),
        rolledBack: z.boolean(),
        steps: z.array(z.object({ state: z.string(), status: z.string(), finishedAt: z.string().nullable() })),
      },
      annotations: { title: "Get run", readOnlyHint: true, openWorldHint: false },
    },
    async ({ runId }) => {
      const run = await ownedRun(runId, accountId);
      if (!run) return err(`Run not found. List your runs with ervin_list_runs to get a valid id.`);

      const steps = await db
        .select()
        .from(runSteps)
        .where(eq(runSteps.runId, runId))
        .orderBy(runSteps.startedAt);

      return ok(`Run ${run.id} is "${run.state}" — ${run.title}.`, {
        id: run.id,
        title: run.title,
        state: run.state,
        category: run.category,
        severity: run.severity,
        prUrl: run.prUrl,
        scopeViolation: run.scopeViolation,
        rolledBack: Boolean(run.rolledBackAt),
        steps: steps.map((s) => ({
          state: s.state,
          status: s.status,
          finishedAt: s.finishedAt ? s.finishedAt.toISOString() : null,
        })),
      });
    },
  );

  // ── ervin_get_run_diff ────────────────────────────────────────────────────
  server.registerTool(
    "ervin_get_run_diff",
    {
      description: "Get a run's proposed diff, the files it touches, and scope/violation info.",
      inputSchema: { runId: z.string().describe("The run id.") },
      outputSchema: {
        runId: z.string(),
        diff: z.string().nullable(),
        touchedFiles: z.array(z.string()),
        scopeFiles: z.array(z.string()),
        scopeViolation: z.boolean(),
        violatingPaths: z.array(z.string()),
      },
      annotations: { title: "Get run diff", readOnlyHint: true, openWorldHint: false },
    },
    async ({ runId }) => {
      const run = await ownedRun(runId, accountId);
      if (!run) return err(`Run not found. List your runs with ervin_list_runs to get a valid id.`);
      if (!run.diff) return err(`Run ${runId} has no diff yet (current state: ${run.state}). Poll ervin_get_run.`);

      const files = touchedFiles(run.diff);
      return ok(
        `Run ${runId} touches ${files.length} file(s)${run.scopeViolation ? " — ⚠ includes out-of-scope edits" : ""}.`,
        {
          runId,
          diff: run.diff,
          touchedFiles: files,
          scopeFiles: run.scopeFiles ?? [],
          scopeViolation: run.scopeViolation,
          violatingPaths: run.violatingPaths ?? [],
        },
      );
    },
  );

  // ── ervin_approve_run ─────────────────────────────────────────────────────
  server.registerTool(
    "ervin_approve_run",
    {
      description:
        "Approve a run waiting at the gate — resumes it to merge and deploy. This is the only path to merge. Irreversible (use ervin_rollback_run to undo afterwards).",
      inputSchema: { runId: z.string().describe("The run id, which must be in state 'awaiting_approval'.") },
      outputSchema: { runId: z.string(), approved: z.boolean() },
      annotations: { title: "Approve run", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ runId }) => {
      const run = await ownedRun(runId, accountId);
      if (!run) return err(`Run not found. List your runs with ervin_list_runs to get a valid id.`);
      if (run.state !== "awaiting_approval") {
        return err(`Run is not at the approval gate; current state: ${run.state}. Only 'awaiting_approval' runs can be approved.`);
      }
      await inngest.send({ name: EVENTS.runApproved, data: { runId } });
      return ok(`Approved run ${runId} — merging and deploying now. Poll ervin_get_run to watch it close.`, {
        runId,
        approved: true,
      });
    },
  );

  // ── ervin_reject_run ──────────────────────────────────────────────────────
  server.registerTool(
    "ervin_reject_run",
    {
      description:
        "Reject a run at the gate — leaves it paused without merging. The PR stays open for manual handling; nothing ships.",
      inputSchema: {
        runId: z.string().describe("The run id."),
        reason: z.string().optional().describe("Optional note on why it was rejected."),
      },
      outputSchema: { runId: z.string(), rejected: z.boolean(), state: z.string() },
      annotations: { title: "Reject run", readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ runId, reason }) => {
      const run = await ownedRun(runId, accountId);
      if (!run) return err(`Run not found. List your runs with ervin_list_runs to get a valid id.`);
      return ok(
        `Left run ${runId} paused at the gate — not merged.${reason ? ` Reason: ${reason}` : ""} The PR remains open for manual review.`,
        { runId, rejected: true, state: run.state },
      );
    },
  );

  // ── ervin_rollback_run ────────────────────────────────────────────────────
  server.registerTool(
    "ervin_rollback_run",
    {
      description: "Open a git revert PR for a merged/deployed/closed run. Never force-pushes — the revert goes through review.",
      inputSchema: { runId: z.string().describe("The run id of a shipped run.") },
      outputSchema: { runId: z.string(), revertPrUrl: z.string() },
      annotations: { title: "Roll back run", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ runId }) => {
      const run = await ownedRun(runId, accountId);
      if (!run) return err(`Run not found. List your runs with ervin_list_runs to get a valid id.`);
      if (!ROLLBACK_STATES.has(run.state)) {
        return err(`Run cannot be rolled back from state '${run.state}'. Only merged/deployed/closed runs can be reverted.`);
      }
      if (run.rolledBackAt) return err(`Run ${runId} was already rolled back: ${run.revertPrUrl ?? "(revert PR)"}.`);

      const { revertPrUrl } = await revertPullRequest({
        runId: run.id,
        prUrl: run.prUrl,
        baseSha: run.baseSha,
        paths: (run.fixEdits ?? []).map((f) => f.path),
      });
      await db.update(runs).set({ rolledBackAt: new Date(), revertPrUrl }).where(eq(runs.id, runId));
      return ok(`Opened a revert PR for run ${runId}: ${revertPrUrl}`, { runId, revertPrUrl });
    },
  );

  // ── ervin_find_similar_runs ───────────────────────────────────────────────
  server.registerTool(
    "ervin_find_similar_runs",
    {
      description: "Semantic search over this account's past shipped runs — find prior fixes similar to a description.",
      inputSchema: {
        query: z.string().min(3).describe("What to search for, e.g. 'checkout crashes on empty cart'."),
        limit: z.number().int().min(1).max(10).optional().describe("Max results (1–10, default 3)."),
      },
      outputSchema: {
        results: z.array(
          z.object({ id: z.string(), title: z.string(), identifier: z.string().nullable(), summary: z.string() }),
        ),
      },
      annotations: { title: "Find similar runs", readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, limit }) => {
      const embedding = await embedText(query);
      const results = await findSimilarRuns("", embedding, accountId, limit ?? 3);
      return ok(`Found ${results.length} similar prior run(s).`, { results });
    },
  );
}
