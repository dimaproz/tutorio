-- Stage 2.5: Parent entity + Student/Group field additions.
-- Drops Student.parentName/parentEmail/parentPhone (dev-only demo data,
-- re-seedable via `pnpm db:seed`) in favor of a real Parent entity linked
-- through StudentParent (many-to-many).

-- CreateEnum
CREATE TYPE "student_status" AS ENUM ('ACTIVE', 'ON_HOLD');

-- AlterTable
ALTER TABLE "students" DROP COLUMN "parentEmail",
DROP COLUMN "parentName",
DROP COLUMN "parentPhone",
ADD COLUMN     "age" INTEGER,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "grade" INTEGER,
ADD COLUMN     "hourlyRateMinor" INTEGER,
ADD COLUMN     "knowledgeLevel" TEXT,
ADD COLUMN     "languageLevel" TEXT,
ADD COLUMN     "status" "student_status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "telegramUsername" TEXT;

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "pricePerLesson" INTEGER;

-- CreateTable
CREATE TABLE "parents" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "telegramUsername" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_parents" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_parents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parents_workspaceId_deletedAt_idx" ON "parents"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "parents_workspaceId_fullName_idx" ON "parents"("workspaceId", "fullName");

-- CreateIndex
CREATE INDEX "parents_workspaceId_updatedAt_idx" ON "parents"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "student_parents_studentId_idx" ON "student_parents"("studentId");

-- CreateIndex
CREATE INDEX "student_parents_parentId_idx" ON "student_parents"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_parents_studentId_parentId_key" ON "student_parents"("studentId", "parentId");

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Raw SQL below: constraints Prisma schema language cannot express.

-- Money is stored in minor units and is never negative for a price/rate.
ALTER TABLE "students"
    ADD CONSTRAINT "students_hourlyRateMinor_nonnegative_check"
    CHECK ("hourlyRateMinor" IS NULL OR "hourlyRateMinor" >= 0);

ALTER TABLE "groups"
    ADD CONSTRAINT "groups_pricePerLesson_nonnegative_check"
    CHECK ("pricePerLesson" IS NULL OR "pricePerLesson" >= 0);

-- Plausible human-age bound; a student profile is never negative or over 120.
ALTER TABLE "students"
    ADD CONSTRAINT "students_age_range_check"
    CHECK ("age" IS NULL OR ("age" >= 0 AND "age" <= 120));

-- School grade/class, Ukrainian system (1..12 inclusive of vocational years).
ALTER TABLE "students"
    ADD CONSTRAINT "students_grade_range_check"
    CHECK ("grade" IS NULL OR ("grade" >= 1 AND "grade" <= 12));
