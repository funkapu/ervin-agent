ALTER TABLE "runs" ADD COLUMN "chat_provider" varchar(20);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "chat_channel_id" varchar(80);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "chat_thread_ref" varchar(80);