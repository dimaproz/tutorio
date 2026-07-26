-- Reschedule history for Stage 5 analytics. No LessonStatus expresses "moved"
-- (a rescheduled lesson stays SCHEDULED) and isDetached is overloaded, so the
-- counters are recorded from now on rather than reconstructed from audit rows.
-- Existing lessons start at 0: history before this migration is not recoverable
-- without parsing AuditLog.diff, and is deliberately not backfilled.
ALTER TABLE "lessons"
  ADD COLUMN "rescheduledCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rescheduledAt" TIMESTAMP(3);

-- Revenue by period scans packages by purchase date.
CREATE INDEX "lesson_packages_workspaceId_purchasedAt_idx"
  ON "lesson_packages" ("workspaceId", "purchasedAt");
