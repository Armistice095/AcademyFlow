ALTER TABLE `TRANSACTIONS` ADD `school_year_id` text REFERENCES SCHOOL_YEARS(id);--> statement-breakpoint
CREATE INDEX `transactions_school_year_idx` ON `TRANSACTIONS` (`school_year_id`);