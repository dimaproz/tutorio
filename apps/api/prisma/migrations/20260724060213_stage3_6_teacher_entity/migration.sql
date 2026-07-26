-- CreateEnum
CREATE TYPE "teacher_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "lesson_series" DROP CONSTRAINT "lesson_series_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_teacherId_fkey";

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "telegramUsername" TEXT,
    "subjects" TEXT[],
    "bio" TEXT,
    "defaultRateMinor" INTEGER,
    "currency" TEXT,
    "color" TEXT,
    "avatarKey" TEXT,
    "status" "teacher_status" NOT NULL DEFAULT 'ACTIVE',
    "workspaceMemberId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teachers_workspaceMemberId_key" ON "teachers"("workspaceMemberId");

-- CreateIndex
CREATE INDEX "teachers_workspaceId_deletedAt_idx" ON "teachers"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "teachers_workspaceId_fullName_idx" ON "teachers"("workspaceId", "fullName");

-- CreateIndex
CREATE INDEX "teachers_workspaceId_status_idx" ON "teachers"("workspaceId", "status");

-- Backfill: create one teacher profile per existing workspace member (linked
-- via workspaceMemberId), then remap the teacherId columns from member ids to
-- the new teacher ids so the repointed foreign keys below validate.
INSERT INTO "teachers" ("id", "workspaceId", "fullName", "subjects", "status", "workspaceMemberId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), wm."workspaceId", u."name", '{}', 'ACTIVE', wm."id", now(), now()
FROM "workspace_members" wm
JOIN "users" u ON u."id" = wm."userId";

UPDATE "enrollments" e SET "teacherId" = t."id" FROM "teachers" t WHERE t."workspaceMemberId" = e."teacherId";
UPDATE "lessons" l SET "teacherId" = t."id" FROM "teachers" t WHERE t."workspaceMemberId" = l."teacherId";
UPDATE "lesson_series" s SET "teacherId" = t."id" FROM "teachers" t WHERE t."workspaceMemberId" = s."teacherId";

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_workspaceMemberId_fkey" FOREIGN KEY ("workspaceMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
