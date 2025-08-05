-- DropForeignKey
ALTER TABLE "expense_participants" DROP CONSTRAINT "expense_participants_participant_id_fkey";

-- CreateIndex
CREATE INDEX "idx_device_sessions_lookup" ON "device_sessions"("device_fingerprint", "group_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_device_sessions_cleanup" ON "device_sessions"("is_active", "expires_at");

-- CreateIndex
CREATE INDEX "idx_events_day_start_slot" ON "events"("day_id", "start_slot");

-- CreateIndex
CREATE INDEX "idx_expenses_group_trip" ON "expenses"("group_id", "trip_id");

-- CreateIndex
CREATE INDEX "idx_expenses_group_owner" ON "expenses"("group_id", "owner_id");

-- AddForeignKey
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
