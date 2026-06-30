ALTER TYPE "client_stage" ADD VALUE IF NOT EXISTS 'mockup' BEFORE 'content';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "mockup_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "mockup_file_path" text;
