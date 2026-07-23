-- Stage 2.5 follow-up: a curated illustration picker for students and parents.
-- avatarKey is validated against a fixed list at the app layer (@tutorio/validation)
-- — never a free-form URL — so this stays a plain nullable column.

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "avatarKey" TEXT;

-- AlterTable
ALTER TABLE "parents" ADD COLUMN     "avatarKey" TEXT;
