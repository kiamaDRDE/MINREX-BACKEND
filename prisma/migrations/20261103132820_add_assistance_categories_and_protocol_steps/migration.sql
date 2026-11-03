-- AlterTable
ALTER TABLE "assistance_cases" ADD COLUMN     "category_id" UUID;

-- CreateTable
CREATE TABLE "assistance_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "short_name" VARCHAR(100),
    "description" TEXT,
    "icon" VARCHAR(50),
    "badge_color" VARCHAR(50),
    "default_urgency" "AssistanceUrgency" NOT NULL DEFAULT 'NORMAL',
    "default_sla_hours" INTEGER NOT NULL DEFAULT 24,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assistance_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistance_protocol_steps" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL,
    "recommended_delay" VARCHAR(50),
    "responsible_role" VARCHAR(100),
    "required_docs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assistance_protocol_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assistance_categories_code_key" ON "assistance_categories"("code");

-- CreateIndex
CREATE INDEX "assistance_categories_code_idx" ON "assistance_categories"("code");

-- CreateIndex
CREATE INDEX "assistance_categories_is_active_idx" ON "assistance_categories"("is_active");

-- CreateIndex
CREATE INDEX "assistance_protocol_steps_category_id_idx" ON "assistance_protocol_steps"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "assistance_protocol_steps_category_id_step_number_key" ON "assistance_protocol_steps"("category_id", "step_number");

-- AddForeignKey
ALTER TABLE "assistance_cases" ADD CONSTRAINT "assistance_cases_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "assistance_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistance_protocol_steps" ADD CONSTRAINT "assistance_protocol_steps_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "assistance_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
