-- Work Packet 6.4 phase 5: package kinds and operations
-- (product/scheduling.md L-80, L-84…L-86). Additive: period packages get a
-- start (`validFrom`) and a weekly count, a package can come from another
-- one's transferred credits, and credits can be transferred or refunded.

-- AlterEnum
ALTER TYPE "credit_entry_type" ADD VALUE 'transfer_out';
ALTER TYPE "credit_entry_type" ADD VALUE 'transfer_in';
ALTER TYPE "credit_entry_type" ADD VALUE 'refund';

-- AlterEnum
ALTER TYPE "package_sizing_mode" ADD VALUE 'BY_PERIOD_WEEKLY';

-- AlterTable
ALTER TABLE "lesson_packages" ADD COLUMN     "lessonsPerWeek" INTEGER,
ADD COLUMN     "transferredFromPackageId" TEXT,
ADD COLUMN     "validFrom" TIMESTAMP(3),
ADD CONSTRAINT "lesson_packages_lessons_per_week_check"
  CHECK ("lessonsPerWeek" IS NULL OR "lessonsPerWeek" >= 1);

-- AddForeignKey
ALTER TABLE "lesson_packages" ADD CONSTRAINT "lesson_packages_transferredFromPackageId_fkey" FOREIGN KEY ("transferredFromPackageId") REFERENCES "lesson_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
