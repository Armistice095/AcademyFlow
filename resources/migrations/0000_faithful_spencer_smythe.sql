CREATE TABLE `AUDIT_LOG` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `USERS`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `AUDIT_LOG` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `AUDIT_LOG` (`created_at`);--> statement-breakpoint
CREATE TABLE `CLASSES` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_name_unique` ON `CLASSES` (`name`);--> statement-breakpoint
CREATE TABLE `EMPLOYEES` (
	`id` text PRIMARY KEY NOT NULL,
	`last_name` text NOT NULL,
	`first_name` text NOT NULL,
	`role` text NOT NULL,
	`phone` text,
	`monthly_salary` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `employees_name_idx` ON `EMPLOYEES` (`last_name`,`first_name`);--> statement-breakpoint
CREATE TABLE `ENROLLMENTS` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`school_year_id` text NOT NULL,
	`class_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `STUDENTS`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`school_year_id`) REFERENCES `SCHOOL_YEARS`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`class_id`) REFERENCES `CLASSES`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_student_year_unique` ON `ENROLLMENTS` (`student_id`,`school_year_id`);--> statement-breakpoint
CREATE TABLE `GUARDIANS` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`last_name` text NOT NULL,
	`first_name` text NOT NULL,
	`phone` text NOT NULL,
	`profession` text,
	`relationship` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `STUDENTS`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `guardians_student_idx` ON `GUARDIANS` (`student_id`);--> statement-breakpoint
CREATE TABLE `RECEIPTS` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_number` text NOT NULL,
	`transaction_id` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` text NOT NULL,
	`print_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `TRANSACTIONS`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_receipt_number_unique` ON `RECEIPTS` (`receipt_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_transaction_unique` ON `RECEIPTS` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `SALARY_PAYMENTS` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`school_year_id` text NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`transaction_id` text NOT NULL,
	`paid_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `EMPLOYEES`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`school_year_id`) REFERENCES `SCHOOL_YEARS`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`transaction_id`) REFERENCES `TRANSACTIONS`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `salary_payments_employee_month_year_unique` ON `SALARY_PAYMENTS` (`employee_id`,`month`,`year`);--> statement-breakpoint
CREATE UNIQUE INDEX `salary_payments_transaction_unique` ON `SALARY_PAYMENTS` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `SCHOOL_YEARS` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_years_label_unique` ON `SCHOOL_YEARS` (`label`);--> statement-breakpoint
CREATE TABLE `STUDENTS` (
	`id` text PRIMARY KEY NOT NULL,
	`matricule` text NOT NULL,
	`photo_path` text,
	`last_name` text NOT NULL,
	`first_name` text NOT NULL,
	`gender` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`place_of_birth` text,
	`nationality` text DEFAULT 'Béninoise' NOT NULL,
	`address` text,
	`previous_school` text,
	`status` text DEFAULT 'nouveau' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	FOREIGN KEY (`created_by`) REFERENCES `USERS`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_matricule_unique` ON `STUDENTS` (`matricule`);--> statement-breakpoint
CREATE INDEX `students_name_idx` ON `STUDENTS` (`last_name`,`first_name`);--> statement-breakpoint
CREATE TABLE `TRANSACTIONS` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`amount` integer NOT NULL,
	`student_id` text,
	`installment_id` text,
	`employee_id` text,
	`status` text DEFAULT 'validated' NOT NULL,
	`cancelled_by_txn` text,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `STUDENTS`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`installment_id`) REFERENCES `TUITION_INSTALLMENTS`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`employee_id`) REFERENCES `EMPLOYEES`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `USERS`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `transactions_created_at_idx` ON `TRANSACTIONS` (`created_at`);--> statement-breakpoint
CREATE INDEX `transactions_student_idx` ON `TRANSACTIONS` (`student_id`);--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `TRANSACTIONS` (`type`);--> statement-breakpoint
CREATE TABLE `TUITION_INSTALLMENTS` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`label` text NOT NULL,
	`amount` integer NOT NULL,
	`due_date` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `TUITION_SCHEDULES`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tuition_installments_schedule_idx` ON `TUITION_INSTALLMENTS` (`schedule_id`);--> statement-breakpoint
CREATE TABLE `TUITION_SCHEDULES` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`school_year_id` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `CLASSES`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`school_year_id`) REFERENCES `SCHOOL_YEARS`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tuition_schedules_class_year_unique` ON `TUITION_SCHEDULES` (`class_id`,`school_year_id`);--> statement-breakpoint
CREATE TABLE `USERS` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`last_login` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `USERS` (`username`);