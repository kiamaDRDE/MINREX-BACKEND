-- CreateEnum: TalentApplicationStatus
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'TalentApplicationStatus'
  ) THEN
    CREATE TYPE "TalentApplicationStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- AlterTable: CensusRecord talent application workflow
ALTER TABLE "census_records"
  ADD COLUMN IF NOT EXISTS "talent_status" "TalentApplicationStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "talent_submitted_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "talent_reviewed_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "talent_reviewed_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "talent_rejection_reason" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "census_records_talent_status_idx"
  ON "census_records"("talent_status");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'census_records_talent_reviewed_by_id_fkey'
  ) THEN
    ALTER TABLE "census_records"
      ADD CONSTRAINT "census_records_talent_reviewed_by_id_fkey"
      FOREIGN KEY ("talent_reviewed_by_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill existing records so previously verified directory experts remain visible
UPDATE "census_records"
SET
  "talent_status" = 'APPROVED',
  "talent_submitted_at" = COALESCE("talent_submitted_at", "submitted_at", "updated_at"),
  "talent_reviewed_at" = COALESCE("talent_reviewed_at", "verified_at", "updated_at")
WHERE "status" = 'VERIFIED'
  AND "opt_in_talent_directory" = true
  AND "talent_status" = 'NONE';

UPDATE "census_records"
SET
  "talent_status" = 'PENDING',
  "talent_submitted_at" = COALESCE("talent_submitted_at", "updated_at")
WHERE "status" NOT IN ('VERIFIED', 'REJECTED')
  AND "opt_in_talent_directory" = true
  AND "talent_status" = 'NONE';
