-- Add the new text-based residence country column
ALTER TABLE "user_profiles"
ADD COLUMN "residence_country" VARCHAR(150);

-- Preserve existing residence country data
-- by converting the Country relation into the country name.
UPDATE "user_profiles" AS "up"
SET "residence_country" = "c"."name"
FROM "countries" AS "c"
WHERE "up"."residence_country_id" = "c"."id";

-- Remove the old foreign key relation
ALTER TABLE "user_profiles"
DROP CONSTRAINT "user_profiles_residence_country_id_fkey";

-- Remove the old index
DROP INDEX "user_profiles_residence_country_id_idx";

-- Remove the old UUID column
ALTER TABLE "user_profiles"
DROP COLUMN "residence_country_id";