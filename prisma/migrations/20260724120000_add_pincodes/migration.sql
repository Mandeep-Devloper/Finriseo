-- CreateTable
CREATE TABLE "pincodes" (
    "id" SERIAL NOT NULL,
    "pincode" VARCHAR(6) NOT NULL,
    "officeName" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "circle" TEXT,
    "region" TEXT,
    "division" TEXT,
    "taluk" TEXT,
    "officeType" TEXT,
    "deliveryStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pincodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pincodes_pincode_idx" ON "pincodes"("pincode");

-- CreateIndex
CREATE UNIQUE INDEX "pincodes_pincode_officeName_key" ON "pincodes"("pincode", "officeName");
