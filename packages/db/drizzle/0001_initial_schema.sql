CREATE TYPE "public"."brain_injection_status" AS ENUM('pending', 'submitted', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."change_ticket_type" AS ENUM('design', 'content', 'seo', 'wireframe_over_limit', 'bug', 'other');--> statement-breakpoint
CREATE TYPE "public"."client_stage" AS ENUM('intake', 'content', 'review', 'live');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('pending', 'generating', 'generated', 'in_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."deployment_status" AS ENUM('pending', 'in_progress', 'success', 'failed', 'rolled_back');--> statement-breakpoint
CREATE TYPE "public"."gate_status" AS ENUM('pending', 'passing', 'failed');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('pending', 'in_progress', 'complete', 'blocked', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'gate_failed', 'held');--> statement-breakpoint
CREATE TYPE "public"."photo_source" AS ENUM('client', 'gbp', 'ai_generated', 'licensed_stock');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."site_type" AS ENUM('home_services', 'dental_health', 'legal', 'other');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('matt', 'tiffany', 'elise', 'chloe', 'penn', 'rachelle', 'clarence', 'tyler', 'lindsay');--> statement-breakpoint
CREATE TYPE "public"."client_tier" AS ENUM('tier_1', 'tier_2', 'tier_3');--> statement-breakpoint
CREATE TYPE "public"."worker_status" AS ENUM('idle', 'busy', 'draining', 'stopped');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "change_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"type" "change_ticket_type" NOT NULL,
	"description" text NOT NULL,
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"status" "item_status" DEFAULT 'pending' NOT NULL,
	"created_by" integer,
	"assigned_to" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"push_id" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"stage" "client_stage" NOT NULL,
	"item_name" text NOT NULL,
	"status" "item_status" DEFAULT 'pending' NOT NULL,
	"assigned_to" integer,
	"completed_at" timestamp with time zone,
	"notes" text,
	"tier_required" "client_tier",
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_annotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"wireframe_page_id" integer NOT NULL,
	"element_selector" text,
	"color" varchar(16),
	"note_text" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_by_token" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"business_name" text NOT NULL,
	"site_url" text,
	"tier" "client_tier",
	"site_type" "site_type" DEFAULT 'home_services' NOT NULL,
	"assigned_to" integer,
	"stage" "client_stage" DEFAULT 'intake' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"launched_at" timestamp with time zone,
	"do_server_id" text,
	"staging_url" text,
	"live_url" text,
	"rank_map_verdict" text,
	"phase_unlocked" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"page_type" text NOT NULL,
	"slug" text NOT NULL,
	"title" text,
	"status" "content_status" DEFAULT 'pending' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"generated_at" timestamp with time zone,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"schema_generated" boolean DEFAULT false NOT NULL,
	"verify_flags_count" integer DEFAULT 0 NOT NULL,
	"verify_flags_resolved" integer DEFAULT 0 NOT NULL,
	"previous_content_md" text,
	"previous_status" "content_status",
	"gate_status" "gate_status" DEFAULT 'pending' NOT NULL,
	"gate_failure_reason" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deployments" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"pushed_by" integer,
	"pushed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_count" integer DEFAULT 0 NOT NULL,
	"status" "deployment_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"snapshot_path" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"task_type" varchar(64) NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"queued_by" integer,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"log" text DEFAULT '' NOT NULL,
	"output_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"kb_cache_age_minutes" integer,
	"kb_cache_warn" boolean DEFAULT false NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lls_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_role" "team_role",
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lls_brain_injection_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"response_token" text NOT NULL,
	"status" "brain_injection_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone,
	"best_customer_description" text,
	"proud_of" text,
	"best_customer_story" text,
	"differentiator" text,
	"wish_customers_knew" text,
	"additional_notes" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lls_iris_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"memory_key" text NOT NULL,
	"memory_value" text NOT NULL,
	"source" text DEFAULT 'brain_injection' NOT NULL,
	"confidence" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lls_scorecards" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"on_site_seo_score" integer,
	"gbp_match_score" integer,
	"ai_search_ready_score" integer,
	"on_site_seo_grade" varchar(4),
	"gbp_match_grade" varchar(4),
	"ai_search_ready_grade" varchar(4),
	"calculated_at" timestamp with time zone,
	"gbp_oauth_connected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"filename" text NOT NULL,
	"source" "photo_source" NOT NULL,
	"zone_type" text,
	"page_assigned" text,
	"alt_text" text,
	"license_id" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"optimized" boolean DEFAULT false NOT NULL,
	"generation_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" "team_role" NOT NULL,
	"email" text NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wireframe_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"page_type" text NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"max_rounds" integer DEFAULT 2 NOT NULL,
	"status" "item_status" DEFAULT 'pending' NOT NULL,
	"file_path" text,
	"sent_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"client_notes" text,
	"review_token" text,
	"review_token_used" boolean DEFAULT false NOT NULL,
	"round_locked" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worker_heartbeat_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"total_jobs_processed" integer DEFAULT 0 NOT NULL,
	"uptime_minutes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worker_heartbeats" (
	"id" serial PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"jobs_processed" integer DEFAULT 0 NOT NULL,
	"current_job_id" integer,
	"status" "worker_status" DEFAULT 'idle' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "change_tickets" ADD CONSTRAINT "change_tickets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "change_tickets" ADD CONSTRAINT "change_tickets_created_by_team_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "change_tickets" ADD CONSTRAINT "change_tickets_assigned_to_team_members_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "change_tickets" ADD CONSTRAINT "change_tickets_deleted_by_team_members_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_assigned_to_team_members_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_deleted_by_team_members_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_annotations" ADD CONSTRAINT "client_annotations_wireframe_page_id_wireframe_pages_id_fk" FOREIGN KEY ("wireframe_page_id") REFERENCES "public"."wireframe_pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clients" ADD CONSTRAINT "clients_assigned_to_team_members_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clients" ADD CONSTRAINT "clients_deleted_by_team_members_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_approved_by_team_members_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_deleted_by_team_members_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_pushed_by_team_members_id_fk" FOREIGN KEY ("pushed_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_queued_by_team_members_id_fk" FOREIGN KEY ("queued_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lls_audit_log" ADD CONSTRAINT "lls_audit_log_actor_id_team_members_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lls_brain_injection_responses" ADD CONSTRAINT "lls_brain_injection_responses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lls_brain_injection_responses" ADD CONSTRAINT "lls_brain_injection_responses_reviewed_by_team_members_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lls_iris_memory" ADD CONSTRAINT "lls_iris_memory_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lls_scorecards" ADD CONSTRAINT "lls_scorecards_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "photos" ADD CONSTRAINT "photos_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "photos" ADD CONSTRAINT "photos_deleted_by_team_members_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wireframe_pages" ADD CONSTRAINT "wireframe_pages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wireframe_pages" ADD CONSTRAINT "wireframe_pages_deleted_by_team_members_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "worker_heartbeats" ADD CONSTRAINT "worker_heartbeats_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_tickets_client_idx" ON "change_tickets" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_client_stage_idx" ON "checklist_items" USING btree ("client_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_slug_idx" ON "clients" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_stage_idx" ON "clients" USING btree ("stage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_pages_client_idx" ON "content_pages" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_pages_client_slug_idx" ON "content_pages" USING btree ("client_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deployments_client_idx" ON "deployments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_client_idx" ON "jobs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_type_idx" ON "jobs" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_actor_idx" ON "lls_audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_entity_idx" ON "lls_audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_created_idx" ON "lls_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "brain_injection_token_idx" ON "lls_brain_injection_responses" USING btree ("response_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brain_injection_client_idx" ON "lls_brain_injection_responses" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iris_memory_client_key_idx" ON "lls_iris_memory" USING btree ("client_id","memory_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photos_client_idx" ON "photos" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_username_idx" ON "team_members" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_email_idx" ON "team_members" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wireframe_pages_client_idx" ON "wireframe_pages" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wireframe_pages_review_token_idx" ON "wireframe_pages" USING btree ("review_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "worker_heartbeats_worker_idx" ON "worker_heartbeats" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "worker_heartbeats_last_seen_idx" ON "worker_heartbeats" USING btree ("last_seen");