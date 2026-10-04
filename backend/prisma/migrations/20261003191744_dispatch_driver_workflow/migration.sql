/*
  Warnings:

  - A unique constraint covering the columns `[companyId,deliveryDate,deliveryAddressKey,deliveryTime]` on the table `DeliveryDrop` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `deliveryAddressKey` to the `DeliveryDrop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deliveryDate` to the `DeliveryDrop` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "DeliveryDropStatus" ADD VALUE 'DISPATCH_READY';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "defaultDriverId" INTEGER;

-- AlterTable
ALTER TABLE "DeliveryDrop" ADD COLUMN     "deliveryAddressKey" TEXT NOT NULL,
ADD COLUMN     "deliveryDate" DATE NOT NULL,
ADD COLUMN     "outForDeliveryAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Company_defaultDriverId_idx" ON "Company"("defaultDriverId");

-- CreateIndex
CREATE INDEX "DeliveryDrop_driverId_deliveryDate_deliveryTime_idx" ON "DeliveryDrop"("driverId", "deliveryDate", "deliveryTime");

-- CreateIndex
CREATE INDEX "DeliveryDrop_status_deliveryDate_deliveryTime_idx" ON "DeliveryDrop"("status", "deliveryDate", "deliveryTime");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDrop_companyId_deliveryDate_deliveryAddressKey_deli_key" ON "DeliveryDrop"("companyId", "deliveryDate", "deliveryAddressKey", "deliveryTime");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_defaultDriverId_fkey" FOREIGN KEY ("defaultDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
