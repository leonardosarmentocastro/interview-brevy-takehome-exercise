ALTER TABLE "issue_decisions" ADD COLUMN "recommendation" text;--> statement-breakpoint
ALTER TABLE "issue_decisions" ADD COLUMN "confidence" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "issue_decisions" ADD COLUMN "confidence_base" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "issue_decisions" ADD COLUMN "routing_band" text;--> statement-breakpoint
ALTER TABLE "issue_decisions" ADD COLUMN "score_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "issue_decisions" ADD COLUMN "trace" jsonb;