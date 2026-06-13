/**
 * Parse the set of file paths a unified diff touches (client-safe; mirrors the
 * server-side `touchedPaths` in lib/agent/steps/generate-fix.ts without pulling
 * the AI SDK into the client bundle).
 */
export function touchedFiles(diff: string): string[] {
  const paths = new Set<string>();
  for (const line of diff.split("\n")) {
    let m = line.match(/^\+\+\+ (?:b\/)?(.+)$/) ?? line.match(/^--- (?:a\/)?(.+)$/);
    if (!m) m = line.match(/^diff --git a\/(.+?) b\/.+$/);
    if (m) {
      const path = m[1].trim();
      if (path && path !== "/dev/null") paths.add(path);
    }
  }
  return [...paths].sort();
}
