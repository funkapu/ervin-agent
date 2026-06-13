import { cn } from "@/lib/utils";

type LineKind = "add" | "del" | "hunk" | "meta" | "context";

function classify(line: string): LineKind {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index "))
    return "meta";
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "context";
}

const LINE_CLASS: Record<LineKind, string> = {
  add: "bg-emerald-500/10 text-emerald-300",
  del: "bg-red-500/10 text-red-300",
  hunk: "bg-zinc-800/60 text-sky-300",
  meta: "text-zinc-500",
  context: "text-zinc-400",
};

const GUTTER: Record<LineKind, string> = {
  add: "text-emerald-500/70",
  del: "text-red-500/70",
  hunk: "text-zinc-600",
  meta: "text-zinc-700",
  context: "text-zinc-700",
};

/**
 * Lightweight unified-diff renderer: line numbers + +/- coloring. No syntax
 * highlighter dependency — just classifies each line by its leading prefix.
 */
export function DiffView({ diff }: { diff: string }) {
  const lines = diff.replace(/\n$/, "").split("\n");

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/60">
      <pre className="min-w-full text-xs leading-relaxed">
        <code className="block font-mono">
          {lines.map((line, i) => {
            const kind = classify(line);
            return (
              <div key={i} className={cn("flex", LINE_CLASS[kind])}>
                <span
                  className={cn(
                    "w-10 shrink-0 select-none border-r border-zinc-800/80 px-2 text-right tabular-nums",
                    GUTTER[kind],
                  )}
                >
                  {i + 1}
                </span>
                <span className="whitespace-pre px-3">{line || " "}</span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
