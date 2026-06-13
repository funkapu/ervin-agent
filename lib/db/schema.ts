import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar, vector } from "drizzle-orm/pg-core";
import { EMBEDDING_DIM } from "@/lib/agent/embedding-config";

export const runStateEnum = pgEnum("run_state", [
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
  "failed",
]);

export const stepStatusEnum = pgEnum("step_status", ["pending", "success", "failed"]);

export const fixRatingEnum = pgEnum("fix_rating", ["good", "bad"]);

/** Tenant. Every user-owned row hangs off an account; MCP/API keys mint per account. */
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** API keys for an account. Only the hash is stored — the raw key is shown once at mint. */
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(),
  prefix: varchar("prefix", { length: 24 }).notNull(),
  label: varchar("label", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Tenant owner — every run belongs to exactly one account.
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  title: varchar("title", { length: 500 }).notNull(),
  issueSource: varchar("issue_source", { length: 50 }).notNull().default("linear"),
  externalIssueId: varchar("external_issue_id", { length: 255 }),
  state: runStateEnum("state").notNull().default("received"),
  context: text("context"),
  prUrl: varchar("pr_url", { length: 500 }),
  // Structured outputs from the pipeline (additive — kept out of `context` for queryability).
  category: varchar("category", { length: 50 }),
  severity: varchar("severity", { length: 50 }),
  diff: text("diff"),
  // Structured search/replace edits the fix applies (source of truth); `diff` is
  // a computed old-vs-new view for display only.
  fixEdits: jsonb("fix_edits").$type<{ path: string; edits: { oldText: string; newText: string }[] }[]>(),
  ciStatus: varchar("ci_status", { length: 50 }),
  // --- Trust layer ---
  // Version anchor: the base commit the PR was opened against ("the old version").
  baseSha: text("base_sha"),
  mergeSha: text("merge_sha"),
  // Scope-limiting: the files the fix was allowed to touch, and any it touched anyway.
  scopeFiles: jsonb("scope_files").$type<string[]>(),
  scopeViolation: boolean("scope_violation").notNull().default(false),
  violatingPaths: jsonb("violating_paths").$type<string[]>(),
  // Rollback (git-native revert PR — never a force-push).
  rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
  revertPrUrl: varchar("revert_pr_url", { length: 500 }),
  // Fix feedback (seeds future prompt/few-shot improvements).
  fixRating: fixRatingEnum("fix_rating"),
  fixFeedback: text("fix_feedback"),
  // Chat intake: links a run back to the chat thread it was started from.
  // Generic (provider-agnostic) fields — the source of truth going forward.
  chatProvider: varchar("chat_provider", { length: 20 }),
  chatChannelId: varchar("chat_channel_id", { length: 80 }),
  chatThreadRef: varchar("chat_thread_ref", { length: 80 }),
  // Legacy Slack-specific columns (kept for back-compat; new runs use the generic fields).
  slackChannel: varchar("slack_channel", { length: 50 }),
  slackThreadTs: varchar("slack_thread_ts", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * One row per pipeline step. This is the visibility backbone: polling a run's
 * steps shows the founder exactly where the loop is and what each step produced.
 */
export const runSteps = pgTable("run_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  state: runStateEnum("state").notNull(),
  status: stepStatusEnum("status").notNull().default("pending"),
  output: jsonb("output"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/**
 * Messages the pre-filter dropped before the LLM ran. This is labeled training
 * data for a future learned classifier — capture the text + why it was filtered.
 */
export const intakeFiltered = pgTable("intake_filtered", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: varchar("provider", { length: 20 }),
  channelId: varchar("channel_id", { length: 80 }),
  text: text("text").notNull(),
  reason: varchar("reason", { length: 60 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-run embedding of (title + description), for semantic similar-bug retrieval.
 * `dimensions` is pinned to EMBEDDING_DIM so it always matches the model.
 */
export const runEmbeddings = pgTable("run_embeddings", {
  runId: uuid("run_id")
    .primaryKey()
    .references(() => runs.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIM }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Public landing-page waitlist signups. */
export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type RunStep = typeof runSteps.$inferSelect;
export type NewRunStep = typeof runSteps.$inferInsert;
export type IntakeFiltered = typeof intakeFiltered.$inferSelect;
