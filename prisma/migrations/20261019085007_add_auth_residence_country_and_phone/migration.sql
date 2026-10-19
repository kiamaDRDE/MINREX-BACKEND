/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "countries" ADD COLUMN     "dialing_code" VARCHAR(10);

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "residence_country_id" UUID;

-- CreateIndex
CREATE INDEX "user_profiles_residence_country_id_idx" ON "user_profiles"("residence_country_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_residence_country_id_fkey" FOREIGN KEY ("residence_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
