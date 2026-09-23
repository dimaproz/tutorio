-- A group names the teacher who runs it and, optionally, how many seats it has.
ALTER TABLE "groups" ADD COLUMN "teacherId" TEXT;
ALTER TABLE "groups" ADD COLUMN "capacity" INTEGER;

ALTER TABLE "groups"
  ADD CONSTRAINT "groups_capacity_check" CHECK ("capacity" IS NULL OR ("capacity" >= 1 AND "capacity" <= 500));

ALTER TABLE "groups"
  ADD CONSTRAINT "groups_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "groups_teacherId_idx" ON "groups"("teacherId");

-- Backfill: the teacher of the group's newest live recurring schedule wins,
-- because that is who actually teaches the upcoming lessons.
UPDATE "groups" g
SET "teacherId" = s."teacherId"
FROM (
  SELECT DISTINCT ON ("groupId") "groupId", "teacherId"
  FROM "lesson_series"
  WHERE "groupId" IS NOT NULL AND "deletedAt" IS NULL
  ORDER BY "groupId", "createdAt" DESC
) s
WHERE g."id" = s."groupId" AND g."teacherId" IS NULL;

-- Otherwise the most common teacher across the group's live enrollments; a
-- tie goes to the most recently enrolled one.
UPDATE "groups" g
SET "teacherId" = e."teacherId"
FROM (
  SELECT DISTINCT ON ("groupId") "groupId", "teacherId"
  FROM (
    SELECT "groupId", "teacherId", COUNT(*) AS n, MAX("createdAt") AS latest
    FROM "enrollments"
    WHERE "groupId" IS NOT NULL AND "deletedAt" IS NULL
    GROUP BY "groupId", "teacherId"
  ) counted
  ORDER BY "groupId", n DESC, latest DESC
) e
WHERE g."id" = e."groupId" AND g."teacherId" IS NULL;

-- Per-participant attendance of a lesson.
CREATE TYPE "attendance_status" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

CREATE TABLE "lesson_attendance" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "status" "attendance_status" NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lesson_attendance_lessonId_enrollmentId_key" ON "lesson_attendance"("lessonId", "enrollmentId");
CREATE INDEX "lesson_attendance_enrollmentId_idx" ON "lesson_attendance"("enrollmentId");
CREATE INDEX "lesson_attendance_workspaceId_idx" ON "lesson_attendance"("workspaceId");

ALTER TABLE "lesson_attendance" ADD CONSTRAINT "lesson_attendance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_attendance" ADD CONSTRAINT "lesson_attendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_attendance" ADD CONSTRAINT "lesson_attendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_attendance" ADD CONSTRAINT "lesson_attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
