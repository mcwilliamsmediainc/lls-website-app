ALTER TABLE "clients" ADD COLUMN "managed_hosting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "server_host" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "server_user" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "server_path" text;