import { Octokit } from "@octokit/rest";

/**
 * GitHub integration for Ervin.
 *
 * Every function has a real (Octokit) path and a MOCK path. Mock is used when
 * `ERVIN_MOCK=1` OR when `GITHUB_TOKEN` is absent, so the full pipeline runs
 * end-to-end in demos/tests without touching a live repo.
 *
 * Real mode expects: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO (GITHUB_BASE_BRANCH optional).
 */

export type RepoContext = {
  conventions: string;
  files: string[];
  recentCommits: { sha: string; message: string }[];
};

export type FileContent = { path: string; content: string };

export type CommitChangesInput = {
  runId: string;
  /** The base commit the fix is committed onto (pinned at build-context time). */
  baseSha: string;
  prTitle: string;
  prBody: string;
  /** The full new content of each changed file (already applied). */
  files: FileContent[];
};

export type PullRequest = {
  prUrl: string;
  prNumber: number;
  branch: string;
  baseSha: string;
  /** The commit sha the fix was committed as. */
  headSha: string;
};

export type CiStatus = "success" | "failure" | "pending";

/** The base commit a fix is pinned to, plus the current content of the candidate files. */
export type BaseState = { baseSha: string; files: FileContent[] };

/**
 * Mock repo fixtures — the "current source" the model edits and we apply against
 * in mock mode. Real-looking so the LLM can quote verbatim `oldText` snippets.
 */
const MOCK_FILES: Record<string, string> = {
  "app/api/runs/route.ts": `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";

export async function POST(req: Request) {
  const body = await req.json();
  const title = body.title.trim();
  const [run] = await db.insert(runs).values({ title }).returning();
  return NextResponse.json(run, { status: 201 });
}
`,
  "lib/db/schema.ts": `import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
});
`,
  "lib/ai.ts": `import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
export const primaryModel = openrouter.chat("deepseek/deepseek-v3.2-exp");
`,
  "lib/agent/steps/classify.ts": `export function classify(title: string) {
  return { category: "bug", severity: "medium", title };
}
`,
};

export type RevertInput = {
  runId: string;
  prUrl: string | null;
  /** The base commit the fix was applied onto — its file content is the "old version" to restore. */
  baseSha: string | null;
  /** The paths the fix changed (restored to their baseSha content by the revert). */
  paths: string[];
};

export type RevertResult = { revertPrUrl: string };

export function isGithubMock(): boolean {
  return process.env.ERVIN_MOCK === "1" || !process.env.GITHUB_TOKEN;
}

function client(): Octokit {
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

function repoConfig() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!owner || !repo) {
    throw new Error("GITHUB_OWNER and GITHUB_REPO must be set when not in mock mode");
  }
  return { owner, repo, baseBranch: process.env.GITHUB_BASE_BRANCH ?? "main" };
}

/**
 * Gather repo conventions, a file listing, and recent commits to seed the
 * Smart Context Builder.
 */
export async function getRepoContext(): Promise<RepoContext> {
  if (isGithubMock()) {
    return {
      conventions:
        "TypeScript strict, double quotes, named exports, `@/` import alias, Tailwind v4, Drizzle ORM.",
      files: [
        "app/api/runs/route.ts",
        "lib/db/schema.ts",
        "lib/ai.ts",
        "lib/agent/steps/classify.ts",
      ],
      recentCommits: [
        { sha: "mock1a2", message: "feat: add run state machine" },
        { sha: "mock3b4", message: "fix: handle null externalIssueId" },
      ],
    };
  }

  const octokit = client();
  const { owner, repo, baseBranch } = repoConfig();

  const [tree, commits, conventions] = await Promise.all([
    octokit.git
      .getTree({ owner, repo, tree_sha: baseBranch, recursive: "1" })
      .then((r) => r.data.tree.map((t) => t.path ?? "").filter(Boolean).slice(0, 200))
      .catch(() => [] as string[]),
    octokit.repos
      .listCommits({ owner, repo, per_page: 10 })
      .then((r) => r.data.map((c) => ({ sha: c.sha.slice(0, 7), message: c.commit.message.split("\n")[0] })))
      .catch(() => [] as { sha: string; message: string }[]),
    fetchConventions(octokit, owner, repo),
  ]);

  return { conventions, files: tree, recentCommits: commits };
}

