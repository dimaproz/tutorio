-- Work Packet 6.4 phase 6: pauses (product/scheduling.md L-100…L-104).
-- A pause of the whole student or of one direction, and how far it pushed
-- each package. Additive.

-- CreateTable
CREATE TABLE "pauses" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "reason" TEXT,
    "suspensionToken" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pause_package_extensions" (
    "id" TEXT NOT NULL,
    "pauseId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "extendedBySeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pause_package_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pauses_suspensionToken_key" ON "pauses"("suspensionToken");

-- CreateIndex
CREATE INDEX "pauses_workspaceId_studentId_idx" ON "pauses"("workspaceId", "studentId");

-- CreateIndex
CREATE INDEX "pauses_enrollmentId_idx" ON "pauses"("enrollmentId");

-- CreateIndex
CREATE INDEX "pause_package_extensions_packageId_idx" ON "pause_package_extensions"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "pause_package_extensions_pauseId_packageId_key" ON "pause_package_extensions"("pauseId", "packageId");

-- AddForeignKey
ALTER TABLE "pauses" ADD CONSTRAINT "pauses_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pauses" ADD CONSTRAINT "pauses_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pauses" ADD CONSTRAINT "pauses_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pause_package_extensions" ADD CONSTRAINT "pause_package_extensions_pauseId_fkey" FOREIGN KEY ("pauseId") REFERENCES "pauses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pause_package_extensions" ADD CONSTRAINT "pause_package_extensions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "lesson_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A pause ends after it starts; an actual end is never before its start.
ALTER TABLE "pauses"
  ADD CONSTRAINT "pauses_window_check" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"),
  ADD CONSTRAINT "pauses_ended_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "startsAt");

-- How far a pause pushed a package is never negative.
ALTER TABLE "pause_package_extensions"
  ADD CONSTRAINT "pause_package_extensions_seconds_check" CHECK ("extendedBySeconds" >= 0);
