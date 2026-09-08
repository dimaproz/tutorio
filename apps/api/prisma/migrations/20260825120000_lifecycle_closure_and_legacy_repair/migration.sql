-- Keep a group membership recoverable when its student is archived. The archive
-- timestamp identifies exactly the operation that changed this enrollment.
ALTER TABLE "enrollments"
  ADD COLUMN "studentArchivedAt" TIMESTAMP(3),
  ADD COLUMN "statusBeforeStudentArchive" "enrollment_status";

-- Upgrade records created before Student.archivedAt existed. `deletedAt` was
-- formerly used as a destructive tombstone; it now becomes the stable archive
-- operation timestamp so the record participates in archive/restore safely.
UPDATE "students"
SET
  "status" = 'ARCHIVED',
  "archivedAt" = COALESCE("archivedAt", "deletedAt", "updatedAt", "createdAt"),
  "deletedAt" = NULL
WHERE "deletedAt" IS NOT NULL;

-- Earlier code could create ARCHIVED records before it assigned an archive
-- timestamp. Do not replace an existing timestamp: it is the restore marker.
UPDATE "students"
SET "archivedAt" = COALESCE("updatedAt", "createdAt")
WHERE "status" = 'ARCHIVED' AND "archivedAt" IS NULL;

-- Archived students are not operational group participants. Preserve groupId
-- and the prior ACTIVE/PAUSED state; restore only rows marked by this archive.
UPDATE "enrollments" AS enrollment
SET
  "statusBeforeStudentArchive" = enrollment."status",
  "studentArchivedAt" = student."archivedAt",
  "status" = 'ARCHIVED'
FROM "students" AS student
WHERE enrollment."studentId" = student."id"
  AND enrollment."groupId" IS NOT NULL
  AND enrollment."deletedAt" IS NULL
  AND enrollment."status" IN ('ACTIVE', 'PAUSED')
  AND enrollment."studentArchivedAt" IS NULL
  AND student."status" = 'ARCHIVED';

-- Match the archive command for legacy archived students: stop individual
-- recurrence and only tombstone scheduled occurrences at/after that archive.
UPDATE "lesson_series" AS series
SET "deletedAt" = student."archivedAt"
FROM "enrollments" AS enrollment
JOIN "students" AS student ON student."id" = enrollment."studentId"
WHERE series."enrollmentId" = enrollment."id"
  AND series."groupId" IS NULL
  AND series."deletedAt" IS NULL
  AND student."status" = 'ARCHIVED';

UPDATE "lessons" AS lesson
SET "deletedAt" = student."archivedAt"
FROM "enrollments" AS enrollment
JOIN "students" AS student ON student."id" = enrollment."studentId"
WHERE lesson."enrollmentId" = enrollment."id"
  AND lesson."groupId" IS NULL
  AND lesson."status" = 'SCHEDULED'
  AND lesson."deletedAt" IS NULL
  AND lesson."startsAtUtc" >= student."archivedAt"
  AND student."status" = 'ARCHIVED';
