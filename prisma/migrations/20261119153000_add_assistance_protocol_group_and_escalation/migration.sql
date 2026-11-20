-- AlterEnum
ALTER TYPE "AssistanceHistoryAction" ADD VALUE IF NOT EXISTS 'NOTE_ADDED';
ALTER TYPE "AssistanceHistoryAction" ADD VALUE IF NOT EXISTS 'ESCALATED';

-- AlterTable: AssistanceCategory
ALTER TABLE "assistance_categories"
  ADD COLUMN IF NOT EXISTS "category_group" VARCHAR(80) NOT NULL DEFAULT 'Urgence & Détresse',
  ADD COLUMN IF NOT EXISTS "legal_notice" TEXT;

-- AlterTable: AssistanceCase
ALTER TABLE "assistance_cases"
  ADD COLUMN IF NOT EXISTS "current_step_number" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "escalated_to_central_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "escalated_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "escalation_reason" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assistance_categories_category_group_idx" ON "assistance_categories"("category_group");
CREATE INDEX IF NOT EXISTS "assistance_cases_category_id_idx" ON "assistance_cases"("category_id");
CREATE INDEX IF NOT EXISTS "assistance_cases_escalated_to_central_at_idx" ON "assistance_cases"("escalated_to_central_at");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assistance_cases_escalated_by_user_id_fkey'
  ) THEN
    ALTER TABLE "assistance_cases"
      ADD CONSTRAINT "assistance_cases_escalated_by_user_id_fkey"
      FOREIGN KEY ("escalated_by_user_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
