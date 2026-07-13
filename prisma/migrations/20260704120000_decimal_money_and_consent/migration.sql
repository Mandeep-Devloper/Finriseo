-- Money & rate columns: Float (double precision) -> exact DECIMAL.
-- Storing money as binary float allows rounding drift in sums/commission; DECIMAL
-- is exact. The USING casts preserve every existing value.

-- ── Application: money columns ──────────────────────────────────────────────
ALTER TABLE "Application"
  ALTER COLUMN "monthlyIncome"   TYPE DECIMAL(14,2) USING "monthlyIncome"::decimal(14,2),
  ALTER COLUMN "loanAmount"      TYPE DECIMAL(14,2) USING "loanAmount"::decimal(14,2),
  ALTER COLUMN "disbursedAmount" TYPE DECIMAL(14,2) USING "disbursedAmount"::decimal(14,2);

-- ── Application: consent capture (audit-grade proof of agreement) ────────────
ALTER TABLE "Application"
  ADD COLUMN "consentAt"        TIMESTAMP(3),
  ADD COLUMN "consentVersion"   TEXT,
  ADD COLUMN "consentIp"        TEXT,
  ADD COLUMN "consentUserAgent" TEXT;

-- ── Lender: rate & money columns ────────────────────────────────────────────
ALTER TABLE "Lender"
  ALTER COLUMN "interestRate"    TYPE DECIMAL(6,3)  USING "interestRate"::decimal(6,3);

ALTER TABLE "Lender"
  ALTER COLUMN "minIncome"       DROP DEFAULT,
  ALTER COLUMN "minIncome"       TYPE DECIMAL(14,2) USING "minIncome"::decimal(14,2),
  ALTER COLUMN "minIncome"       SET DEFAULT 0;

ALTER TABLE "Lender"
  ALTER COLUMN "maxMultiplier"   DROP DEFAULT,
  ALTER COLUMN "maxMultiplier"   TYPE DECIMAL(6,3)  USING "maxMultiplier"::decimal(6,3),
  ALTER COLUMN "maxMultiplier"   SET DEFAULT 10;

ALTER TABLE "Lender"
  ALTER COLUMN "interestRateMax" TYPE DECIMAL(6,3)  USING "interestRateMax"::decimal(6,3),
  ALTER COLUMN "minAmount"       TYPE DECIMAL(14,2) USING "minAmount"::decimal(14,2),
  ALTER COLUMN "maxAmount"       TYPE DECIMAL(14,2) USING "maxAmount"::decimal(14,2),
  ALTER COLUMN "maxFoir"         TYPE DECIMAL(6,3)  USING "maxFoir"::decimal(6,3),
  ALTER COLUMN "commissionRate"  TYPE DECIMAL(6,3)  USING "commissionRate"::decimal(6,3);

-- ── AppSetting ──────────────────────────────────────────────────────────────
ALTER TABLE "AppSetting"
  ALTER COLUMN "defaultCommissionRate" TYPE DECIMAL(6,3) USING "defaultCommissionRate"::decimal(6,3);
