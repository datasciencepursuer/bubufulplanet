-- AlterTable
ALTER TABLE "user_groups" ADD COLUMN     "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "idx_user_groups_user_last_active" ON "user_groups"("user_id", "last_active_at");
