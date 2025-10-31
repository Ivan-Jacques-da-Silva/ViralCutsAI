CREATE TABLE IF NOT EXISTS "video_clips" (
  "id" text PRIMARY KEY NOT NULL,
  "video_id" text NOT NULL,
  "start_seconds" integer NOT NULL,
  "duration_seconds" integer NOT NULL,
  "reason" text,
  "reel_path" text,
  "horizontal_path" text,
  "subtitles_path" text,
  "created_at" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_video_clips_video_id" ON "video_clips" ("video_id");

-- Add foreign key with cascade
PRAGMA foreign_keys=OFF;
CREATE TABLE IF NOT EXISTS "_video_clips_new" (
  "id" text PRIMARY KEY NOT NULL,
  "video_id" text NOT NULL REFERENCES "videos"("id") ON DELETE CASCADE,
  "start_seconds" integer NOT NULL,
  "duration_seconds" integer NOT NULL,
  "reason" text,
  "reel_path" text,
  "horizontal_path" text,
  "subtitles_path" text,
  "created_at" integer NOT NULL
);
INSERT INTO "_video_clips_new" ("id","video_id","start_seconds","duration_seconds","reason","reel_path","horizontal_path","subtitles_path","created_at")
  SELECT "id","video_id","start_seconds","duration_seconds","reason","reel_path","horizontal_path","subtitles_path","created_at" FROM "video_clips";
DROP TABLE "video_clips";
ALTER TABLE "_video_clips_new" RENAME TO "video_clips";
PRAGMA foreign_keys=ON;
