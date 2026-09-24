-- Work Packet 6.4 phase 2: schedules (product/scheduling.md L-20…L-27).
-- A schedule groups the LessonSeries rows of one direction (an individual
-- enrollment or a group). Existing rows are backfilled into one schedule per
-- direction; horizonWeeks keeps the former fixed horizon (12) for them.

-- CreateEnum
CREATE TYPE "schedule_state" AS ENUM ('ACTIVE', 'ENDED');

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN "scheduleHorizonWeeks" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "groupId" TEXT,
    "teacherId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "horizonWeeks" INTEGER NOT NULL,
    "endsAt" TIMESTAMP(3),
    "state" "schedule_state" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "schedules_one_target_check" CHECK (
      ("enrollmentId" IS NULL) <> ("groupId" IS NULL)
    ),
    CONSTRAINT "schedules_horizon_check" CHECK ("horizonWeeks" BETWEEN 1 AND 26)
);

-- Backfill: one schedule per direction, described by its newest row. It is
-- ACTIVE when any row is live or suspended (it comes back), else ENDED.
INSERT INTO "schedules" (
  "id", "workspaceId", "enrollmentId", "groupId", "teacherId", "timezone",
  "durationMin", "horizonWeeks", "endsAt", "state", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  latest."workspaceId",
  latest."enrollmentId",
  latest."groupId",
  latest."teacherId",
  latest."timezone",
  latest."durationMin",
  12,
  NULL,
  CASE WHEN EXISTS (
    SELECT 1 FROM "lesson_series" AS live
    WHERE live."workspaceId" = latest."workspaceId"
      AND live."enrollmentId" IS NOT DISTINCT FROM latest."enrollmentId"
      AND live."groupId" IS NOT DISTINCT FROM latest."groupId"
      AND (live."deletedAt" IS NULL OR live."scheduleSuspensionToken" IS NOT NULL)
  ) THEN 'ACTIVE'::"schedule_state" ELSE 'ENDED'::"schedule_state" END,
  latest."createdAt",
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON ("workspaceId", "enrollmentId", "groupId") *
  FROM "lesson_series"
  ORDER BY "workspaceId", "enrollmentId", "groupId", "createdAt" DESC
) AS latest;

-- AlterTable
ALTER TABLE "lesson_series" ADD COLUMN "scheduleId" TEXT;

UPDATE "lesson_series" AS row
SET "scheduleId" = schedule."id"
FROM "schedules" AS schedule
WHERE schedule."workspaceId" = row."workspaceId"
  AND schedule."enrollmentId" IS NOT DISTINCT FROM row."enrollmentId"
  AND schedule."groupId" IS NOT DISTINCT FROM row."groupId";

ALTER TABLE "lesson_series" ALTER COLUMN "scheduleId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "schedules_workspaceId_state_idx" ON "schedules"("workspaceId", "state");
CREATE INDEX "schedules_enrollmentId_idx" ON "schedules"("enrollmentId");
CREATE INDEX "schedules_groupId_idx" ON "schedules"("groupId");
CREATE INDEX "schedules_teacherId_idx" ON "schedules"("teacherId");
CREATE INDEX "lesson_series_scheduleId_idx" ON "lesson_series"("scheduleId");

-- One active schedule per direction (L-20).
CREATE UNIQUE INDEX "schedules_active_enrollment_key"
  ON "schedules"("enrollmentId")
  WHERE "state" = 'ACTIVE' AND "enrollmentId" IS NOT NULL;
CREATE UNIQUE INDEX "schedules_active_group_key"
  ON "schedules"("groupId")
  WHERE "state" = 'ACTIVE' AND "groupId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
