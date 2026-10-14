-- CreateEnum
CREATE TYPE "MentorshipRequestStatus" AS ENUM ('SUBMITTED', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MentorshipHistoryAction" AS ENUM ('CREATED', 'MATCHED', 'STARTED', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateTable
CREATE TABLE "mentorship_requests" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "requester_id" UUID NOT NULL,
    "mentor_id" UUID,
    "topic" VARCHAR(150) NOT NULL,
    "objectives" TEXT NOT NULL,
    "status" "MentorshipRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "matched_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mentorship_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorship_request_history" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" "MentorshipHistoryAction" NOT NULL,
    "from_status" "MentorshipRequestStatus",
    "to_status" "MentorshipRequestStatus",
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentorship_request_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mentorship_requests_reference_key" ON "mentorship_requests"("reference");

-- CreateIndex
CREATE INDEX "mentorship_requests_requester_id_idx" ON "mentorship_requests"("requester_id");

-- CreateIndex
CREATE INDEX "mentorship_requests_mentor_id_idx" ON "mentorship_requests"("mentor_id");

-- CreateIndex
CREATE INDEX "mentorship_requests_status_idx" ON "mentorship_requests"("status");

-- CreateIndex
CREATE INDEX "mentorship_requests_created_at_idx" ON "mentorship_requests"("created_at");

-- CreateIndex
CREATE INDEX "mentorship_request_history_request_id_idx" ON "mentorship_request_history"("request_id");

-- CreateIndex
CREATE INDEX "mentorship_request_history_actor_id_idx" ON "mentorship_request_history"("actor_id");

-- CreateIndex
CREATE INDEX "mentorship_request_history_action_idx" ON "mentorship_request_history"("action");

-- CreateIndex
CREATE INDEX "mentorship_request_history_created_at_idx" ON "mentorship_request_history"("created_at");

-- AddForeignKey
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_request_history" ADD CONSTRAINT "mentorship_request_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "mentorship_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_request_history" ADD CONSTRAINT "mentorship_request_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
