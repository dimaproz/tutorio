-- Work Packet 6.4 phase 3: billing core (product/scheduling.md L-10…L-12,
-- L-70…L-74, L-81…L-83, L-90, L-91; ADR 0007).
--
-- A package now pays for one direction (enrollment); a lesson produces one
-- charge per participant; group packages and participant shares are gone.
-- Only test data exists (ADR 0007): individual packages are attached to the
-- student's individual direction, group packages are removed (their payments
-- stay, detached), and lesson charges start empty — reseed the database to
-- get a consistent history.

-- Monthly billing is not supported (L-13).
UPDATE "enrollments" SET "billingType" = 'PER_LESSON' WHERE "billingType" = 'MONTHLY';

-- CreateEnum
CREATE TYPE "charge_source" AS ENUM ('PACKAGE', 'DEBT', 'BALANCE');

-- AlterEnum
BEGIN;
CREATE TYPE "billing_type_new" AS ENUM ('PACKAGE', 'PER_LESSON');
ALTER TABLE "public"."enrollments" ALTER COLUMN "billingType" DROP DEFAULT;
ALTER TABLE "enrollments" ALTER COLUMN "billingType" TYPE "billing_type_new" USING ("billingType"::text::"billing_type_new");
ALTER TYPE "billing_type" RENAME TO "billing_type_old";
ALTER TYPE "billing_type_new" RENAME TO "billing_type";
DROP TYPE "public"."billing_type_old";
ALTER TABLE "enrollments" ALTER COLUMN "billingType" SET DEFAULT 'PER_LESSON';
COMMIT;

-- Lesson debits are charges now; credit entries only grant credits.
DELETE FROM "lesson_credit_entries" WHERE "type" NOT IN ('purchase', 'manual_adjustment');

-- AlterEnum
BEGIN;
CREATE TYPE "credit_entry_type_new" AS ENUM ('purchase', 'manual_adjustment');
ALTER TABLE "lesson_credit_entries" ALTER COLUMN "type" TYPE "credit_entry_type_new" USING ("type"::text::"credit_entry_type_new");
ALTER TYPE "credit_entry_type" RENAME TO "credit_entry_type_old";
ALTER TYPE "credit_entry_type_new" RENAME TO "credit_entry_type";
DROP TYPE "public"."credit_entry_type_old";
COMMIT;

-- A package belongs to a direction: the student's individual enrollment
-- (a live, active one first).
ALTER TABLE "lesson_packages" ADD COLUMN "enrollmentId" TEXT;
UPDATE "lesson_packages" AS p
SET "enrollmentId" = (
  SELECT e."id"
  FROM "enrollments" AS e
  WHERE e."studentId" = p."studentId" AND e."groupId" IS NULL
  ORDER BY (e."deletedAt" IS NULL) DESC, (e."status" = 'ACTIVE') DESC, e."createdAt"
  LIMIT 1
)
WHERE p."studentId" IS NOT NULL;

-- Group packages (and a student package with no individual direction) have
-- no direction to move to: their payments stay as money without a package.
UPDATE "payments" SET "packageId" = NULL
WHERE "packageId" IN (SELECT "id" FROM "lesson_packages" WHERE "enrollmentId" IS NULL);
UPDATE "lessons" SET "packageId" = NULL
WHERE "packageId" IN (SELECT "id" FROM "lesson_packages" WHERE "enrollmentId" IS NULL);
UPDATE "lesson_series" SET "packageId" = NULL
WHERE "packageId" IN (SELECT "id" FROM "lesson_packages" WHERE "enrollmentId" IS NULL);
DELETE FROM "package_participant_shares";
DELETE FROM "lesson_credit_entries"
WHERE "packageId" IN (SELECT "id" FROM "lesson_packages" WHERE "enrollmentId" IS NULL);
DELETE FROM "lesson_packages" WHERE "enrollmentId" IS NULL;

-- DropForeignKey
ALTER TABLE "lesson_credit_entries" DROP CONSTRAINT "lesson_credit_entries_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "lesson_credit_entries" DROP CONSTRAINT "lesson_credit_entries_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "lesson_packages" DROP CONSTRAINT "lesson_packages_groupId_fkey";

-- DropForeignKey
ALTER TABLE "lesson_packages" DROP CONSTRAINT "lesson_packages_studentId_fkey";

-- DropForeignKey
ALTER TABLE "package_participant_shares" DROP CONSTRAINT "package_participant_shares_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "package_participant_shares" DROP CONSTRAINT "package_participant_shares_packageId_fkey";

-- DropForeignKey
ALTER TABLE "package_participant_shares" DROP CONSTRAINT "package_participant_shares_workspaceId_fkey";

-- DropIndex
DROP INDEX "lesson_credit_entries_lessonId_idx";

-- DropIndex
DROP INDEX "lesson_packages_groupId_idx";

-- AlterTable
ALTER TABLE "lesson_credit_entries" DROP COLUMN "enrollmentId",
DROP COLUMN "lessonId";

-- AlterTable (drops lesson_packages_single_target_check with groupId)
ALTER TABLE "lesson_packages" DROP COLUMN "groupId",
ALTER COLUMN "enrollmentId" SET NOT NULL,
ALTER COLUMN "studentId" SET NOT NULL;

-- AlterTable
ALTER TABLE "lesson_series" DROP COLUMN "packageId";

-- AlterTable
ALTER TABLE "lessons" DROP COLUMN "packageId";

-- DropTable
DROP TABLE "package_participant_shares";

-- CreateTable
CREATE TABLE "lesson_charges" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "source" "charge_source" NOT NULL,
    "packageId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_charges_pkey" PRIMARY KEY ("id"),
    -- A package pays exactly the charges whose source is PACKAGE.
    CONSTRAINT "lesson_charges_package_source_check"
      CHECK (("source" = 'PACKAGE') = ("packageId" IS NOT NULL)),
    CONSTRAINT "lesson_charges_amount_check" CHECK ("amountMinor" >= 0)
);

-- CreateIndex
CREATE INDEX "lesson_charges_enrollmentId_voidedAt_idx" ON "lesson_charges"("enrollmentId", "voidedAt");

-- CreateIndex
CREATE INDEX "lesson_charges_packageId_idx" ON "lesson_charges"("packageId");

-- CreateIndex
CREATE INDEX "lesson_charges_workspaceId_idx" ON "lesson_charges"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_charges_lessonId_enrollmentId_key" ON "lesson_charges"("lessonId", "enrollmentId");

-- CreateIndex
CREATE INDEX "lesson_packages_enrollmentId_idx" ON "lesson_packages"("enrollmentId");

-- AddForeignKey
ALTER TABLE "lesson_packages" ADD CONSTRAINT "lesson_packages_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_packages" ADD CONSTRAINT "lesson_packages_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_charges" ADD CONSTRAINT "lesson_charges_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_charges" ADD CONSTRAINT "lesson_charges_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_charges" ADD CONSTRAINT "lesson_charges_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_charges" ADD CONSTRAINT "lesson_charges_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "lesson_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
