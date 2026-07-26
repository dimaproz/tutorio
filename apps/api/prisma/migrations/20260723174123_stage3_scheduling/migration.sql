-- CreateEnum
CREATE TYPE "lesson_status" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED_CHARGED', 'CANCELLED_UNCHARGED');

-- CreateEnum
CREATE TYPE "cancelled_by" AS ENUM ('TEACHER', 'STUDENT', 'GROUP');

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Kyiv';

-- CreateTable
CREATE TABLE "lesson_series" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "groupId" TEXT,
    "packageId" TEXT,
    "teacherId" TEXT NOT NULL,
    "weekdays" INTEGER[],
    "localTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "horizonMaterializedUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "lesson_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "groupId" TEXT,
    "seriesId" TEXT,
    "packageId" TEXT,
    "teacherId" TEXT NOT NULL,
    "startsAtUtc" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "lesson_status" NOT NULL DEFAULT 'SCHEDULED',
    "isDetached" BOOLEAN NOT NULL DEFAULT false,
    "cancelledBy" "cancelled_by",
    "cancelledReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_series_workspaceId_deletedAt_idx" ON "lesson_series"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "lesson_series_enrollmentId_idx" ON "lesson_series"("enrollmentId");

-- CreateIndex
CREATE INDEX "lesson_series_groupId_idx" ON "lesson_series"("groupId");

-- CreateIndex
CREATE INDEX "lesson_series_teacherId_idx" ON "lesson_series"("teacherId");

-- CreateIndex
CREATE INDEX "lessons_workspaceId_startsAtUtc_idx" ON "lessons"("workspaceId", "startsAtUtc");

-- CreateIndex
CREATE INDEX "lessons_teacherId_startsAtUtc_idx" ON "lessons"("teacherId", "startsAtUtc");

-- CreateIndex
CREATE INDEX "lessons_seriesId_idx" ON "lessons"("seriesId");

-- CreateIndex
CREATE INDEX "lessons_enrollmentId_idx" ON "lessons"("enrollmentId");

-- CreateIndex
CREATE INDEX "lessons_groupId_idx" ON "lessons"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_seriesId_startsAtUtc_key" ON "lessons"("seriesId", "startsAtUtc");

-- AddForeignKey
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "workspace_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "lesson_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "workspace_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