async function fetchConventions(octokit: Octokit, owner: string, repo: string): Promise<string> {
  for (const path of ["AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md", "README.md"]) {
    try {
      const res = await octokit.repos.getContent({ owner, repo, path });
      if (!Array.isArray(res.data) && "content" in res.data && res.data.content) {
        return Buffer.from(res.data.content, "base64").toString("utf8").slice(0, 4000);
      }
    } catch {
      // try next
    }
  }
  return "No conventions file found in repo.";
}

/**
 * Fetch the current content of specific files at a given ref. Missing files
 * come back with empty content (treated as "new file" by the apply step).
 */
export async function getFileContents(paths: string[], ref: string): Promise<FileContent[]> {
  if (isGithubMock()) {
    return paths.map((path) => ({ path, content: MOCK_FILES[path] ?? "" }));
  }

  const octokit = client();
  const { owner, repo } = repoConfig();

  return Promise.all(
    paths.map(async (path) => {
      try {
        const res = await octokit.repos.getContent({ owner, repo, path, ref });
        if (!Array.isArray(res.data) && "content" in res.data && typeof res.data.content === "string") {
          return { path, content: Buffer.from(res.data.content, "base64").toString("utf8") };
        }
      } catch {
        // missing file → new file
      }
      return { path, content: "" };
    }),
  );
}

/**
 * Resolve the base commit (the "old version") and the current content of the
 * candidate files, pinned to that commit. The fix is generated against, and
 * later committed onto, exactly this state — so `oldText` snippets stay valid.
 */
export async function fetchBaseState(paths: string[], runId: string): Promise<BaseState> {
  if (isGithubMock()) {
    return { baseSha: `mockbase${runId.slice(0, 8)}`, files: await getFileContents(paths, "mock") };
  }

  const octokit = client();
  const { owner, repo, baseBranch } = repoConfig();
  const base = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
  const baseSha = base.data.object.sha;
  const files = await getFileContents(paths, baseSha);
  return { baseSha, files };
}

/**
 * Commit the applied fix to a new branch and open a PR — a REAL change to the
 * source files (createBlob → createTree → createCommit → createRef → pulls.create),
 * not a `.patch` file. The files passed in are the full post-fix contents.
 */
export async function commitChanges(input: CommitChangesInput): Promise<PullRequest> {
  const branch = `ervin/${input.runId.slice(0, 8)}`;

  if (isGithubMock()) {
    return {
      prUrl: `https://github.com/ervin/mock-repo/pull/${mockPrNumber(input.runId)}`,
      prNumber: mockPrNumber(input.runId),
      branch,
      baseSha: input.baseSha,
      headSha: `mockhead${input.runId.slice(0, 8)}`,
    };
  }

  const octokit = client();
  const cfg = repoConfig();
  const result = await commitFilesAndOpenPr(octokit, cfg, {
    branch,
    parentSha: input.baseSha,
    title: input.prTitle,
    body: input.prBody,
    files: input.files,
  });
  return { ...result, baseSha: input.baseSha };
}

/**
 * Shared git-data plumbing: blob each file, build a tree on top of the parent
 * commit's tree, create a commit, branch, and open a PR. Used for both fixes and
 * reverts (a revert just commits the old file contents).
 */
async function commitFilesAndOpenPr(
  octokit: Octokit,
  cfg: { owner: string; repo: string; baseBranch: string },
  opts: { branch: string; parentSha: string; title: string; body: string; files: FileContent[] },
): Promise<{ prUrl: string; prNumber: number; branch: string; headSha: string }> {
  const { owner, repo, baseBranch } = cfg;

  const parent = await octokit.git.getCommit({ owner, repo, commit_sha: opts.parentSha });
  const blobs = await Promise.all(
    opts.files.map(async (f) => {
      const blob = await octokit.git.createBlob({ owner, repo, content: f.content, encoding: "utf-8" });
      return { path: f.path, sha: blob.data.sha };
    }),
  );
  const tree = await octokit.git.createTree({
    owner,
    repo,
    base_tree: parent.data.tree.sha,
    tree: blobs.map((b) => ({ path: b.path, mode: "100644" as const, type: "blob" as const, sha: b.sha })),
  });
  const commit = await octokit.git.createCommit({
    owner,
    repo,
    message: opts.title,
    tree: tree.data.sha,
    parents: [opts.parentSha],
  });
  await octokit.git.createRef({ owner, repo, ref: `refs/heads/${opts.branch}`, sha: commit.data.sha });
  const pr = await octokit.pulls.create({ owner, repo, title: opts.title, head: opts.branch, base: baseBranch, body: opts.body });

  return { prUrl: pr.data.html_url, prNumber: pr.data.number, branch: opts.branch, headSha: commit.data.sha };
}

