CREATE TABLE "KitchenStationReference" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KitchenStationReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KitchenStationReference_name_key"
ON "KitchenStationReference"("name");

INSERT INTO "KitchenStationReference" ("name", "updatedAt")
VALUES
    ('GRILL', CURRENT_TIMESTAMP),
    ('COLD', CURRENT_TIMESTAMP),
    ('PASTRY', CURRENT_TIMESTAMP),
    ('UNASSIGNED', CURRENT_TIMESTAMP);

ALTER TABLE "Dish"
ALTER COLUMN "kitchenStation" TYPE TEXT
USING "kitchenStation"::TEXT;

ALTER TABLE "KitchenUnit"
ALTER COLUMN "kitchenStation" TYPE TEXT
USING "kitchenStation"::TEXT;

DROP TYPE "KitchenStation";

ALTER TABLE "Dish"
ADD CONSTRAINT "Dish_kitchenStation_fkey"
FOREIGN KEY ("kitchenStation") REFERENCES "KitchenStationReference"("name")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KitchenUnit"
ADD CONSTRAINT "KitchenUnit_kitchenStation_fkey"
FOREIGN KEY ("kitchenStation") REFERENCES "KitchenStationReference"("name")
ON DELETE RESTRICT ON UPDATE CASCADE;
