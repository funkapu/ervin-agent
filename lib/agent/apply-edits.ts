import { createPatch } from "diff";
import type { FileChange } from "@/lib/agent/steps/generate-fix";
import type { FileContent } from "@/lib/integrations/github";

export type AppliedFile = { path: string; before: string; after: string };

/** Thrown when an edit can't be applied unambiguously — the run must fail, no PR. */
export class EditApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditApplyError";
  }
}

/**
 * Apply structured search/replace edits to the files' CURRENT content by exact
 * match. Each `oldText` must occur EXACTLY once — 0 or >1 matches throw an
 * actionable error naming the file + snippet (never guess, never partial-apply).
 */
export function applyEdits(files: FileContent[], changes: FileChange[]): AppliedFile[] {
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  const applied: AppliedFile[] = [];

  for (const change of changes) {
    const before = byPath.get(change.path);
    if (before === undefined) {
      throw new EditApplyError(
        `Cannot apply edits to ${change.path}: its current content wasn't fetched (out of scope?). No PR opened.`,
      );
    }

    let content = before;
    for (const edit of change.edits) {
      const occurrences = countOccurrences(content, edit.oldText);
      if (occurrences === 0) {
        throw new EditApplyError(
          `Edit does not match current code in ${change.path} — snippet not found:\n${preview(edit.oldText)}`,
        );
      }
      if (occurrences > 1) {
        throw new EditApplyError(
          `Edit is ambiguous in ${change.path} (${occurrences} matches) — snippet must be unique:\n${preview(edit.oldText)}`,
        );
      }
      const idx = content.indexOf(edit.oldText);
      content = content.slice(0, idx) + edit.newText + content.slice(idx + edit.oldText.length);
    }

    applied.push({ path: change.path, before, after: content });
  }

  return applied;
}

/** The new full file contents to commit. */
export function toCommitFiles(applied: AppliedFile[]): FileContent[] {
  return applied.map((a) => ({ path: a.path, content: a.after }));
}

/** A real unified diff (old vs new) for display in the dashboard / MCP. */
export function toUnifiedDiff(applied: AppliedFile[]): string {
  return applied
    .map((a) => createPatch(a.path, a.before, a.after, "", "").trimEnd())
    .join("\n");
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function preview(s: string, n = 240): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
