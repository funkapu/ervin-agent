/**
 * Linear integration for Ervin.
 *
 * Real mode talks to the Linear GraphQL API (LINEAR_API_KEY). Mock mode is used
 * when `ERVIN_MOCK=1` OR `LINEAR_API_KEY` is absent, returning canned results so
 * the pipeline closes out end-to-end without a live Linear workspace.
 */

const LINEAR_API = "https://api.linear.app/graphql";

export type CloseResult = {
  commented: boolean;
  closed: boolean;
  issueId: string | null;
};

export type CreatedIssue = {
  /** Linear's internal id (used by commentAndClose). */
  id: string;
  /** Human identifier, e.g. "LIN-842". */
  identifier: string;
  url: string;
};

export function isLinearMock(): boolean {
  return process.env.ERVIN_MOCK === "1" || !process.env.LINEAR_API_KEY;
}

/**
 * Create a Linear issue for an incoming piece of work. Mock returns a canned
 * issue so chat intake runs end-to-end without a live workspace.
 *
 * Real mode needs LINEAR_TEAM_ID (the team the issue is filed under).
 */
export async function createIssue(title: string, description?: string): Promise<CreatedIssue> {
  if (isLinearMock()) {
    const n = mockIssueNumber(title);
    return {
      id: `mock-issue-${n}`,
      identifier: `LIN-${n}`,
      url: `https://linear.app/ervin/issue/LIN-${n}`,
    };
  }

  const teamId = process.env.LINEAR_TEAM_ID;
  if (!teamId) {
    throw new Error("LINEAR_TEAM_ID must be set when not in mock mode");
  }

  const data = await linearRequest<{
    issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string } };
  }>(
    `mutation Create($teamId: String!, $title: String!, $description: String) {
      issueCreate(input: { teamId: $teamId, title: $title, description: $description }) {
        success
        issue { id identifier url }
      }
    }`,
    { teamId, title, description: description ?? null },
  );

  const issue = data.issueCreate.issue;
  return { id: issue.id, identifier: issue.identifier, url: issue.url };
}

/** Deterministic mock issue number from the title (no Math.random — keeps replays stable). */
function mockIssueNumber(seed: string): number {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) % 9000;
  return hash + 100;
}

async function linearRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.LINEAR_API_KEY!,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Linear API error: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`Linear API error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data;
}

/**
 * Post a comment back to the issue and move it to a completed/closed state.
 * `issueId` is the run's `externalIssueId`.
 */
export async function commentAndClose(issueId: string | null, comment: string): Promise<CloseResult> {
  if (isLinearMock()) {
    return { commented: true, closed: true, issueId };
  }
  if (!issueId) {
    return { commented: false, closed: false, issueId: null };
  }

  await linearRequest(
    `mutation Comment($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) { success }
    }`,
    { issueId, body: comment },
  );

  // Find a completed-type workflow state for this issue's team, then transition.
  const stateData = await linearRequest<{
    issue: { team: { states: { nodes: { id: string; type: string }[] } } };
  }>(
    `query StateLookup($issueId: String!) {
      issue(id: $issueId) { team { states { nodes { id type } } } }
    }`,
    { issueId },
  );
  const completedState = stateData.issue.team.states.nodes.find((s) => s.type === "completed");

  if (completedState) {
    await linearRequest(
      `mutation Close($issueId: String!, $stateId: String!) {
        issueUpdate(id: $issueId, input: { stateId: $stateId }) { success }
      }`,
      { issueId, stateId: completedState.id },
    );
  }

  return { commented: true, closed: Boolean(completedState), issueId };
}
