-- AlterTable
ALTER TABLE "user_groups" ADD COLUMN     "last_accessed_trip_id" UUID;

-- CreateIndex
CREATE INDEX "idx_user_groups_last_trip" ON "user_groups"("last_accessed_trip_id");

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_last_accessed_trip_id_fkey" FOREIGN KEY ("last_accessed_trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
