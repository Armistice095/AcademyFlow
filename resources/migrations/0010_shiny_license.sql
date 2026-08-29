CREATE TABLE `LICENSE` (
	`id` text PRIMARY KEY NOT NULL,
	`machine_fingerprint` text NOT NULL,
	`encrypted_payload` text NOT NULL,
	`last_verified_at` text,
	`onboarding_completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
