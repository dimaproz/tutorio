-- When the money for a single lesson arrived. Package lessons are still paid
-- through the package's own Payment rows; this column is for lessons billed one
-- by one, where there is no package to hang the payment on. Nullable on purpose:
-- on a completed lesson, null reads as "paid on the day of the lesson".
ALTER TABLE "lessons"
  ADD COLUMN "paidAt" TIMESTAMP(3);
