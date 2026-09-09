-- Workspace-level colour branding is no longer a product capability.
ALTER TABLE "workspaces"
  DROP COLUMN "primaryColor",
  DROP COLUMN "secondaryColor";
