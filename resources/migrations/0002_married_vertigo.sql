CREATE TABLE `BACKUP_CONFIG` (
	`id` text PRIMARY KEY NOT NULL,
	`connected` integer DEFAULT false NOT NULL,
	`account_email` text,
	`refresh_token_encrypted` text,
	`drive_folder_id` text,
	`auto_backup_enabled` integer DEFAULT false NOT NULL,
	`auto_backup_hour` integer DEFAULT 2 NOT NULL,
	`last_backup_at` text,
	`last_backup_status` text,
	`last_backup_message` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `BACKUP_HISTORY` (
	`id` text PRIMARY KEY NOT NULL,
	`drive_file_id` text NOT NULL,
	`file_name` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `backup_history_drive_file_id_unique` ON `BACKUP_HISTORY` (`drive_file_id`);--> statement-breakpoint
CREATE INDEX `backup_history_created_at_idx` ON `BACKUP_HISTORY` (`created_at`);--> statement-breakpoint
CREATE TABLE `PRINTER_CONFIG` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`connection_type` text DEFAULT 'network' NOT NULL,
	`device_path` text,
	`host` text,
	`port` integer DEFAULT 9100 NOT NULL,
	`last_test_at` text,
	`last_test_success` integer,
	`last_test_message` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `USERS` ADD `is_active` integer DEFAULT true NOT NULL;