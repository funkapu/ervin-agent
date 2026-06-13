import type { RunState } from "./types";

/** The 10 canonical pipeline states, in order. `failed` is a terminal off-ramp. */
export const PIPELINE_STATES: RunState[] = [
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
];

export const TERMINAL_STATES: RunState[] = ["closed", "failed"];

export function isTerminal(state: RunState): boolean {
  return TERMINAL_STATES.includes(state);
}

/** Position of a state within the pipeline (failed → -1, it's off the line). */
export function stateIndex(state: RunState): number {
  return PIPELINE_STATES.indexOf(state);
}

type Tone = "idle" | "active" | "wait" | "done" | "error";

const STATE_TONE: Record<RunState, Tone> = {
  received: "idle",
  classifying: "active",
  building_context: "active",
  fixing: "active",
  pr_open: "active",
  ci_running: "active",
  awaiting_approval: "wait",
  merged: "active",
  deployed: "active",
  closed: "done",
  failed: "error",
};

/** Human label for a state (snake_case → Title Case). */
export const STATE_LABEL: Record<RunState, string> = {
  received: "Received",
  classifying: "Classifying",
  building_context: "Building context",
  fixing: "Generating fix",
  pr_open: "PR open",
  ci_running: "CI running",
  awaiting_approval: "Awaiting approval",
  merged: "Merged",
  deployed: "Deployed",
  closed: "Closed",
  failed: "Failed",
};

/** Badge classes for the run's *current* state. One accent (emerald) + amber/red signals. */
const TONE_BADGE: Record<Tone, string> = {
  idle: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  wait: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  done: "border-emerald-500/40 bg-emerald-500/20 text-emerald-200",
  error: "border-red-500/40 bg-red-500/15 text-red-300",
};

export function stateBadgeClass(state: RunState): string {
  return TONE_BADGE[STATE_TONE[state]];
}

export function stateTone(state: RunState): Tone {
  return STATE_TONE[state];
}

/** Status of a single node in the pipeline tracker, given the run's current state. */
export type NodeStatus = "done" | "current" | "pending" | "failed";

export function nodeStatus(
  node: RunState,
  current: RunState,
  failedAtState?: RunState | null,
): NodeStatus {
  const nodeIdx = stateIndex(node);

  if (current === "failed") {
    // The run.state is just "failed" — the step log tells us which node died.
    const failedIdx = failedAtState ? stateIndex(failedAtState) : PIPELINE_STATES.length;
    if (nodeIdx < failedIdx) return "done";
    if (nodeIdx === failedIdx) return "failed";
    return "pending";
  }

  const curIdx = stateIndex(current);
  if (nodeIdx < curIdx) return "done";
  if (nodeIdx === curIdx) return "current";
  return "pending";
}
