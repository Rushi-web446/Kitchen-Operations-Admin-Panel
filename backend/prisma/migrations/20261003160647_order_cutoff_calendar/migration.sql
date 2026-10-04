-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "deliveryMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "deliveryWorkingDays" "Weekday"[] DEFAULT ARRAY['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']::"Weekday"[];

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cutoffAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "KitchenCalendarConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cutoffWorkingDays" INTEGER NOT NULL DEFAULT 2,
    "cutoffTime" TIME(6) NOT NULL,
    "workingDays" "Weekday"[] DEFAULT ARRAY['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']::"Weekday"[],

    CONSTRAINT "KitchenCalendarConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenHoliday" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "calendarId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "KitchenHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyHoliday" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,

    CONSTRAINT "CompanyHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KitchenHoliday_date_idx" ON "KitchenHoliday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenHoliday_calendarId_date_key" ON "KitchenHoliday"("calendarId", "date");

-- CreateIndex
CREATE INDEX "CompanyHoliday_date_idx" ON "CompanyHoliday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyHoliday_companyId_date_key" ON "CompanyHoliday"("companyId", "date");

-- CreateIndex
CREATE INDEX "Order_status_cutoffAt_idx" ON "Order"("status", "cutoffAt");

-- AddForeignKey
ALTER TABLE "KitchenHoliday" ADD CONSTRAINT "KitchenHoliday_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "KitchenCalendarConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyHoliday" ADD CONSTRAINT "CompanyHoliday_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
