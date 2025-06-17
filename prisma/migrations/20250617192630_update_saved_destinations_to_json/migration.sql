/*
  Warnings:

  - The `saved_destinations` column on the `travel_groups` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "travel_groups" DROP COLUMN "saved_destinations",
ADD COLUMN     "saved_destinations" JSONB;
