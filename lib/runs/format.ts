/** Compact relative time, e.g. "just now", "3m ago", "2h ago", "5d ago". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(then)) return "";
  const sec = Math.round(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

/** Duration between two ISO timestamps (or to now if end is null), e.g. "5.8s". */
export function duration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Render a step's `output` object into short "key: value" chips. */
export function summarizeOutput(output: Record<string, unknown> | null): string[] {
  if (!output) return [];
  return Object.entries(output).map(([k, v]) => `${k}: ${formatValue(v)}`);
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 80 ? `${v.slice(0, 80)}…` : v;
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  return JSON.stringify(v);
}