/**
 * Roll back a shipped fix by opening a **revert PR** — never a force-push or
 * history rewrite. The revert restores each changed file to its pre-fix
 * (`baseSha`) content and commits that onto a new branch off the current base
 * tip, so merging the revert PR genuinely undoes the fix.
 */
export async function revertPullRequest(input: RevertInput): Promise<RevertResult> {
  if (isGithubMock()) {
    return { revertPrUrl: `https://github.com/ervin/mock-repo/pull/${mockPrNumber(input.runId) + 1}` };
  }

  if (!input.baseSha || input.paths.length === 0) {
    throw new Error("Cannot revert: missing baseSha or changed paths for this run.");
  }

  const octokit = client();
  const cfg = repoConfig();
  const prNumber = parsePrNumber(input.prUrl);

  // Old (pre-fix) content of the changed files = the state to restore.
  const oldFiles = await getFileContents(input.paths, input.baseSha);
  const baseTip = await octokit.git.getRef({ owner: cfg.owner, repo: cfg.repo, ref: `heads/${cfg.baseBranch}` });

  const result = await commitFilesAndOpenPr(octokit, cfg, {
    branch: `ervin/revert-${input.runId.slice(0, 8)}`,
    parentSha: baseTip.data.object.sha,
    title: `Revert: ${prNumber ? `PR #${prNumber}` : `Ervin run ${input.runId.slice(0, 8)}`}`,
    body: `Automated rollback by Ervin — restores ${input.paths.length} file(s) to their pre-fix state from \`${input.baseSha.slice(0, 12)}\`. Original PR: ${input.prUrl ?? "(n/a)"}.`,
    files: oldFiles,
  });

  return { revertPrUrl: result.prUrl };
}

/** Extract the PR number from a GitHub PR URL (…/pull/123). */
function parsePrNumber(prUrl: string | null): number | null {
  if (!prUrl) return null;
  const m = prUrl.match(/\/pull\/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Report CI status for a PR. Mock always reports success. */
export async function getCiStatus(prNumber: number): Promise<CiStatus> {
  if (isGithubMock()) {
    return "success";
  }

  const octokit = client();
  const { owner, repo } = repoConfig();

  const pr = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
  const checks = await octokit.checks.listForRef({ owner, repo, ref: pr.data.head.sha });

  if (checks.data.total_count === 0) {
    return "pending";
  }
  const conclusions = checks.data.check_runs.map((c) => c.conclusion);
  if (conclusions.some((c) => c === null)) return "pending";
  return conclusions.every((c) => c === "success" || c === "skipped" || c === "neutral")
    ? "success"
    : "failure";
}

/** Merge the PR. Irreversible — only called after human approval. */
export async function mergePullRequest(prNumber: number): Promise<{ merged: boolean; sha: string }> {
  if (isGithubMock()) {
    return { merged: true, sha: `mockmerge${prNumber}` };
  }

  const octokit = client();
  const { owner, repo } = repoConfig();

  const res = await octokit.pulls.merge({ owner, repo, pull_number: prNumber, merge_method: "squash" });
  return { merged: res.data.merged, sha: res.data.sha };
}

/** Deterministic mock PR number derived from the run id (no Math.random — keeps replays stable). */
function mockPrNumber(runId: string): number {
  let hash = 0;
  for (const ch of runId) hash = (hash * 31 + ch.charCodeAt(0)) % 9000;
  return hash + 1000;
}
