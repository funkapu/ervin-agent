"use client";

import { useEffect, useRef, useState } from "react";
import { isTerminal } from "./states";
import type { Run, RunDetail } from "./types";

/**
 * Poll a single run while it's active. Uses recursive setTimeout (no overlap)
 * and stops once the run reaches a terminal state, so requests don't run forever.
 */
export function useRunDetail(id: string, intervalMs = 1500) {
  const [data, setData] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumping this re-arms polling after an action (e.g. approve) even if terminal.
  const [nudge, setNudge] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const res = await fetch(`/api/runs/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as RunDetail;
        if (!active) return;
        setData(json);
        setError(null);
        setLoading(false);
        if (!isTerminal(json.state)) {
          timer = setTimeout(tick, intervalMs);
        }
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load run");
        setLoading(false);
        timer = setTimeout(tick, intervalMs * 2);
      }
    }

    tick();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [id, intervalMs, nudge]);

  return { data, error, loading, refresh: () => setNudge((n) => n + 1) };
}

/** Poll the full runs list at a slower cadence for the dashboard index. */
export function useRunsList(intervalMs = 3000) {
  const [data, setData] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<Run[] | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const res = await fetch("/api/runs", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Run[];
        if (!active) return;
        dataRef.current = json;
        setData(json);
        setError(null);
      } catch (e) {
        if (!active) return;
        // Keep showing the last good data; just record the error.
        setError(e instanceof Error ? e.message : "Failed to load runs");
      } finally {
        if (active) timer = setTimeout(tick, intervalMs);
      }
    }

    tick();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs]);

  return { data, error };
}
