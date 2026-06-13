/** Client-side mirrors of the run/run_steps API shapes (GET /api/runs/[id]). */

export type RunState =
  | "received"
  | "classifying"
  | "building_context"
  | "fixing"
  | "pr_open"
  | "ci_running"
  | "awaiting_approval"
  | "merged"
  | "deployed"
  | "closed"
  | "failed";

export type StepStatus = "pending" | "success" | "failed";

export type RunStep = {
  id: string;
  state: RunState;
  status: StepStatus;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type Run = {
  id: string;
  title: string;
  state: RunState;
  issueSource: string;
  externalIssueId: string | null;
  category: string | null;
  severity: string | null;
  diff: string | null;
  prUrl: string | null;
  context: string | null;
  ciStatus: string | null;
  // Trust layer
  baseSha: string | null;
  mergeSha: string | null;
  scopeFiles: string[] | null;
  scopeViolation: boolean;
  violatingPaths: string[] | null;
  rolledBackAt: string | null;
  revertPrUrl: string | null;
  fixRating: "good" | "bad" | null;
  fixFeedback: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RunDetail = Run & { steps: RunStep[] };
