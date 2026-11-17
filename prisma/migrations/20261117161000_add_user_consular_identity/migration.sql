-- AlterTable
ALTER TABLE "users"
ADD COLUMN     "consular_identifier" VARCHAR(40),
ADD COLUMN     "consular_verified_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_consular_identifier_key" ON "users"("consular_identifier");

-- CreateIndex
CREATE INDEX "users_consular_identifier_idx" ON "users"("consular_identifier");
