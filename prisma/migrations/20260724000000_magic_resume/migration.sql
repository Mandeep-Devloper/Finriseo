-- Extend Application with Magic Resume columns
ALTER TABLE "Application" ADD COLUMN "currentRoute" TEXT;
ALTER TABLE "Application" ADD COLUMN "progressPct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Application" ADD COLUMN "completedSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Application" ADD COLUMN "draftData" JSONB;
ALTER TABLE "Application" ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Application" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "Application_lastActivityAt_idx" ON "Application"("lastActivityAt");

-- TrustedSession
CREATE TABLE "TrustedSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiry" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "TrustedSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrustedSession_tokenHash_key" ON "TrustedSession"("tokenHash");
CREATE INDEX "TrustedSession_mobile_idx" ON "TrustedSession"("mobile");
CREATE INDEX "TrustedSession_expiresAt_idx" ON "TrustedSession"("expiresAt");
CREATE INDEX "TrustedSession_applicationId_idx" ON "TrustedSession"("applicationId");

ALTER TABLE "TrustedSession" ADD CONSTRAINT "TrustedSession_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
