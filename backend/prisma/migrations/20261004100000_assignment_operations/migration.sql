ALTER TABLE "Company"
ADD COLUMN "billingContactName" TEXT,
ADD COLUMN "billingContactEmail" TEXT,
ADD COLUMN "ownerEmployeeId" INTEGER;

CREATE UNIQUE INDEX "Company_ownerEmployeeId_key" ON "Company"("ownerEmployeeId");

ALTER TABLE "Company"
ADD CONSTRAINT "Company_ownerEmployeeId_fkey"
FOREIGN KEY ("ownerEmployeeId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Category"
ADD COLUMN "secret" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OptionGroup"
ADD COLUMN "usesPortions" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Option"
ADD COLUMN "costPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "OrderCombinationOption"
ADD COLUMN "portionNameSnapshot" TEXT,
ADD COLUMN "portionExtraPriceSnapshot" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "CompanyEmailDomain" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "domain" TEXT NOT NULL,
    CONSTRAINT "CompanyEmailDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyEmailDomain_domain_key" ON "CompanyEmailDomain"("domain");
CREATE INDEX "CompanyEmailDomain_companyId_idx" ON "CompanyEmailDomain"("companyId");
ALTER TABLE "CompanyEmailDomain"
ADD CONSTRAINT "CompanyEmailDomain_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CompanyAddress" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyAddress_companyId_isDefault_idx" ON "CompanyAddress"("companyId", "isDefault");
ALTER TABLE "CompanyAddress"
ADD CONSTRAINT "CompanyAddress_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CompanyCategoryRestriction" (
    "companyId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    CONSTRAINT "CompanyCategoryRestriction_pkey" PRIMARY KEY ("companyId", "categoryId")
);

ALTER TABLE "CompanyCategoryRestriction"
ADD CONSTRAINT "CompanyCategoryRestriction_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyCategoryRestriction"
ADD CONSTRAINT "CompanyCategoryRestriction_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CompanyDishRestriction" (
    "companyId" INTEGER NOT NULL,
    "dishId" INTEGER NOT NULL,
    CONSTRAINT "CompanyDishRestriction_pkey" PRIMARY KEY ("companyId", "dishId")
);

ALTER TABLE "CompanyDishRestriction"
ADD CONSTRAINT "CompanyDishRestriction_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyDishRestriction"
ADD CONSTRAINT "CompanyDishRestriction_dishId_fkey"
FOREIGN KEY ("dishId") REFERENCES "Dish"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OptionPortion" (
    "id" SERIAL NOT NULL,
    "optionGroupId" INTEGER NOT NULL,
    "optionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "extraPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT "OptionPortion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OptionPortion_optionGroupId_optionId_name_key"
ON "OptionPortion"("optionGroupId", "optionId", "name");
CREATE INDEX "OptionPortion_optionGroupId_optionId_idx"
ON "OptionPortion"("optionGroupId", "optionId");
ALTER TABLE "OptionPortion"
ADD CONSTRAINT "OptionPortion_optionGroupId_optionId_fkey"
FOREIGN KEY ("optionGroupId", "optionId")
REFERENCES "OptionGroupOption"("optionGroupId", "optionId")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OptionAllergen" (
    "optionId" INTEGER NOT NULL,
    "allergenId" INTEGER NOT NULL,
    CONSTRAINT "OptionAllergen_pkey" PRIMARY KEY ("optionId", "allergenId")
);

ALTER TABLE "OptionAllergen"
ADD CONSTRAINT "OptionAllergen_optionId_fkey"
FOREIGN KEY ("optionId") REFERENCES "Option"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OptionAllergen"
ADD CONSTRAINT "OptionAllergen_allergenId_fkey"
FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OptionDietaryTag" (
    "optionId" INTEGER NOT NULL,
    "dietaryTagId" INTEGER NOT NULL,
    CONSTRAINT "OptionDietaryTag_pkey" PRIMARY KEY ("optionId", "dietaryTagId")
);

ALTER TABLE "OptionDietaryTag"
ADD CONSTRAINT "OptionDietaryTag_optionId_fkey"
FOREIGN KEY ("optionId") REFERENCES "Option"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OptionDietaryTag"
ADD CONSTRAINT "OptionDietaryTag_dietaryTagId_fkey"
FOREIGN KEY ("dietaryTagId") REFERENCES "DietaryTag"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmployeeAllergen" (
    "employeeId" INTEGER NOT NULL,
    "allergenId" INTEGER NOT NULL,
    CONSTRAINT "EmployeeAllergen_pkey" PRIMARY KEY ("employeeId", "allergenId")
);

ALTER TABLE "EmployeeAllergen"
ADD CONSTRAINT "EmployeeAllergen_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeAllergen"
ADD CONSTRAINT "EmployeeAllergen_allergenId_fkey"
FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmployeeDietaryPreference" (
    "employeeId" INTEGER NOT NULL,
    "dietaryTagId" INTEGER NOT NULL,
    CONSTRAINT "EmployeeDietaryPreference_pkey" PRIMARY KEY ("employeeId", "dietaryTagId")
);

ALTER TABLE "EmployeeDietaryPreference"
ADD CONSTRAINT "EmployeeDietaryPreference_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeDietaryPreference"
ADD CONSTRAINT "EmployeeDietaryPreference_dietaryTagId_fkey"
FOREIGN KEY ("dietaryTagId") REFERENCES "DietaryTag"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
