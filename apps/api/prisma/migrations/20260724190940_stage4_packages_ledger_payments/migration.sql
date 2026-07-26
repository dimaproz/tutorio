-- CreateEnum
CREATE TYPE "package_sizing_mode" AS ENUM ('FIXED_COUNT', 'BY_PERIOD');

-- CreateEnum
CREATE TYPE "package_payment_status" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "credit_entry_type" AS ENUM ('purchase', 'lesson_completed', 'late_cancellation', 'teacher_cancellation_refund', 'manual_adjustment');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'BANK_TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "lesson_packages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "studentId" TEXT,
    "groupId" TEXT,
    "name" TEXT,
    "sizingMode" "package_sizing_mode" NOT NULL DEFAULT 'FIXED_COUNT',
    "lessonsTotal" INTEGER NOT NULL,
    "endDate" TIMESTAMP(3),
    "pricePerLessonMinorSnapshot" INTEGER NOT NULL,
    "totalPriceMinorSnapshot" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "paymentStatus" "package_payment_status" NOT NULL DEFAULT 'PENDING',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "lesson_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_credit_entries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "lessonId" TEXT,
    "delta" INTEGER NOT NULL,
    "type" "credit_entry_type" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_credit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_participant_shares" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "oweMinor" INTEGER NOT NULL,
    "paidMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_participant_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "packageId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "payment_method" NOT NULL DEFAULT 'CASH',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_packages_workspaceId_deletedAt_idx" ON "lesson_packages"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "lesson_packages_studentId_idx" ON "lesson_packages"("studentId");

-- CreateIndex
CREATE INDEX "lesson_packages_groupId_idx" ON "lesson_packages"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_credit_entries_idempotencyKey_key" ON "lesson_credit_entries"("idempotencyKey");

-- CreateIndex
CREATE INDEX "lesson_credit_entries_packageId_createdAt_idx" ON "lesson_credit_entries"("packageId", "createdAt");

-- CreateIndex
CREATE INDEX "lesson_credit_entries_workspaceId_createdAt_idx" ON "lesson_credit_entries"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "lesson_credit_entries_lessonId_idx" ON "lesson_credit_entries"("lessonId");

-- CreateIndex
CREATE INDEX "package_participant_shares_workspaceId_idx" ON "package_participant_shares"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "package_participant_shares_packageId_enrollmentId_key" ON "package_participant_shares"("packageId", "enrollmentId");

-- CreateIndex
CREATE INDEX "payments_workspaceId_paidAt_idx" ON "payments"("workspaceId", "paidAt");

-- CreateIndex
CREATE INDEX "payments_enrollmentId_idx" ON "payments"("enrollmentId");

-- CreateIndex
CREATE INDEX "payments_packageId_idx" ON "payments"("packageId");

-- AddForeignKey
ALTER TABLE "lesson_packages" ADD CONSTRAINT "lesson_packages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_packages" ADD CONSTRAINT "lesson_packages_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_packages" ADD CONSTRAINT "lesson_packages_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_credit_entries" ADD CONSTRAINT "lesson_credit_entries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_credit_entries" ADD CONSTRAINT "lesson_credit_entries_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "lesson_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_credit_entries" ADD CONSTRAINT "lesson_credit_entries_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_credit_entries" ADD CONSTRAINT "lesson_credit_entries_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_credit_entries" ADD CONSTRAINT "lesson_credit_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_participant_shares" ADD CONSTRAINT "package_participant_shares_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_participant_shares" ADD CONSTRAINT "package_participant_shares_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "lesson_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_participant_shares" ADD CONSTRAINT "package_participant_shares_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "lesson_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Money and lesson counts are non-negative by construction. The credit ledger
-- is the one exception: `delta` is signed (a purchase is +N, a consumed lesson
-- is -1, a compensating correction flips the sign back).
ALTER TABLE "lesson_packages"
  ADD CONSTRAINT "lesson_packages_lessons_total_check" CHECK ("lessonsTotal" >= 1),
  ADD CONSTRAINT "lesson_packages_price_per_lesson_check" CHECK ("pricePerLessonMinorSnapshot" >= 0),
  ADD CONSTRAINT "lesson_packages_total_price_check" CHECK ("totalPriceMinorSnapshot" >= 0);

ALTER TABLE "package_participant_shares"
  ADD CONSTRAINT "package_shares_owe_check" CHECK ("oweMinor" >= 0),
  ADD CONSTRAINT "package_shares_paid_check" CHECK ("paidMinor" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_check" CHECK ("amountMinor" >= 0);

-- Exactly one target: a package belongs to a student or to a group, never both
-- and never neither. Mirrors the lesson/series targeting rule.
ALTER TABLE "lesson_packages"
  ADD CONSTRAINT "lesson_packages_single_target_check"
  CHECK (("studentId" IS NOT NULL) <> ("groupId" IS NOT NULL));
