/*
  Warnings:

  - You are about to drop the column `last_accessed_trip_id` on the `user_groups` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_groups" DROP CONSTRAINT "user_groups_last_accessed_trip_id_fkey";

-- DropIndex
DROP INDEX "idx_user_groups_last_trip";

-- AlterTable
ALTER TABLE "user_groups" DROP COLUMN "last_accessed_trip_id",
ADD COLUMN     "last_active_trip_id" UUID;

-- CreateIndex
CREATE INDEX "idx_user_groups_last_active_trip" ON "user_groups"("last_active_trip_id");

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_last_active_trip_id_fkey" FOREIGN KEY ("last_active_trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
