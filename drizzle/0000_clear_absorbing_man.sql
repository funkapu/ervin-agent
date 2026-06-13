CREATE TYPE "public"."run_state" AS ENUM('received', 'classifying', 'building_context', 'fixing', 'pr_open', 'ci_running', 'awaiting_approval', 'merged', 'deployed', 'closed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."step_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"state" "run_state" NOT NULL,
	"status" "step_status" DEFAULT 'pending' NOT NULL,
	"output" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"issue_source" varchar(50) DEFAULT 'linear' NOT NULL,
	"external_issue_id" varchar(255),
	"state" "run_state" DEFAULT 'received' NOT NULL,
	"context" text,
	"pr_url" varchar(500),
	"category" varchar(50),
	"severity" varchar(50),
	"diff" text,
	"ci_status" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;