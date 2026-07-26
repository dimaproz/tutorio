-- Workspace presentation mode: SOLO hides every teacher control, SCHOOL shows them.
CREATE TYPE "workspace_mode" AS ENUM ('SOLO', 'SCHOOL');

ALTER TABLE "workspaces"
  ADD COLUMN "mode" "workspace_mode" NOT NULL DEFAULT 'SOLO';

-- Existing workspaces that already run more than one active teacher are
-- schools; leaving them on the SOLO default would hide teachers they use.
UPDATE "workspaces" w
SET "mode" = 'SCHOOL'
WHERE (
  SELECT COUNT(*)
  FROM "teachers" t
  WHERE t."workspaceId" = w."id"
    AND t."deletedAt" IS NULL
) > 1;
