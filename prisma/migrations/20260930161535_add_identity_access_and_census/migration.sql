-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('FR', 'EN');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('GLOBAL', 'POST', 'SERVICE');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "VerificationTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'MFA_OTP');

-- CreateEnum
CREATE TYPE "CensusStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "ResidenceStatus" AS ENUM ('CITIZEN', 'PERMANENT_RESIDENT', 'WORKER', 'STUDENT', 'REFUGEE_ASYLUM_SEEKER', 'TEMPORARY_RESIDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DepartureReason" AS ENUM ('STUDIES', 'WORK', 'FAMILY_REUNIFICATION', 'BUSINESS', 'PROTECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('EMPLOYED', 'ENTREPRENEUR', 'SELF_EMPLOYED', 'STUDENT', 'UNEMPLOYED', 'RETIRED', 'OTHER');

-- CreateEnum
CREATE TYPE "CensusDocumentType" AS ENUM ('IDENTITY_DOCUMENT', 'RESIDENCE_PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "CensusDocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CensusReviewDecision" AS ENUM ('VERIFIED', 'CORRECTION_REQUIRED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(30),
    "password_hash" VARCHAR(255),
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "email_verified_at" TIMESTAMPTZ(3),
    "phone_verified_at" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200),
    "photo_url" VARCHAR(500),
    "preferred_language" "PreferredLanguage" NOT NULL DEFAULT 'FR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "scope" "RoleScope" NOT NULL DEFAULT 'GLOBAL',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "post_id" UUID,
    "service_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_post_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "service_id" UUID,
    "job_title" VARCHAR(150),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_post_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "VerificationTokenType" NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "census_records" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "CensusStatus" NOT NULL DEFAULT 'DRAFT',
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "birth_date" DATE,
    "birth_place" VARCHAR(150),
    "nationality_country_id" UUID,
    "email" VARCHAR(255),
    "primary_phone" VARCHAR(30),
    "secondary_phone" VARCHAR(30),
    "preferred_contact_channel" "ContactChannel",
    "residence_country_id" UUID,
    "residence_city" VARCHAR(150),
    "residence_address" VARCHAR(255),
    "residence_postal_code" VARCHAR(30),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "residence_since_year" INTEGER,
    "residence_status" "ResidenceStatus",
    "cameroon_region" VARCHAR(100),
    "cameroon_city" VARCHAR(150),
    "last_cameroon_address" VARCHAR(255),
    "departure_year" INTEGER,
    "departure_reason" "DepartureReason",
    "marital_status" "MaritalStatus",
    "dependants_count" INTEGER,
    "employment_status" "EmploymentStatus",
    "profession" VARCHAR(150),
    "job_title" VARCHAR(150),
    "sector" VARCHAR(150),
    "employer" VARCHAR(200),
    "years_experience" INTEGER,
    "expertise_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qualifications" TEXT,
    "opt_in_talent_directory" BOOLEAN NOT NULL DEFAULT false,
    "assigned_post_id" UUID,
    "routed_at" TIMESTAMPTZ(3),
    "declared_accurate" BOOLEAN NOT NULL DEFAULT false,
    "consent_data_processing" BOOLEAN NOT NULL DEFAULT false,
    "privacy_notice_accepted" BOOLEAN NOT NULL DEFAULT false,
    "submitted_at" TIMESTAMPTZ(3),
    "verified_at" TIMESTAMPTZ(3),
    "rejected_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "census_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "census_documents" (
    "id" UUID NOT NULL,
    "census_record_id" UUID NOT NULL,
    "type" "CensusDocumentType" NOT NULL,
    "status" "CensusDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "document_number" VARCHAR(100),
    "issuing_country" VARCHAR(150),
    "issue_date" DATE,
    "expiry_date" DATE,
    "storage_key" VARCHAR(500) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100),
    "size_bytes" INTEGER,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "census_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "census_reviews" (
    "id" UUID NOT NULL,
    "census_record_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "decision" "CensusReviewDecision" NOT NULL,
    "comment" TEXT,
    "correction_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "census_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "census_status_history" (
    "id" UUID NOT NULL,
    "census_record_id" UUID NOT NULL,
    "from_status" "CensusStatus",
    "to_status" "CensusStatus" NOT NULL,
    "changed_by_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "census_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_profiles_last_name_first_name_idx" ON "user_profiles"("last_name", "first_name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_scope_idx" ON "roles"("scope");

-- CreateIndex
CREATE INDEX "roles_is_active_idx" ON "roles"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_user_id_idx" ON "user_role_assignments"("user_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_role_id_idx" ON "user_role_assignments"("role_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_post_id_idx" ON "user_role_assignments"("post_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_service_id_idx" ON "user_role_assignments"("service_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_user_id_is_active_idx" ON "user_role_assignments"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "user_post_assignments_user_id_idx" ON "user_post_assignments"("user_id");

-- CreateIndex
CREATE INDEX "user_post_assignments_post_id_idx" ON "user_post_assignments"("post_id");

-- CreateIndex
CREATE INDEX "user_post_assignments_service_id_idx" ON "user_post_assignments"("service_id");

-- CreateIndex
CREATE INDEX "user_post_assignments_status_idx" ON "user_post_assignments"("status");

-- CreateIndex
CREATE INDEX "user_post_assignments_user_id_status_idx" ON "user_post_assignments"("user_id", "status");

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_idx" ON "verification_tokens"("user_id");

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_type_idx" ON "verification_tokens"("user_id", "type");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_at_idx" ON "verification_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "census_records_reference_key" ON "census_records"("reference");

-- CreateIndex
CREATE INDEX "census_records_user_id_idx" ON "census_records"("user_id");

-- CreateIndex
CREATE INDEX "census_records_user_id_status_idx" ON "census_records"("user_id", "status");

-- CreateIndex
CREATE INDEX "census_records_status_idx" ON "census_records"("status");

-- CreateIndex
CREATE INDEX "census_records_residence_country_id_idx" ON "census_records"("residence_country_id");

-- CreateIndex
CREATE INDEX "census_records_assigned_post_id_idx" ON "census_records"("assigned_post_id");

-- CreateIndex
CREATE INDEX "census_documents_census_record_id_idx" ON "census_documents"("census_record_id");

-- CreateIndex
CREATE INDEX "census_documents_type_idx" ON "census_documents"("type");

-- CreateIndex
CREATE INDEX "census_documents_status_idx" ON "census_documents"("status");

-- CreateIndex
CREATE INDEX "census_reviews_census_record_id_idx" ON "census_reviews"("census_record_id");

-- CreateIndex
CREATE INDEX "census_reviews_reviewer_id_idx" ON "census_reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "census_reviews_decision_idx" ON "census_reviews"("decision");

-- CreateIndex
CREATE INDEX "census_status_history_census_record_id_idx" ON "census_status_history"("census_record_id");

-- CreateIndex
CREATE INDEX "census_status_history_changed_by_id_idx" ON "census_status_history"("changed_by_id");

-- CreateIndex
CREATE INDEX "census_status_history_to_status_idx" ON "census_status_history"("to_status");

-- CreateIndex
CREATE INDEX "census_status_history_created_at_idx" ON "census_status_history"("created_at");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "diplomatic_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_post_assignments" ADD CONSTRAINT "user_post_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_post_assignments" ADD CONSTRAINT "user_post_assignments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "diplomatic_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_post_assignments" ADD CONSTRAINT "user_post_assignments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "census_records" ADD CONSTRAINT "census_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "census_records" ADD CONSTRAINT "census_records_nationality_country_id_fkey" FOREIGN KEY ("nationality_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "census_records" ADD CONSTRAINT "census_records_residence_country_id_fkey" FOREIGN KEY ("residence_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "census_records" ADD CONSTRAINT "census_records_assigned_post_id_fkey" FOREIGN KEY ("assigned_post_id") REFERENCES "diplomatic_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "census_documents" ADD CONSTRAINT "census_documents_census_record_id_fkey" FOREIGN KEY ("census_record_id") REFERENCES "census_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "census_reviews" ADD CONSTRAINT "census_reviews_census_record_id_fkey" FOREIGN KEY ("census_record_id") REFERENCES "census_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "census_reviews" ADD CONSTRAINT "census_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "census_status_history" ADD CONSTRAINT "census_status_history_census_record_id_fkey" FOREIGN KEY ("census_record_id") REFERENCES "census_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "census_status_history" ADD CONSTRAINT "census_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
