-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "destination" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" VARCHAR(255) NOT NULL,
    "group_id" UUID,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "day_number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "day_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "location" VARCHAR(255),
    "notes" TEXT,
    "weather" VARCHAR(255),
    "loadout" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "color" VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    "start_slot" VARCHAR(5) NOT NULL,
    "end_slot" VARCHAR(5),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID,
    "day_id" UUID,
    "trip_id" UUID NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category" VARCHAR(100),
    "owner_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "packed" BOOLEAN NOT NULL DEFAULT false,
    "category" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packing_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "access_code" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "created_by_id" VARCHAR(255),

    CONSTRAINT "travel_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "traveler_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "user_id" VARCHAR(255),
    "role" VARCHAR(50) NOT NULL DEFAULT 'party member',
    "permissions" JSONB NOT NULL DEFAULT '{"read": true, "create": false, "modify": false}',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_of_interest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "destination_name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "link" TEXT,
    "group_id" UUID NOT NULL,
    "trip_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_of_interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expense_id" UUID NOT NULL,
    "participant_id" UUID,
    "external_participant_id" UUID,
    "external_name" VARCHAR(255),
    "split_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount_owed" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expense_id" UUID NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "category" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_item_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "line_item_id" UUID NOT NULL,
    "participant_id" UUID,
    "external_participant_id" UUID,
    "external_name" VARCHAR(255),
    "split_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount_owed" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_item_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(255) NOT NULL,
    "group_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_by" VARCHAR(255),

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_trips_user_id" ON "trips"("user_id");

-- CreateIndex
CREATE INDEX "idx_trips_dates" ON "trips"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "idx_trips_group_id" ON "trips"("group_id");

-- CreateIndex
CREATE INDEX "idx_trip_days_trip_id" ON "trip_days"("trip_id");

-- CreateIndex
CREATE INDEX "idx_trip_days_date" ON "trip_days"("date");

-- CreateIndex
CREATE INDEX "idx_trip_days_trip_id_day_number" ON "trip_days"("trip_id", "day_number");

-- CreateIndex
CREATE UNIQUE INDEX "trip_days_trip_id_day_number_key" ON "trip_days"("trip_id", "day_number");

-- CreateIndex
CREATE UNIQUE INDEX "trip_days_trip_id_date_key" ON "trip_days"("trip_id", "date");

-- CreateIndex
CREATE INDEX "idx_events_day_id" ON "events"("day_id");

-- CreateIndex
CREATE INDEX "idx_events_slots" ON "events"("start_slot", "end_slot");

-- CreateIndex
CREATE INDEX "idx_events_day_start_slot" ON "events"("day_id", "start_slot");

-- CreateIndex
CREATE INDEX "idx_expenses_day_id" ON "expenses"("day_id");

-- CreateIndex
CREATE INDEX "idx_expenses_event_id" ON "expenses"("event_id");

-- CreateIndex
CREATE INDEX "idx_expenses_trip_id" ON "expenses"("trip_id");

-- CreateIndex
CREATE INDEX "idx_expenses_owner_id" ON "expenses"("owner_id");

-- CreateIndex
CREATE INDEX "idx_expenses_group_id" ON "expenses"("group_id");

-- CreateIndex
CREATE INDEX "idx_expenses_group_trip" ON "expenses"("group_id", "trip_id");

-- CreateIndex
CREATE INDEX "idx_expenses_group_owner" ON "expenses"("group_id", "owner_id");

-- CreateIndex
CREATE INDEX "idx_packing_items_trip_id" ON "packing_items"("trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "travel_groups_access_code_key" ON "travel_groups"("access_code");

-- CreateIndex
CREATE INDEX "idx_travel_groups_access_code" ON "travel_groups"("access_code");

-- CreateIndex
CREATE INDEX "idx_travel_groups_created_by_id" ON "travel_groups"("created_by_id");

-- CreateIndex
CREATE INDEX "idx_group_members_group_id" ON "group_members"("group_id");

-- CreateIndex
CREATE INDEX "idx_group_members_group_traveler" ON "group_members"("group_id", "traveler_name");

-- CreateIndex
CREATE INDEX "idx_group_members_email" ON "group_members"("email");

-- CreateIndex
CREATE INDEX "idx_group_members_user_id" ON "group_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_traveler_name_key" ON "group_members"("group_id", "traveler_name");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_email_key" ON "group_members"("group_id", "email");

-- CreateIndex
CREATE INDEX "idx_points_of_interest_group_id" ON "points_of_interest"("group_id");

-- CreateIndex
CREATE INDEX "idx_points_of_interest_trip_id" ON "points_of_interest"("trip_id");

-- CreateIndex
CREATE INDEX "idx_expense_participants_expense_id" ON "expense_participants"("expense_id");

-- CreateIndex
CREATE INDEX "idx_expense_participants_participant_id" ON "expense_participants"("participant_id");

-- CreateIndex
CREATE INDEX "idx_expense_participants_external_participant_id" ON "expense_participants"("external_participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_participants_expense_id_participant_id_key" ON "expense_participants"("expense_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_participants_expense_id_external_name_key" ON "expense_participants"("expense_id", "external_name");

-- CreateIndex
CREATE INDEX "idx_external_participants_group_id" ON "external_participants"("group_id");

-- CreateIndex
CREATE INDEX "idx_external_participants_name" ON "external_participants"("name");

-- CreateIndex
CREATE INDEX "idx_external_participants_last_used" ON "external_participants"("last_used_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_participants_group_id_name_key" ON "external_participants"("group_id", "name");

-- CreateIndex
CREATE INDEX "idx_expense_line_items_expense_id" ON "expense_line_items"("expense_id");

-- CreateIndex
CREATE INDEX "idx_line_item_participants_line_item_id" ON "line_item_participants"("line_item_id");

-- CreateIndex
CREATE INDEX "idx_line_item_participants_participant_id" ON "line_item_participants"("participant_id");

-- CreateIndex
CREATE INDEX "idx_line_item_participants_external_participant_id" ON "line_item_participants"("external_participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "line_item_participants_line_item_id_participant_id_key" ON "line_item_participants"("line_item_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "line_item_participants_line_item_id_external_name_key" ON "line_item_participants"("line_item_id", "external_name");

-- CreateIndex
CREATE INDEX "idx_user_groups_user_id" ON "user_groups"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_groups_group_id" ON "user_groups"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_user_id_group_id_key" ON "user_groups"("user_id", "group_id");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "travel_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_days" ADD CONSTRAINT "trip_days_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "trip_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "trip_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "group_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_items" ADD CONSTRAINT "packing_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_groups" ADD CONSTRAINT "travel_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "travel_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_of_interest" ADD CONSTRAINT "points_of_interest_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "travel_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_of_interest" ADD CONSTRAINT "points_of_interest_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_external_participant_id_fkey" FOREIGN KEY ("external_participant_id") REFERENCES "external_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_participants" ADD CONSTRAINT "external_participants_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "travel_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_line_items" ADD CONSTRAINT "expense_line_items_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_item_participants" ADD CONSTRAINT "line_item_participants_line_item_id_fkey" FOREIGN KEY ("line_item_id") REFERENCES "expense_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_item_participants" ADD CONSTRAINT "line_item_participants_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_item_participants" ADD CONSTRAINT "line_item_participants_external_participant_id_fkey" FOREIGN KEY ("external_participant_id") REFERENCES "external_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "travel_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

