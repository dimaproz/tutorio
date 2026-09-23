-- CreateEnum
CREATE TYPE "lesson_kind" AS ENUM ('REGULAR', 'MAKEUP');

-- AlterEnum
ALTER TYPE "credit_entry_type" ADD VALUE 'no_show';

-- AlterEnum
ALTER TYPE "lesson_status" ADD VALUE 'NO_SHOW';

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "kind" "lesson_kind" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "originalLessonId" TEXT,
ADD COLUMN     "topic" VARCHAR(200);

-- CreateIndex
CREATE UNIQUE INDEX "lessons_originalLessonId_key" ON "lessons"("originalLessonId");

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_originalLessonId_fkey" FOREIGN KEY ("originalLessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

