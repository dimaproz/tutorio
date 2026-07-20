-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "billing_type" AS ENUM ('PACKAGE', 'MONTHLY', 'PER_LESSON');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE');

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "timezone" TEXT NOT NULL,
    "parentContact" TEXT,
    "notes" TEXT,
    "publicToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT,
    "teacherId" TEXT NOT NULL,
    "status" "enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "billingType" "billing_type" NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "cancellationDeadlineHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "audit_action" NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_publicToken_key" ON "students"("publicToken");

-- CreateIndex
CREATE INDEX "students_workspaceId_deletedAt_idx" ON "students"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "students_workspaceId_name_idx" ON "students"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "groups_workspaceId_deletedAt_idx" ON "groups"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "enrollments_workspaceId_deletedAt_idx" ON "enrollments"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "enrollments_studentId_idx" ON "enrollments"("studentId");

-- CreateIndex
CREATE INDEX "enrollments_groupId_idx" ON "enrollments"("groupId");

-- CreateIndex
CREATE INDEX "enrollments_teacherId_idx" ON "enrollments"("teacherId");

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_createdAt_idx" ON "audit_logs"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_entity_entityId_idx" ON "audit_logs"("workspaceId", "entity", "entityId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "workspace_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Raw SQL below: constraints Prisma schema language cannot express.

-- Partial uniqueness among non-deleted enrollments: a student may have at most
-- one live enrollment per group. Soft-deleted rows do not block re-enrollment.
CREATE UNIQUE INDEX "enrollments_active_student_group_key"
    ON "enrollments" ("studentId", "groupId")
    WHERE "deletedAt" IS NULL AND "groupId" IS NOT NULL;

-- Partial uniqueness among non-deleted individual enrollments: a student may
-- have at most one live individual enrollment per teacher.
CREATE UNIQUE INDEX "enrollments_active_student_teacher_individual_key"
    ON "enrollments" ("studentId", "teacherId")
    WHERE "deletedAt" IS NULL AND "groupId" IS NULL;

-- Money is stored in minor units and is never negative for a price.
ALTER TABLE "enrollments"
    ADD CONSTRAINT "enrollments_priceMinor_nonnegative_check"
    CHECK ("priceMinor" >= 0);

-- Cancellation deadline override must be non-negative when present.
ALTER TABLE "enrollments"
    ADD CONSTRAINT "enrollments_cancellationDeadlineHours_nonnegative_check"
    CHECK ("cancellationDeadlineHours" IS NULL OR "cancellationDeadlineHours" >= 0);
