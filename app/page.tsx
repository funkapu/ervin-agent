import type { Metadata } from "next";
import { HeroPipeline } from "@/components/landing/hero-pipeline";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import "./landing.css";

export const metadata: Metadata = {
  title: "Ervin — Fixes your bugs end to end. Ships nothing without your approval.",
  description:
    "Ervin turns a bug report into a reviewed pull request — classify, fix, open the PR, run CI — then stops and waits for your approval. You watch every step.",
};

export default function LandingPage() {
  return (
    <div className="erv">
      <nav className="erv-nav" aria-label="Primary">
        <div className="erv-nav-inner">
          <a href="#top" className="erv-wordmark">
            <span className="tilde">~</span> ervin
          </a>
          <a href="#waitlist" className="erv-nav-link">
            Get early access
          </a>
        </div>
      </nav>

      <main id="top">
        {/* Hero */}
        <header className="erv-wrap erv-hero">
          <div>
            <p className="erv-eyebrow">Autonomous engineering-ops</p>
            <h1 className="erv-h1">
              Fixes your bugs end to end.
              <br />
              Ships nothing <span className="erv-amber">without your approval.</span>
            </h1>
            <p className="erv-lede">
              Ervin turns a bug report into a reviewed pull request — it classifies the issue, finds
              the cause, writes a scoped fix, opens the PR, runs CI — then stops and waits for you.
              You watch every step. You hold the gate.
            </p>
            <div className="erv-hero-actions">
              <a href="#waitlist" className="erv-btn erv-btn-primary">
                Get early access
              </a>
              <a href="#how" className="erv-btn erv-btn-ghost">
                See how it works
              </a>
            </div>
          </div>
          <HeroPipeline />
        </header>

        {/* The loop */}
        <section id="how" className="erv-section erv-wrap" aria-labelledby="how-h">
          <p className="erv-eyebrow">The loop</p>
          <h2 id="how-h" className="erv-h2">
            One path from “it’s broken” to “it’s shipped.”
          </h2>
          <p className="erv-sub">
            No black box. Every run moves through the same visible stages — and pauses for you before
            anything lands.
          </p>
          <ol className="erv-steps">
            <li className="erv-step">
              <div className="erv-step-num">01</div>
              <h3 className="erv-step-title">Report it where you already are</h3>
              <p className="erv-step-body">
                Type the bug in Slack or Discord, or drop a Linear ticket —{" "}
                <code>/ervin the login button does nothing</code>. Ervin opens the issue and gets to
                work.
              </p>
            </li>
            <li className="erv-step">
              <div className="erv-step-num">02</div>
              <h3 className="erv-step-title">Ervin investigates</h3>
              <p className="erv-step-body">
                It classifies the bug, pulls the relevant files, and checks how similar bugs were
                fixed before — so the fix has context, not guesses.
              </p>
            </li>
            <li className="erv-step">
              <div className="erv-step-num">03</div>
              <h3 className="erv-step-title">It writes the fix and opens a PR</h3>
              <p className="erv-step-body">
                Scoped to only the code the bug touches — and flagged if it ever strays outside that
                scope. CI runs automatically.
              </p>
            </li>
            <li className="erv-step">
              <div className="erv-step-num">04</div>
              <h3 className="erv-step-title">You approve — or roll it back</h3>
              <p className="erv-step-body">
                Ervin stops at the gate. Review the diff, approve to merge and deploy, or revert in
                one click. Nothing ships without you.
              </p>
            </li>
          </ol>
        </section>

        {/* Why it's different */}
        <section className="erv-section erv-wrap" aria-labelledby="why-h">
          <p className="erv-eyebrow">Why it&apos;s different</p>
          <h2 id="why-h" className="erv-h2">
            Other agents hide the work and take the wheel. Ervin shows you everything and hands you
            the gate.
          </h2>
          <div className="erv-pillars">
            <article className="erv-pillar">
              <p className="erv-kicker">Visibility</p>
              <h3 className="erv-pillar-title">You see the whole loop</h3>
              <p className="erv-pillar-body">
                Every state, every step, live — what it classified, what it changed, why. The
                pipeline isn’t a log buried somewhere. It’s the product.
              </p>
            </article>
            <article className="erv-pillar">
              <p className="erv-kicker">Approval-first</p>
              <h3 className="erv-pillar-title">You hold the gate</h3>
              <p className="erv-pillar-body">
                It runs on its own right up to merge, then waits. Built for people who won’t hand
                production to something they can’t stop.
              </p>
            </article>
            <article className="erv-pillar">
              <p className="erv-kicker">Where you work</p>
              <h3 className="erv-pillar-title">Slack &amp; Discord, in and out</h3>
              <p className="erv-pillar-body">
                File a bug by typing. Get pinged to approve in the same thread. The dashboard is
                there when you want to look closer.
              </p>
            </article>
          </div>
        </section>

        {/* Trust */}
        <section className="erv-section erv-wrap" aria-labelledby="trust-h">
          <div className="erv-trust">
            <div>
              <p className="erv-eyebrow">Trust</p>
              <h2 id="trust-h" className="erv-h2">
                Don’t trust the AI’s fix? Good. Neither do we — by default.
              </h2>
              <p className="erv-sub">
                See exactly which files changed and which lines. Ervin only touches code inside the
                bug’s scope, and warns you when a fix reaches past it. Merged something you regret?
                One click opens a clean revert PR — no history rewriting, no surprises.
              </p>
            </div>
            <div className="erv-diff" aria-hidden="true">
              <div className="erv-diff-head">
                <span>app/checkout.ts</span>
                <span>+1 −1</span>
              </div>
              <div className="erv-diff-body">
                <div className="erv-diff-line"> export function onTap(e){"{"}</div>
                <div className="erv-diff-line del">− if (size {">"} MAX) return;</div>
                <div className="erv-diff-line add">+ if (size {">"} MAX_AVATAR_SIZE) reject(e);</div>
                <div className="erv-diff-line"> {"}"}</div>
              </div>
              <div className="erv-diff-foot">
                <span className="erv-chip sage">scope · 1 file</span>
                <span className="erv-chip">no out-of-scope edits</span>
                <span className="erv-chip amber">↩ rollback ready</span>
              </div>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="erv-section erv-wrap" aria-labelledby="who-h">
          <p className="erv-eyebrow">Who it&apos;s for</p>
          <p id="who-h" className="erv-who-line">
            Built for solo founders who already <span className="erv-amber">ship like a team</span>.
          </p>
          <p className="erv-sub">
            And for small teams who want to ship like a bigger one — every member can file work from
            chat, and the agent handles the grind while the humans keep the call.
          </p>
        </section>

        {/* Waitlist */}
        <section id="waitlist" className="erv-section erv-wrap erv-waitlist" aria-labelledby="waitlist-h">
          <p className="erv-eyebrow">Early access</p>
          <h2 id="waitlist-h" className="erv-h2">
            Put a teammate on autopilot.
            <br />
            Keep your hand on the gate.
          </h2>
          <p className="erv-sub">
            Ervin is opening up to a first group of founders. Get in line.
          </p>
          <WaitlistForm />
        </section>
      </main>

      <footer className="erv-footer">
        <div className="erv-footer-inner">
          <span>~ ervin · autonomous bug-to-deploy</span>
          <span>You watch every step. You stay in control.</span>
        </div>
      </footer>
    </div>
  );
}
