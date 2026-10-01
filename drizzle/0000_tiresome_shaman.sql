CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_at` ON `security_events` (`at`);--> statement-breakpoint
CREATE TABLE `visitor_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`data` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `visitor_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cache_owner` ON `visitor_cache` (`session_id`);--> statement-breakpoint
CREATE TABLE `visitor_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`identity` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`processing_until` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `visitor_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lead_owner_identity` ON `visitor_leads` (`session_id`,`identity`);--> statement-breakpoint
CREATE TABLE `request_limits` (
	`bucket` text PRIMARY KEY NOT NULL,
	`n` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_limits_expiry` ON `request_limits` (`expires`);--> statement-breakpoint
CREATE TABLE `visitor_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`csrf` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expiry` ON `visitor_sessions` (`expires`);