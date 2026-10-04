/*
  Warnings:

  - A unique constraint covering the columns `[orderCombinationId]` on the table `KitchenUnit` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "KitchenUnit_orderCombinationId_idx";

-- CreateIndex
CREATE INDEX "KitchenUnit_kitchenStation_status_idx" ON "KitchenUnit"("kitchenStation", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenUnit_orderCombinationId_key" ON "KitchenUnit"("orderCombinationId");
