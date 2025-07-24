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

-- AddForeignKey
ALTER TABLE "expense_line_items" ADD CONSTRAINT "expense_line_items_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_item_participants" ADD CONSTRAINT "line_item_participants_line_item_id_fkey" FOREIGN KEY ("line_item_id") REFERENCES "expense_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_item_participants" ADD CONSTRAINT "line_item_participants_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_item_participants" ADD CONSTRAINT "line_item_participants_external_participant_id_fkey" FOREIGN KEY ("external_participant_id") REFERENCES "external_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;