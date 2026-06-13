"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "submitting" | "done" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus("error");
      setMessage("That doesn't look like an email — mind checking it?");
      return;
    }
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong on our end.");
      }
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong — try again in a moment.");
    }
  }

  if (status === "done") {
    return (
      <p className="erv-success" role="status">
        ✓ You’re on the list — watch your inbox.
      </p>
    );
  }

  return (
    <div>
      <form className="erv-form" onSubmit={submit} noValidate>
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          className="erv-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@startup.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          aria-invalid={status === "error"}
        />
        <button type="submit" className="erv-btn erv-btn-primary" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Request access"}
        </button>
      </form>
      {status === "error" ? (
        <p className="erv-error" role="alert">
          {message}
        </p>
      ) : (
        <p className="erv-microcopy">No spam. One email when it’s your turn.</p>
      )}
    </div>
  );
}
