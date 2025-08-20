-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "split_type" VARCHAR(20) NOT NULL DEFAULT 'equal';

-- CreateTable
CREATE TABLE "participant_itemized_lists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expense_id" UUID NOT NULL,
    "participant_id" UUID,
    "external_participant_id" UUID,
    "external_name" VARCHAR(255),
    "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "split_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_itemized_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "participant_list_id" UUID NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "category" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_participant_itemized_lists_expense_id" ON "participant_itemized_lists"("expense_id");

-- CreateIndex
CREATE INDEX "idx_participant_itemized_lists_participant_id" ON "participant_itemized_lists"("participant_id");

-- CreateIndex
CREATE INDEX "idx_participant_itemized_lists_external_participant_id" ON "participant_itemized_lists"("external_participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "participant_itemized_lists_expense_id_participant_id_key" ON "participant_itemized_lists"("expense_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "participant_itemized_lists_expense_id_external_name_key" ON "participant_itemized_lists"("expense_id", "external_name");

-- CreateIndex
CREATE INDEX "idx_participant_items_list_id" ON "participant_items"("participant_list_id");

-- CreateIndex
CREATE INDEX "idx_expenses_split_type" ON "expenses"("split_type");

-- AddForeignKey
ALTER TABLE "participant_itemized_lists" ADD CONSTRAINT "participant_itemized_lists_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_itemized_lists" ADD CONSTRAINT "participant_itemized_lists_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_itemized_lists" ADD CONSTRAINT "participant_itemized_lists_external_participant_id_fkey" FOREIGN KEY ("external_participant_id") REFERENCES "external_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_items" ADD CONSTRAINT "participant_items_participant_list_id_fkey" FOREIGN KEY ("participant_list_id") REFERENCES "participant_itemized_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
