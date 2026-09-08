-- Dedicated opaque tokens identify exactly the lifecycle operation that
-- suspended recurring work. They intentionally do not reuse deletedAt: that
-- timestamp already represents several independent archive operations.
ALTER TABLE "groups"
  ADD COLUMN "rosterSuspensionToken" TEXT;

ALTER TABLE "enrollments"
  ADD COLUMN "scheduleSuspensionToken" TEXT;

ALTER TABLE "lesson_series"
  ADD COLUMN "scheduleSuspensionToken" TEXT;

ALTER TABLE "lessons"
  ADD COLUMN "scheduleSuspensionToken" TEXT;

CREATE INDEX "lesson_series_scheduleSuspensionToken_idx"
  ON "lesson_series"("scheduleSuspensionToken")
  WHERE "scheduleSuspensionToken" IS NOT NULL;

CREATE INDEX "lessons_scheduleSuspensionToken_idx"
  ON "lessons"("scheduleSuspensionToken")
  WHERE "scheduleSuspensionToken" IS NOT NULL;
