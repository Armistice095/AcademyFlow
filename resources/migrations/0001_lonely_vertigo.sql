CREATE TABLE `SCHOOL_INFO` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`address` text,
	`phone` text,
	`email` text,
	`logo_data_url` text,
	`stamp_data_url` text,
	`updated_at` text NOT NULL
);
