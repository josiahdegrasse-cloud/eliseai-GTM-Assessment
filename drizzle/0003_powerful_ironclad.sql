CREATE TABLE `email_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`provider` text NOT NULL,
	`label_name` text NOT NULL,
	`expires` integer NOT NULL,
	`last_sync_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `visitor_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_email_connection_owner` ON `email_connections` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_email_connection_token` ON `email_connections` (`token_hash`);--> statement-breakpoint
CREATE TABLE `email_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`data` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `visitor_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_email_message_unique` ON `email_messages` (`session_id`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_email_message_review` ON `email_messages` (`session_id`,`status`,`created_at`);