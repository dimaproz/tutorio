-- Brand colours are workspace-scoped so every member sees the school's theme.
ALTER TABLE "workspaces"
  ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#5D87FF',
  ADD COLUMN "secondaryColor" TEXT NOT NULL DEFAULT '#49BEFF';
