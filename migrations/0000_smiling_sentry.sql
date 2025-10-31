CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"video_path" text NOT NULL,
	"source" text NOT NULL,
	"analysis" text,
	"clips" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
