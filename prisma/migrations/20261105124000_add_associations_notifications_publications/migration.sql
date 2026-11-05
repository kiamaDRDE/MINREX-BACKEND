-- CreateEnum
CREATE TYPE "AssociationCategory" AS ENUM ('PROFESSIONAL', 'STUDENT', 'CULTURAL', 'COMMUNITY', 'ECONOMIC', 'SCIENTIFIC', 'REGIONAL', 'HUMANITARIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "AssociationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AssociationMemberRole" AS ENUM ('PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY_GENERAL', 'TREASURER', 'COMMUNICATION_OFFICER', 'AUDITOR', 'LEGAL_ADVISOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "AssociationHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED', 'ASSIGNED', 'REVIEW_STARTED', 'CORRECTION_REQUESTED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'REACTIVATED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CENSUS_STATUS', 'ASSISTANCE_STATUS', 'ASSOCIATION_STATUS', 'PUBLICATION_ALERT', 'MENTORSHIP_INVITE', 'SYSTEM_SECURITY');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PublicationType" AS ENUM ('OFFICIAL_ANNOUNCEMENT', 'CONSULAR_NOTICE', 'SUCCESS_STORY', 'ASSOCIATION_EVENT', 'OPPORTUNITY', 'COMMUNITY_ARTICLE');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_LEVEL1_REVIEW', 'PENDING_LEVEL2_APPROVAL', 'PUBLISHED', 'CORRECTION_REQUIRED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PublicationTargetScope" AS ENUM ('GLOBAL_PUBLIC', 'DIASPORA_VERIFIED', 'POST_RESTRICTED');

-- CreateEnum
CREATE TYPE "PublicationReviewLevel" AS ENUM ('LEVEL1_MODERATION', 'LEVEL2_FINAL_APPROVAL');

-- CreateEnum
CREATE TYPE "PublicationReviewDecision" AS ENUM ('VALIDATED_TO_LEVEL2', 'APPROVED_AND_PUBLISHED', 'CORRECTION_REQUESTED', 'REJECTED');

-- CreateTable
CREATE TABLE "associations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "acronym" VARCHAR(50),
    "category" "AssociationCategory" NOT NULL DEFAULT 'COMMUNITY',
    "description" TEXT NOT NULL,
    "objectives" TEXT,
    "creation_date" DATE,
    "country_id" UUID NOT NULL,
    "city" VARCHAR(150) NOT NULL,
    "address" VARCHAR(255),
    "postal_code" VARCHAR(30),
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "website_url" VARCHAR(255),
    "logo_url" VARCHAR(500),
    "diplomatic_post_id" UUID NOT NULL,
    "status" "AssociationStatus" NOT NULL DEFAULT 'DRAFT',
    "submission_date" TIMESTAMPTZ(3),
    "validated_at" TIMESTAMPTZ(3),
    "creator_id" UUID NOT NULL,
    "validated_by_id" UUID,
    "rejection_reason" TEXT,
    "suspension_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association_memberships" (
    "id" UUID NOT NULL,
    "association_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "AssociationMemberRole" NOT NULL DEFAULT 'MEMBER',
    "is_legal_representative" BOOLEAN NOT NULL DEFAULT false,
    "title" VARCHAR(100),
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "association_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association_documents" (
    "id" UUID NOT NULL,
    "association_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "file_key" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "association_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association_history" (
    "id" UUID NOT NULL,
    "association_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" "AssociationHistoryAction" NOT NULL,
    "from_status" "AssociationStatus",
    "to_status" "AssociationStatus",
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "association_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
    "title" VARCHAR(150) NOT NULL,
    "content" TEXT NOT NULL,
    "action_url" VARCHAR(255),
    "icon" VARCHAR(50),
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "metadata" JSONB DEFAULT '{}',
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "PublicationType" NOT NULL DEFAULT 'COMMUNITY_ARTICLE',
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "scope" "PublicationTargetScope" NOT NULL DEFAULT 'GLOBAL_PUBLIC',
    "cover_image_url" VARCHAR(500),
    "attachments" JSONB DEFAULT '[]',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "author_id" UUID NOT NULL,
    "diplomatic_post_id" UUID,
    "association_id" UUID,
    "published_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_review_history" (
    "id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "level" "PublicationReviewLevel" NOT NULL,
    "decision" "PublicationReviewDecision" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_review_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "associations_code_key" ON "associations"("code");

-- CreateIndex
CREATE INDEX "associations_country_id_idx" ON "associations"("country_id");

-- CreateIndex
CREATE INDEX "associations_diplomatic_post_id_idx" ON "associations"("diplomatic_post_id");

-- CreateIndex
CREATE INDEX "associations_status_idx" ON "associations"("status");

-- CreateIndex
CREATE INDEX "associations_category_idx" ON "associations"("category");

-- CreateIndex
CREATE INDEX "associations_creator_id_idx" ON "associations"("creator_id");

-- CreateIndex
CREATE INDEX "association_memberships_association_id_idx" ON "association_memberships"("association_id");

-- CreateIndex
CREATE INDEX "association_memberships_user_id_idx" ON "association_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "association_memberships_association_id_user_id_key" ON "association_memberships"("association_id", "user_id");

-- CreateIndex
CREATE INDEX "association_documents_association_id_idx" ON "association_documents"("association_id");

-- CreateIndex
CREATE INDEX "association_documents_uploaded_by_id_idx" ON "association_documents"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "association_history_association_id_idx" ON "association_history"("association_id");

-- CreateIndex
CREATE INDEX "association_history_actor_id_idx" ON "association_history"("actor_id");

-- CreateIndex
CREATE INDEX "association_history_action_idx" ON "association_history"("action");

-- CreateIndex
CREATE INDEX "association_history_created_at_idx" ON "association_history"("created_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_status_idx" ON "notifications"("recipient_id", "status");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_created_at_idx" ON "notifications"("recipient_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_type_key" ON "notification_preferences"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "publications_slug_key" ON "publications"("slug");

-- CreateIndex
CREATE INDEX "publications_status_idx" ON "publications"("status");

-- CreateIndex
CREATE INDEX "publications_type_idx" ON "publications"("type");

-- CreateIndex
CREATE INDEX "publications_scope_idx" ON "publications"("scope");

-- CreateIndex
CREATE INDEX "publications_author_id_idx" ON "publications"("author_id");

-- CreateIndex
CREATE INDEX "publications_diplomatic_post_id_idx" ON "publications"("diplomatic_post_id");

-- CreateIndex
CREATE INDEX "publications_association_id_idx" ON "publications"("association_id");

-- CreateIndex
CREATE INDEX "publications_published_at_idx" ON "publications"("published_at");

-- CreateIndex
CREATE INDEX "publications_is_featured_idx" ON "publications"("is_featured");

-- CreateIndex
CREATE INDEX "publication_review_history_publication_id_idx" ON "publication_review_history"("publication_id");

-- CreateIndex
CREATE INDEX "publication_review_history_reviewer_id_idx" ON "publication_review_history"("reviewer_id");

-- CreateIndex
CREATE INDEX "publication_review_history_created_at_idx" ON "publication_review_history"("created_at");

-- AddForeignKey
ALTER TABLE "associations" ADD CONSTRAINT "associations_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associations" ADD CONSTRAINT "associations_diplomatic_post_id_fkey" FOREIGN KEY ("diplomatic_post_id") REFERENCES "diplomatic_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associations" ADD CONSTRAINT "associations_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associations" ADD CONSTRAINT "associations_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_memberships" ADD CONSTRAINT "association_memberships_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_memberships" ADD CONSTRAINT "association_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_documents" ADD CONSTRAINT "association_documents_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_documents" ADD CONSTRAINT "association_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_history" ADD CONSTRAINT "association_history_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_history" ADD CONSTRAINT "association_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_diplomatic_post_id_fkey" FOREIGN KEY ("diplomatic_post_id") REFERENCES "diplomatic_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_review_history" ADD CONSTRAINT "publication_review_history_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_review_history" ADD CONSTRAINT "publication_review_history_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
