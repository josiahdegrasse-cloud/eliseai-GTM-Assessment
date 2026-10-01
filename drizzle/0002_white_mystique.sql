CREATE TABLE `sheet_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`spreadsheet_id` text NOT NULL,
	`tab_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires` integer NOT NULL,
	`last_sync_at` integer,
	`received` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	FOREIGN KEY (`session_id`) REFERENCES `visitor_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sheet_owner` ON `sheet_connections` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sheet_token` ON `sheet_connections` (`token_hash`);