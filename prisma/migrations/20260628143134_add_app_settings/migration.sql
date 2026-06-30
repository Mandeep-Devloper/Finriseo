-- CreateTable
CREATE TABLE "AppSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "businessName" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "address" TEXT,
    "defaultCommissionRate" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);
