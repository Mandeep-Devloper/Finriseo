-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "currentStep" TEXT NOT NULL DEFAULT 'otp_verified',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "panNumber" TEXT,
ADD COLUMN     "pinCode" TEXT,
ADD COLUMN     "salaryMode" TEXT,
ALTER COLUMN "employmentType" DROP NOT NULL,
ALTER COLUMN "monthlyIncome" DROP NOT NULL,
ALTER COLUMN "loanAmount" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'draft';
