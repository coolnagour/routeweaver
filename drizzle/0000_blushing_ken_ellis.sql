CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`journey_id` text NOT NULL,
	`booking_server_id` integer,
	`stops` text NOT NULL,
	`customer_id` text,
	`external_booking_id` text,
	`vehicle_type` text,
	`external_area_code` text,
	`price` real,
	`cost` real,
	`instructions` text,
	`hold_on` integer DEFAULT false,
	`split_payment_settings` text,
	`metadata` text,
	`fields` text,
	`extras_config` text,
	`modified` integer DEFAULT false,
	FOREIGN KEY (`journey_id`) REFERENCES `journeys`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `journeys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`server_scope` text NOT NULL,
	`name` text,
	`journey_server_id` integer,
	`status` text DEFAULT 'Draft',
	`site_id` integer,
	`site_name` text,
	`site_ref` text,
	`account_id` integer,
	`account_name` text,
	`account_ref` text,
	`price` real,
	`cost` real,
	`enable_messaging_service` integer DEFAULT false,
	`driver_id` text,
	`driver_ref` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`uuid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`host` text NOT NULL,
	`api_path` text NOT NULL,
	`app_key` text NOT NULL,
	`secret_key` text NOT NULL,
	`company_id` text NOT NULL,
	`country_codes` text NOT NULL,
	`usage_count` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `template_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`stops` text NOT NULL,
	`customer_id` text,
	`external_booking_id` text,
	`vehicle_type` text,
	`external_area_code` text,
	`price` real,
	`cost` real,
	`instructions` text,
	`hold_on` integer DEFAULT false,
	`split_payment_settings` text,
	`metadata` text,
	`fields` text,
	`extras_config` text,
	`modified` integer DEFAULT false,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`server_scope` text NOT NULL,
	`name` text NOT NULL,
	`site_id` integer,
	`site_name` text,
	`site_ref` text,
	`account_id` integer,
	`account_name` text,
	`account_ref` text,
	`price` real,
	`cost` real,
	`enable_messaging_service` integer DEFAULT false,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`photo_url` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);