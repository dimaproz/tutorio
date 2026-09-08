-- A monotonically increasing lesson transition identity makes a retry of the
-- same status change idempotent and permits distinct cancel/restore cycles.
ALTER TABLE "lessons"
ADD COLUMN "statusVersion" INTEGER NOT NULL DEFAULT 0;

-- Backfill only unambiguous historical package ownership. Conflicting legacy
-- rows intentionally remain NULL for documented manual repair rather than
-- guessing from the newest package.
WITH unambiguous AS (
  SELECT "lessonId", MIN("packageId") AS "packageId"
  FROM "lesson_credit_entries"
  WHERE "lessonId" IS NOT NULL
  GROUP BY "lessonId"
  HAVING COUNT(DISTINCT "packageId") = 1
)
UPDATE "lessons" AS lesson
SET "packageId" = unambiguous."packageId"
FROM unambiguous
WHERE lesson.id = unambiguous."lessonId"
  AND lesson."packageId" IS NULL;

-- Intentionally no automatic repair is attempted for conflicting history.
-- Deployment must run the documented preflight query and stop for review.
