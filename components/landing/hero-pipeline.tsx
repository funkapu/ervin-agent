"use client";

import { useEffect, useState } from "react";

type Stage = { label: string; meta?: string; gate?: boolean };

const STAGES: Stage[] = [
  { label: "Received" },
  { label: "Classifying", meta: "bug · high" },
  { label: "Building context", meta: "4 files" },
  { label: "Writing fix", meta: "+12 −3" },
  { label: "PR opened", meta: "#1247" },
  { label: "CI", meta: "17/17" },
  { label: "Awaiting approval", gate: true },
  { label: "Merged" },
  { label: "Shipped" },
];

// Per-step dwell times (ms). Index = step. The long one is the approval gate.
const DELAYS = [620, 620, 620, 620, 620, 620, 2600, 720, 720, 3200];

type StageState = "idle" | "active" | "gate" | "done";

function stateOf(index: number, step: number): StageState {
  if (step === 9) return "done";
  if (index === 6) {
    if (step < 6) return "idle";
    if (step === 6) return "gate";
    return "done";
  }
  if (index < step) return "done";
  if (index === step) return "active";
  return "idle";
}

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

const Gate = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="7" y="6" width="3.5" height="12" rx="1" />
    <rect x="13.5" y="6" width="3.5" height="12" rx="1" />
  </svg>
);

/**
 * The signature hero animation: a bug→deploy run filling stage by stage,
 * holding at the amber approval gate (the human-approval beat), then shipping
 * and looping. Static under prefers-reduced-motion.
 */
export function HeroPipeline() {
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduced(mq.matches);
      if (mq.matches) setStep(6); // static: stages 1–6 done, gate highlighted
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => setStep((k) => (k + 1) % 10), DELAYS[step]);
    return () => clearTimeout(id);
  }, [step, reduced]);

  const animate = !reduced;

  return (
    <div className="erv-pipe" aria-hidden="true">
      <div className="erv-pipe-head">
        <span>
          <span className="dot" />run · login button does nothing
        </span>
        <span>ISSUE-123</span>
      </div>
      <div className="erv-pipe-body">
        {STAGES.map((stage, i) => {
          const state = stateOf(i, step);
          const cls = state === "active" ? "is-active" : state === "gate" ? "is-gate" : state === "done" ? "is-done" : "";
          return (
            <div key={stage.label} className={`erv-stage ${cls}`}>
              {state === "done" ? (
                <span className="erv-node done">
                  <Check />
                </span>
              ) : state === "active" ? (
                <span className="erv-node active">
                  <span className="erv-spin" />
                </span>
              ) : state === "gate" ? (
                <span className={`erv-node gate ${animate ? "is-pulse" : ""}`}>
                  <Gate />
                </span>
              ) : (
                <span className="erv-node idle" />
              )}
              <span className="erv-stage-label">{stage.label}</span>
              {stage.gate ? (
                <span className={`erv-pill ${state === "gate" && animate ? "is-pulse" : ""}`}>your call</span>
              ) : stage.meta ? (
                <span className="erv-stage-meta">{stage.meta}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
