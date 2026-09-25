-- When a teacher was archived, or the owner turned their own teaching off
-- (docs/screens/s09-teachers.md): the archived profile reads «В архіві з …».
ALTER TABLE "teachers" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Profiles archived before the column existed: the last change is the best
-- date there is.
UPDATE "teachers" SET "archivedAt" = "updatedAt" WHERE "status" = 'ARCHIVED';
