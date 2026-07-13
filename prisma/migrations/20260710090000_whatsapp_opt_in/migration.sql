-- WhatsApp-updates opt-in: a real, optional borrower choice (previously a
-- locked pre-ticked checkbox whose value was never stored). Nullable so
-- pre-existing rows read as "unknown" rather than a fabricated yes/no.
ALTER TABLE "Application" ADD COLUMN "whatsappOptIn" BOOLEAN;
