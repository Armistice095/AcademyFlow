CREATE TABLE `SALARY_ADVANCES` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text,
	`transaction_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`deducted_in_payment_id` text,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `EMPLOYEES`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `TRANSACTIONS`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`deducted_in_payment_id`) REFERENCES `SALARY_PAYMENTS`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `USERS`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `salary_advances_employee_idx` ON `SALARY_ADVANCES` (`employee_id`);--> statement-breakpoint
CREATE INDEX `salary_advances_status_idx` ON `SALARY_ADVANCES` (`status`);