-- A group member's own price (product/scheduling.md L-11): false = the member
-- follows the group price, and a group price change reprices them.
ALTER TABLE "enrollments" ADD COLUMN "ownPrice" BOOLEAN NOT NULL DEFAULT false;

-- Existing members whose price differs from their group's already have one.
UPDATE "enrollments" AS e
SET "ownPrice" = true
FROM "groups" AS g
WHERE e."groupId" = g."id"
  AND g."pricePerLesson" IS NOT NULL
  AND (e."priceMinor" <> g."pricePerLesson" OR e."currency" IS DISTINCT FROM g."currency");
