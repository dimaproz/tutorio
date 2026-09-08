-- Student status is the user-visible lifecycle. The archive timestamp is kept
-- separately so restore can re-enable only the work suspended by that archive.
ALTER TABLE "students" ADD COLUMN "archivedAt" TIMESTAMP(3);
