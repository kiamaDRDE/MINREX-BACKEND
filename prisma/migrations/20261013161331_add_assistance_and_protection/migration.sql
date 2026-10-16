-- CreateEnum
CREATE TYPE "AssistanceCaseStatus" AS ENUM ('SUBMITTED', 'QUALIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssistanceUrgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AssistanceType" AS ENUM ('DOCUMENT_LOSS', 'ARREST_DETENTION', 'ACCIDENT', 'MEDICAL_EMERGENCY', 'VIOLENCE_ABUSE', 'REPATRIATION', 'DEATH', 'LEGAL_ASSISTANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssistanceHistoryAction" AS ENUM ('CREATED', 'QUALIFIED', 'ASSIGNED', 'STATUS_CHANGED', 'UPDATED', 'RESOLVED', 'CLOSED', 'REJECTED');

-- CreateTable
CREATE TABLE "assistance_cases" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "requester_id" UUID NOT NULL,
    "type" "AssistanceType" NOT NULL,
    "urgency" "AssistanceUrgency" NOT NULL DEFAULT 'NORMAL',
    "status" "AssistanceCaseStatus" NOT NULL DEFAULT 'SUBMITTED',
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "country_id" UUID NOT NULL,
    "city" VARCHAR(150),
    "address" VARCHAR(255),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(30),
    "assigned_post_id" UUID NOT NULL,
    "routed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_to_user_id" UUID,
    "assigned_at" TIMESTAMPTZ(3),
    "resolution_summary" TEXT,
    "resolved_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assistance_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistance_case_history" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" "AssistanceHistoryAction" NOT NULL,
    "from_status" "AssistanceCaseStatus",
    "to_status" "AssistanceCaseStatus",
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistance_case_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assistance_cases_reference_key" ON "assistance_cases"("reference");

-- CreateIndex
CREATE INDEX "assistance_cases_requester_id_idx" ON "assistance_cases"("requester_id");

-- CreateIndex
CREATE INDEX "assistance_cases_assigned_post_id_idx" ON "assistance_cases"("assigned_post_id");

-- CreateIndex
CREATE INDEX "assistance_cases_assigned_to_user_id_idx" ON "assistance_cases"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "assistance_cases_country_id_idx" ON "assistance_cases"("country_id");

-- CreateIndex
CREATE INDEX "assistance_cases_status_idx" ON "assistance_cases"("status");

-- CreateIndex
CREATE INDEX "assistance_cases_urgency_idx" ON "assistance_cases"("urgency");

-- CreateIndex
CREATE INDEX "assistance_cases_created_at_idx" ON "assistance_cases"("created_at");

-- CreateIndex
CREATE INDEX "assistance_case_history_case_id_idx" ON "assistance_case_history"("case_id");

-- CreateIndex
CREATE INDEX "assistance_case_history_actor_id_idx" ON "assistance_case_history"("actor_id");

-- CreateIndex
CREATE INDEX "assistance_case_history_action_idx" ON "assistance_case_history"("action");

-- CreateIndex
CREATE INDEX "assistance_case_history_created_at_idx" ON "assistance_case_history"("created_at");

-- AddForeignKey
ALTER TABLE "assistance_cases" ADD CONSTRAINT "assistance_cases_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistance_cases" ADD CONSTRAINT "assistance_cases_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistance_cases" ADD CONSTRAINT "assistance_cases_assigned_post_id_fkey" FOREIGN KEY ("assigned_post_id") REFERENCES "diplomatic_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistance_cases" ADD CONSTRAINT "assistance_cases_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistance_case_history" ADD CONSTRAINT "assistance_case_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assistance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistance_case_history" ADD CONSTRAINT "assistance_case_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
