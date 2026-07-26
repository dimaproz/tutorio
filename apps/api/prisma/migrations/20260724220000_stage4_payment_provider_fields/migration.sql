-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- AlterEnum
ALTER TYPE "payment_method" ADD VALUE 'CARD';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "status" "payment_status" NOT NULL DEFAULT 'PAID';

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_provider_externalId_idx" ON "payments"("provider", "externalId");

