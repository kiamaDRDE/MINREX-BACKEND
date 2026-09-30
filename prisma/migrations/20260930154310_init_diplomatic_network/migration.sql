-- CreateEnum
CREATE TYPE "DiplomaticPostStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL,
    "iso2_code" CHAR(2) NOT NULL,
    "iso3_code" CHAR(3) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "min_coverage_count" INTEGER NOT NULL DEFAULT 0,
    "max_coverage_count" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "post_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diplomatic_posts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type_id" UUID NOT NULL,
    "status" "DiplomaticPostStatus" NOT NULL DEFAULT 'ACTIVE',
    "host_country_id" UUID,
    "city" VARCHAR(150),
    "address" VARCHAR(255),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "opened_at" DATE,
    "closed_at" DATE,
    "parent_post_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "diplomatic_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_coverages" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "competence_nature" VARCHAR(100),
    "start_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "post_coverages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "service_type" VARCHAR(100),
    "description" TEXT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso2_code_key" ON "countries"("iso2_code");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso3_code_key" ON "countries"("iso3_code");

-- CreateIndex
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");

-- CreateIndex
CREATE INDEX "countries_is_active_idx" ON "countries"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "post_types_code_key" ON "post_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "post_types_name_key" ON "post_types"("name");

-- CreateIndex
CREATE INDEX "post_types_is_active_idx" ON "post_types"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "diplomatic_posts_code_key" ON "diplomatic_posts"("code");

-- CreateIndex
CREATE INDEX "diplomatic_posts_type_id_idx" ON "diplomatic_posts"("type_id");

-- CreateIndex
CREATE INDEX "diplomatic_posts_host_country_id_idx" ON "diplomatic_posts"("host_country_id");

-- CreateIndex
CREATE INDEX "diplomatic_posts_parent_post_id_idx" ON "diplomatic_posts"("parent_post_id");

-- CreateIndex
CREATE INDEX "diplomatic_posts_status_idx" ON "diplomatic_posts"("status");

-- CreateIndex
CREATE INDEX "diplomatic_posts_name_idx" ON "diplomatic_posts"("name");

-- CreateIndex
CREATE INDEX "post_coverages_post_id_idx" ON "post_coverages"("post_id");

-- CreateIndex
CREATE INDEX "post_coverages_country_id_idx" ON "post_coverages"("country_id");

-- CreateIndex
CREATE INDEX "post_coverages_country_id_end_date_idx" ON "post_coverages"("country_id", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "post_coverages_post_id_country_id_start_date_key" ON "post_coverages"("post_id", "country_id", "start_date");

-- CreateIndex
CREATE INDEX "services_post_id_idx" ON "services"("post_id");

-- CreateIndex
CREATE INDEX "services_status_idx" ON "services"("status");

-- CreateIndex
CREATE INDEX "services_name_idx" ON "services"("name");

-- CreateIndex
CREATE UNIQUE INDEX "services_post_id_code_key" ON "services"("post_id", "code");

-- AddForeignKey
ALTER TABLE "diplomatic_posts" ADD CONSTRAINT "diplomatic_posts_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "post_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diplomatic_posts" ADD CONSTRAINT "diplomatic_posts_host_country_id_fkey" FOREIGN KEY ("host_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diplomatic_posts" ADD CONSTRAINT "diplomatic_posts_parent_post_id_fkey" FOREIGN KEY ("parent_post_id") REFERENCES "diplomatic_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_coverages" ADD CONSTRAINT "post_coverages_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "diplomatic_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_coverages" ADD CONSTRAINT "post_coverages_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "diplomatic_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
