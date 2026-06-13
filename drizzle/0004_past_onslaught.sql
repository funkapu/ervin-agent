CREATE TABLE "intake_filtered" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(20),
	"channel_id" varchar(80),
	"text" text NOT NULL,
	"reason" varchar(60) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
