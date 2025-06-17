-- CreateTable
CREATE TABLE "travel_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "access_code" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "travel_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "traveler_name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'party member',
    "permissions" JSONB NOT NULL DEFAULT '{"read": true, "create": false, "modify": false}',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_fingerprint" VARCHAR(255) NOT NULL,
    "group_id" UUID NOT NULL,
    "traveler_name" VARCHAR(255) NOT NULL,
    "session_data" JSONB,
    "user_agent" TEXT,
    "ip_address" VARCHAR(45),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- Add group_id to trips table if not exists
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "group_id" UUID;

-- CreateUniqueIndex
CREATE UNIQUE INDEX "travel_groups_access_code_key" ON "travel_groups"("access_code");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "unique_group_traveler" ON "group_members"("group_id", "traveler_name");

-- CreateIndex
CREATE INDEX "idx_travel_groups_access_code" ON "travel_groups"("access_code");

-- CreateIndex
CREATE INDEX "idx_group_members_group_id" ON "group_members"("group_id");

-- CreateIndex
CREATE INDEX "idx_group_members_group_traveler" ON "group_members"("group_id", "traveler_name");

-- CreateIndex
CREATE INDEX "idx_trips_group_id" ON "trips"("group_id");

-- CreateIndex
CREATE INDEX "idx_device_sessions_fingerprint" ON "device_sessions"("device_fingerprint");

-- CreateIndex
CREATE INDEX "idx_device_sessions_group_id" ON "device_sessions"("group_id");

-- CreateIndex
CREATE INDEX "idx_device_sessions_active" ON "device_sessions"("is_active");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "travel_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "travel_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_groups" ADD CONSTRAINT "travel_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "travel_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;