CREATE TYPE "public"."command_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lls_commands" (
	"id" serial PRIMARY KEY NOT NULL,
	"instruction" text NOT NULL,
	"status" "command_status" DEFAULT 'pending' NOT NULL,
	"output" text,
	"queued_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lls_commands_status_idx" ON "lls_commands" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lls_commands_created_idx" ON "lls_commands" USING btree ("created_at");