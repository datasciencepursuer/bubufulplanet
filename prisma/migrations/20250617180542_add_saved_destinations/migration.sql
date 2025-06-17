/*
  Warnings:

  - Made the column `start_date` on table `events` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `events` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "device_sessions" DROP CONSTRAINT "device_sessions_group_id_fkey";

-- DropForeignKey
ALTER TABLE "group_members" DROP CONSTRAINT "group_members_created_by_fkey";

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "start_date" SET NOT NULL,
ALTER COLUMN "color" SET NOT NULL;

-- AlterTable
ALTER TABLE "travel_groups" ADD COLUMN     "saved_destinations" TEXT;

-- RenameIndex
ALTER INDEX "unique_group_traveler" RENAME TO "group_members_group_id_traveler_name_key";
