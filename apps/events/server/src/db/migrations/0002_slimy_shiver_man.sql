CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `event_rsvps` (
	`event_uid` text NOT NULL,
	`user_did` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`event_uid`, `user_did`)
);
--> statement-breakpoint
CREATE INDEX `idx_event_rsvps_event` ON `event_rsvps` (`event_uid`);--> statement-breakpoint
CREATE TABLE `event_saves` (
	`event_uid` text NOT NULL,
	`user_did` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`event_uid`, `user_did`)
);
--> statement-breakpoint
CREATE INDEX `idx_event_saves_user` ON `event_saves` (`user_did`);--> statement-breakpoint
CREATE TABLE `events` (
	`uid` text PRIMARY KEY NOT NULL,
	`summary` text NOT NULL,
	`description` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`location` text,
	`geo` text,
	`organizer_name` text,
	`organizer_email` text,
	`luma_url` text,
	`status` text,
	`content_hash` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_starts_at` ON `events` (`starts_at`);