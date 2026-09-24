-- Studio setting for the low-credit warning (product/scheduling.md L-82, L-120).
ALTER TABLE "workspaces" ADD COLUMN "lowCreditThreshold" INTEGER NOT NULL DEFAULT 2;

ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_low_credit_threshold_check"
  CHECK ("lowCreditThreshold" >= 0 AND "lowCreditThreshold" <= 50);
