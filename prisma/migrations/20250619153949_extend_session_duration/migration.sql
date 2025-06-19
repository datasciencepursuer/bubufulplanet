-- AlterTable: Update default max_idle_time from 7 days (604800) to 21 days (1814400)
ALTER TABLE "device_sessions" ALTER COLUMN "max_idle_time" SET DEFAULT 1814400;