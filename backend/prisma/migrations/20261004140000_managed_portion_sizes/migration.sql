CREATE TABLE "PortionSizeReference" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortionSizeReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortionSizeReference_name_key"
ON "PortionSizeReference"("name");

INSERT INTO "PortionSizeReference" ("name", "updatedAt")
SELECT DISTINCT "name", CURRENT_TIMESTAMP
FROM "OptionPortion";

ALTER TABLE "OptionPortion"
ADD COLUMN "portionSizeId" INTEGER;

UPDATE "OptionPortion" AS portion
SET "portionSizeId" = size."id"
FROM "PortionSizeReference" AS size
WHERE size."name" = portion."name";

ALTER TABLE "OptionPortion"
ALTER COLUMN "portionSizeId" SET NOT NULL;

DROP INDEX "OptionPortion_optionGroupId_optionId_name_key";

ALTER TABLE "OptionPortion"
ADD CONSTRAINT "OptionPortion_portionSizeId_fkey"
FOREIGN KEY ("portionSizeId") REFERENCES "PortionSizeReference"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OptionPortion"
DROP COLUMN "name";

CREATE UNIQUE INDEX "OptionPortion_optionGroupId_optionId_portionSizeId_key"
ON "OptionPortion"("optionGroupId", "optionId", "portionSizeId");

CREATE INDEX "OptionPortion_portionSizeId_idx"
ON "OptionPortion"("portionSizeId");
