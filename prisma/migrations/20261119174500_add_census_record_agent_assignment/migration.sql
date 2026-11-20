-- AlterTable: CensusRecord agent assignment (Option A)
ALTER TABLE "census_records"
  ADD COLUMN IF NOT EXISTS "assigned_to_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "census_records_assigned_to_user_id_idx"
  ON "census_records"("assigned_to_user_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'census_records_assigned_to_user_id_fkey'
  ) THEN
    ALTER TABLE "census_records"
      ADD CONSTRAINT "census_records_assigned_to_user_id_fkey"
      FOREIGN KEY ("assigned_to_user_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;