CREATE TYPE "public"."fix_rating" AS ENUM('good', 'bad');--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "base_sha" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "merge_sha" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "scope_files" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "scope_violation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "violating_paths" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "rolled_back_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "revert_pr_url" varchar(500);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "fix_rating" "fix_rating";--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "fix_feedback" text;