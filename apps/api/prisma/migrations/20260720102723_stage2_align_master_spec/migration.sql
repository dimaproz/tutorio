-- Align the Stage 2 schema with the master specification.
-- Hand-edited from the generated version: `name` is RENAMED (not dropped) to
-- `fullName` and `parentContact` to `parentName` so existing rows survive.

-- DropIndex
DROP INDEX "students_publicToken_key";

-- DropIndex
DROP INDEX "students_workspaceId_name_idx";

-- AlterTable
ALTER TABLE "enrollments" ALTER COLUMN "billingType" SET DEFAULT 'PACKAGE';

-- AlterTable: public tokens are deferred to Stage 6 (public student page).
ALTER TABLE "students" RENAME COLUMN "name" TO "fullName";
ALTER TABLE "students" RENAME COLUMN "parentContact" TO "parentName";
ALTER TABLE "students" DROP COLUMN "publicToken";
ALTER TABLE "students"
ADD COLUMN     "parentEmail" TEXT,
ADD COLUMN     "parentPhone" TEXT;

-- CreateIndex
CREATE INDEX "groups_workspaceId_name_idx" ON "groups"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "groups_workspaceId_updatedAt_idx" ON "groups"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "students_workspaceId_fullName_idx" ON "students"("workspaceId", "fullName");

-- CreateIndex
CREATE INDEX "students_workspaceId_updatedAt_idx" ON "students"("workspaceId", "updatedAt");
